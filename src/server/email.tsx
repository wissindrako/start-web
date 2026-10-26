import { render } from '@react-email/render';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Address } from 'nodemailer/lib/mailer';
import type { MailOptions } from 'nodemailer/lib/sendmail-transport';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { ReactElement } from 'react';

import { DEFAULT_LANGUAGE_KEY } from '@/lib/i18n/constants';

import { envClient } from '@/env/client';
import { envServer } from '@/env/server';
import { db } from '@/server/db';
import type { MailSettings } from '@/server/db/generated/client';
import { logger } from '@/server/logger';
import { decryptSecret } from '@/server/secrets';

export const MAIL_SETTINGS_ID = 'singleton';

export class MailNotConfiguredError extends Error {}

type Mailer = {
  transport: Transporter;
  from: string | Address;
  // Writes the messages to the log instead of sending them
  log: boolean;
};

const smtpOptions = (settings: MailSettings): SMTPTransport.Options => {
  const port = settings.port ?? 587;
  let pass = '';
  if (settings.password) {
    try {
      pass = decryptSecret(settings.password);
    } catch (error) {
      logger.warn(
        { error },
        'The stored SMTP password cannot be read (did AUTH_SECRET change?)'
      );
    }
  }
  return {
    host: settings.host ?? undefined,
    port,
    secure:
      settings.encryption === 'tls' ||
      (settings.encryption === 'auto' && port === 465),
    requireTLS: settings.encryption === 'starttls',
    auth: settings.username ? { user: settings.username, pass } : undefined,
  };
};

const loadMailer = async (): Promise<Mailer> => {
  const settings = await db.mailSettings.findUnique({
    where: { id: MAIL_SETTINGS_ID },
  });
  if (settings) {
    const log = settings.mailer === 'log';
    return {
      // The encryption is the admin's choice (see smtpOptions)
      transport: log
        ? // eslint-disable-next-line sonarjs/no-clear-text-protocols
          nodemailer.createTransport({ jsonTransport: true })
        : // eslint-disable-next-line sonarjs/no-clear-text-protocols
          nodemailer.createTransport(smtpOptions(settings)),
      from: settings.fromName
        ? { name: settings.fromName, address: settings.fromAddress }
        : settings.fromAddress,
      log,
    };
  }

  if (!envServer.EMAIL_SERVER || !envServer.EMAIL_FROM) {
    throw new MailNotConfiguredError(
      'Mail is not configured: set it up in the manager or with EMAIL_SERVER and EMAIL_FROM'
    );
  }
  return {
    // eslint-disable-next-line sonarjs/no-clear-text-protocols
    transport: nodemailer.createTransport(envServer.EMAIL_SERVER),
    from: envServer.EMAIL_FROM,
    log: false,
  };
};

// Built once and rebuilt after the settings change
let mailer: Promise<Mailer> | undefined;

const getMailer = () => {
  mailer ??= loadMailer().catch((error) => {
    mailer = undefined;
    throw error;
  });
  return mailer;
};

export const reloadMailSettings = () => {
  mailer = undefined;
};

export const sendEmail = async ({
  template,
  ...options
}: Omit<MailOptions, 'html'> &
  Required<Pick<MailOptions, 'subject'>> & { template: ReactElement }) => {
  if (envClient.VITE_IS_DEMO) {
    return;
  }

  const { transport, from, log } = await getMailer();
  const html = await render(template);
  const info = await transport.sendMail({ from, html, ...options });
  if (log) {
    logger.info(
      { to: options.to, subject: options.subject, html },
      'Email written to the log (log mailer)'
    );
  }
  return info;
};

export const previewEmailRoute = async (
  template: string,
  props: Record<string, string>
) => {
  let Email;
  try {
    const EmailModule = await import(`../emails/templates/${template}.tsx`);
    Email = EmailModule.default;
  } catch {
    return new Response('Template not found', {
      status: 404,
    });
  }

  const html = await render(
    <Email language={props?.language ?? DEFAULT_LANGUAGE_KEY} {...props} />
  );

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
    },
  });
};
