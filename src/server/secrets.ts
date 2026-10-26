import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

import { envServer } from '@/env/server';

// Secrets kept in the database (e.g. the SMTP password), encrypted with a
// key derived from AUTH_SECRET: if AUTH_SECRET changes they can no longer be
// read and have to be entered again
const key = () =>
  createHash('sha256').update(`secrets:${envServer.AUTH_SECRET}`).digest();

const VERSION = 'v1';

export const encryptSecret = (value: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), data]
    .map((part) =>
      typeof part === 'string' ? part : part.toString('base64url')
    )
    .join('.');
};

export const decryptSecret = (value: string) => {
  const [version, iv, tag, data] = value.split('.');
  if (version !== VERSION || !iv || !tag || !data) {
    throw new Error('Unknown secret format');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key(),
    Buffer.from(iv, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};
