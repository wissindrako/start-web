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
    // Mail is optional: without it the messages go to the log
    logger.warn(
      'Mail is not configured (manager or EMAIL_SERVER and EMAIL_FROM): emails are written to the log'
    );
    return {
      // Nothing is sent: the message is only serialized for the log
      // eslint-disable-next-line sonarjs/no-clear-text-protocols
      transport: nodemailer.createTransport({ jsonTransport: true }),
      from: envServer.EMAIL_FROM ?? 'nucleo-admin@localhost',
      log: true,
    };
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
  strict,
  ...options
}: Omit<MailOptions, 'html'> &
  Required<Pick<MailOptions, 'subject'>> & {
    template: ReactElement;
    /** Fail when the mail server is not reachable, also in development */
    strict?: boolean;
  }) => {
  if (envClient.VITE_IS_DEMO) {
    return;
  }

  const { transport, from, log } = await getMailer();
  const html = await render(template);
  // The plain text version: readable in the console, unlike the HTML
  const writeToLog = async (reason: string) => {
    const text = (await render(template, { plainText: true }))
      .replaceAll(/\n{3,}/g, '\n\n')
      .trim();
    logger.info(
      { to: options.to, subject: options.subject },
      `${reason}\n\n${text}\n`
    );
  };
  if (log) {
    const info = await transport.sendMail({ from, html, ...options });
    await writeToLog('Email written to the log (log mailer)');
    return info;
  }
  try {
    return await transport.sendMail({ from, html, ...options });
  } catch (error) {
    // In development the mail server is often not running (Maildev): the
    // message goes to the log instead of failing the request
    if (strict || !import.meta.env.DEV) throw error;
    await writeToLog(
      `Mail server not reachable (${(error as Error).message}): email written to the log`
    );
    return undefined;
  }
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
