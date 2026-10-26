import { z } from 'zod';

export const MAILERS = ['smtp', 'log'] as const;
export const MAIL_ENCRYPTIONS = ['auto', 'starttls', 'tls'] as const;

export type Mailer = (typeof MAILERS)[number];
export type MailEncryption = (typeof MAIL_ENCRYPTIONS)[number];

// Where the center takes its mail settings from
export const MAIL_SOURCES = ['database', 'env', 'none'] as const;

export type MailSettings = z.infer<ReturnType<typeof zMailSettings>>;
export const zMailSettings = () =>
  z.object({
    source: z.enum(MAIL_SOURCES),
    mailer: z.enum(MAILERS),
    host: z.string().nullable(),
    port: z.number().int().nullable(),
    encryption: z.enum(MAIL_ENCRYPTIONS),
    username: z.string().nullable(),
    // The password itself never leaves the server
    hasPassword: z.boolean(),
    fromAddress: z.string().nullable(),
    fromName: z.string().nullable(),
  });

export type MailSettingsInput = z.infer<ReturnType<typeof zMailSettingsInput>>;
export const zMailSettingsInput = () =>
  z
    .object({
      mailer: z.enum(MAILERS),
      host: z.string().trim().max(255).nullish(),
      port: z.number().int().min(1).max(65535).nullish(),
      encryption: z.enum(MAIL_ENCRYPTIONS),
      username: z.string().trim().max(255).nullish(),
      // Empty keeps the stored one
      password: z.string().max(255).nullish(),
      fromAddress: z.email().max(255),
      fromName: z.string().trim().max(255).nullish(),
    })
    .refine((values) => values.mailer !== 'smtp' || !!values.host, {
      path: ['host'],
    })
    .refine((values) => values.mailer !== 'smtp' || !!values.port, {
      path: ['port'],
    });
