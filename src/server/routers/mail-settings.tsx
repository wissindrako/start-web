import { ORPCError } from '@orpc/client';
import { z } from 'zod';

import i18n from '@/lib/i18n';

import TemplateMailTest from '@/emails/templates/mail-test';
import { envServer } from '@/env/server';
import { Permission } from '@/features/auth/permissions';
import {
  MailSettings,
  zMailSettings,
  zMailSettingsInput,
} from '@/features/mail-settings/schema';
import {
  MAIL_SETTINGS_ID,
  reloadMailSettings,
  sendEmail,
} from '@/server/email';
import { protectedProcedure } from '@/server/orpc';
import { encryptSecret } from '@/server/secrets';
import { getUserLanguage } from '@/server/utils';

const tags = ['mail-settings'];

// The settings hold credentials: only who can change the system settings
const permission: Permission = { systemConfig: ['update'] };

// "Name <address>" or a bare address
const parseFrom = (value: string) => {
  const open = value.lastIndexOf('<');
  const close = value.lastIndexOf('>');
  if (open === -1 || close < open) {
    return { fromName: null, fromAddress: value.trim() || null };
  }
  const name = value.slice(0, open).trim().replaceAll('"', '');
  return {
    fromName: name || null,
    fromAddress: value.slice(open + 1, close).trim() || null,
  };
};

const defaultPort = (protocol: string) => (protocol === 'smtps:' ? 465 : 587);

// What EMAIL_SERVER and EMAIL_FROM set, without the password
const fromEnv = (): MailSettings => {
  const base: MailSettings = {
    source: 'none',
    mailer: 'smtp',
    host: null,
    port: null,
    encryption: 'auto',
    username: null,
    hasPassword: false,
    fromAddress: null,
    fromName: null,
  };
  if (!envServer.EMAIL_SERVER || !envServer.EMAIL_FROM) return base;

  const url = new URL(envServer.EMAIL_SERVER);
  const { fromName, fromAddress } = parseFrom(envServer.EMAIL_FROM);
  return {
    ...base,
    source: 'env',
    host: url.hostname || null,
    port: url.port ? Number(url.port) : defaultPort(url.protocol),
    encryption: url.protocol === 'smtps:' ? 'tls' : 'auto',
    username: url.username ? decodeURIComponent(url.username) : null,
    hasPassword: !!url.password,
    fromAddress,
    fromName,
  };
};

const emailFailed = (error: unknown) =>
  new ORPCError('BAD_GATEWAY', {
    message: 'The test email could not be sent',
    data: {
      reason: 'emailFailed',
      detail: error instanceof Error ? error.message : String(error),
    },
    cause: error,
  });

export default {
  get: protectedProcedure({ permission })
    .route({ method: 'GET', path: '/mail-settings', tags })
    .output(zMailSettings())
    .handler(async ({ context }) => {
      const settings = await context.db.mailSettings.findUnique({
        where: { id: MAIL_SETTINGS_ID },
      });
      if (!settings) return fromEnv();
      return {
        source: 'database' as const,
        mailer: settings.mailer === 'log' ? 'log' : 'smtp',
        host: settings.host,
        port: settings.port,
        encryption:
          settings.encryption === 'tls' || settings.encryption === 'starttls'
            ? settings.encryption
            : 'auto',
        username: settings.username,
        hasPassword: !!settings.password,
        fromAddress: settings.fromAddress,
        fromName: settings.fromName,
      };
    }),

  update: protectedProcedure({ permission })
    .route({ method: 'PUT', path: '/mail-settings', tags })
    .input(zMailSettingsInput())
    .output(z.void())
    .handler(async ({ context, input }) => {
      const smtp = input.mailer === 'smtp';
      const username = (smtp && input.username) || null;
      const data = {
        mailer: input.mailer,
        host: smtp ? (input.host ?? null) : null,
        port: smtp ? (input.port ?? null) : null,
        encryption: input.encryption,
        username,
        fromAddress: input.fromAddress,
        fromName: input.fromName || null,
      };
      // An empty password keeps the stored one; without a user there is none
      let password: { password?: string | null } = {};
      if (!username) password = { password: null };
      else if (input.password) {
        password = { password: encryptSecret(input.password) };
      }

      await context.db.mailSettings.upsert({
        where: { id: MAIL_SETTINGS_ID },
        create: { id: MAIL_SETTINGS_ID, ...data, password: null, ...password },
        update: { ...data, ...password },
      });
      reloadMailSettings();
      context.logger.info({ mailer: input.mailer }, 'Mail settings updated');
    }),

  // Back to EMAIL_SERVER and EMAIL_FROM
  reset: protectedProcedure({ permission })
    .route({ method: 'DELETE', path: '/mail-settings', tags })
    .output(z.void())
    .handler(async ({ context }) => {
      await context.db.mailSettings.deleteMany({
        where: { id: MAIL_SETTINGS_ID },
      });
      reloadMailSettings();
      context.logger.info('Mail settings reset to the environment');
    }),

  sendTest: protectedProcedure({ permission })
    .route({ method: 'POST', path: '/mail-settings/test', tags })
    .input(z.object({ to: z.email() }))
    .output(z.void())
    .handler(async ({ context, input }) => {
      const language = getUserLanguage();
      try {
        await sendEmail({
          to: input.to,
          subject: i18n.t('emails:mailTest.subject', { lng: language }),
          template: <TemplateMailTest language={language} />,
        });
      } catch (error) {
        context.logger.warn({ error }, 'Test email failed');
        throw emailFailed(error);
      }
    }),
};
