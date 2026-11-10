import { auth } from '@/server/auth';
import { db } from '@/server/db';

/**
 * Passwords live in the "credential" account of Better Auth. People who
 * always signed in with an email code have none: setting a password creates
 * it, hashed the same way Better Auth hashes them.
 */
const CREDENTIAL = 'credential';

const credentialAccount = (userId: string) =>
  db.account.findFirst({
    where: { userId, providerId: CREDENTIAL },
    select: { id: true, password: true },
  });

export const hasPassword = async (userId: string) =>
  !!(await credentialAccount(userId))?.password;

export const verifyPassword = async (userId: string, password: string) => {
  const account = await credentialAccount(userId);
  if (!account?.password) return false;
  const context = await auth.$context;
  return context.password.verify({ hash: account.password, password });
};

export const setPassword = async (userId: string, password: string) => {
  const context = await auth.$context;
  const hash = await context.password.hash(password);
  const account = await credentialAccount(userId);
  if (account) {
    await db.account.update({
      where: { id: account.id },
      data: { password: hash },
    });
    return;
  }
  await db.account.create({
    data: {
      userId,
      accountId: userId,
      providerId: CREDENTIAL,
      password: hash,
    },
  });
};
