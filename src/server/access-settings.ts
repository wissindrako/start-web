import { ORPCError } from '@orpc/client';

import { envClient } from '@/env/client';
import { isEmailDomainAllowed } from '@/features/access-settings/domains';
import {
  ACCESS_DEFAULTS,
  AccessSettings,
  TWO_FACTOR_POLICIES,
  TwoFactorPolicy,
} from '@/features/access-settings/schema';
import { db } from '@/server/db';
import { getEffectivePermissions, hasPermissions } from '@/server/permissions';

export const ACCESS_SETTINGS_ID = 'singleton';

const load = async (): Promise<AccessSettings> => {
  const row = await db.accessSettings.findUnique({
    where: { id: ACCESS_SETTINGS_ID },
  });
  if (!row) return ACCESS_DEFAULTS;
  return {
    // The demo never lets anyone sign up
    signupEnabled: !envClient.VITE_IS_DEMO && row.signupEnabled,
    allowedDomains: Array.isArray(row.allowedDomains)
      ? row.allowedDomains.map(String)
      : [],
    loginCodeMinutes: row.loginCodeMinutes,
    invitationDays: row.invitationDays,
    twoFactorRequired: TWO_FACTOR_POLICIES.includes(
      row.twoFactorRequired as TwoFactorPolicy
    )
      ? (row.twoFactorRequired as TwoFactorPolicy)
      : 'off',
  };
};

// Read on every sign-in and protected request: kept for a few seconds, and
// dropped right away when saved here (other instances catch up on expiry)
const TTL_MS = 10_000;
let cached: { at: number; value: Promise<AccessSettings> } | undefined;

export const getAccessSettings = () => {
  if (!cached || Date.now() - cached.at > TTL_MS) {
    const value = load().catch((error) => {
      cached = undefined;
      throw error;
    });
    cached = { at: Date.now(), value };
  }
  return cached.value;
};

export const reloadAccessSettings = () => {
  cached = undefined;
};

// Whether the policy asks this user for two-factor authentication.
// `centerPermissions` saves a lookup when the caller already has them.
export async function requiresTwoFactor(
  userId: string,
  centerPermissions?: { subject: string; action: string }[]
) {
  const { twoFactorRequired } = await getAccessSettings();
  if (twoFactorRequired === 'off') return false;
  if (twoFactorRequired === 'everyone') return true;

  const permissions =
    centerPermissions ??
    (await getEffectivePermissions(db, { userId, systemId: null })).permissions;
  return hasPermissions(permissions, [{ subject: 'apps', action: 'manager' }]);
}

// The policy asks for it and the user has not set it up yet
export async function mustSetUpTwoFactor(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true },
  });
  return !!user && !user.twoFactorEnabled && (await requiresTwoFactor(userId));
}

// For the manager's own forms (invitations, users): a clear reason instead
// of Better Auth's refusal when the account is created
export async function assertEmailDomainAllowed(email: string) {
  const { allowedDomains } = await getAccessSettings();
  if (!isEmailDomainAllowed(email, allowedDomains)) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'This email domain is not allowed',
      data: { reason: 'domainNotAllowed', allowedDomains },
    });
  }
}

export { ACCESS_DEFAULTS };
