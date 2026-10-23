import { z } from 'zod';

import { isValidDomain } from '@/features/access-settings/domains';
import {
  AUTH_EMAIL_OTP_EXPIRATION_IN_MINUTES,
  AUTH_SIGNUP_ENABLED,
  INVITATION_EXPIRATION_IN_DAYS,
} from '@/features/auth/config';

// Who must use two-factor authentication: nobody, who can open the manager
// (in the center and in the external systems) or everyone
export const TWO_FACTOR_POLICIES = ['off', 'managers', 'everyone'] as const;
export type TwoFactorPolicy = (typeof TWO_FACTOR_POLICIES)[number];

export const LOGIN_CODE_MINUTES = { min: 1, max: 60 } as const;
export const INVITATION_DAYS = { min: 1, max: 90 } as const;

export type AccessSettings = z.infer<ReturnType<typeof zAccessSettings>>;
export const zAccessSettings = () =>
  z.object({
    signupEnabled: z.boolean(),
    allowedDomains: z.array(z.string().refine(isValidDomain)).max(50),
    loginCodeMinutes: z
      .number()
      .int()
      .min(LOGIN_CODE_MINUTES.min)
      .max(LOGIN_CODE_MINUTES.max),
    invitationDays: z
      .number()
      .int()
      .min(INVITATION_DAYS.min)
      .max(INVITATION_DAYS.max),
    twoFactorRequired: z.enum(TWO_FACTOR_POLICIES),
  });

// Until an admin saves them: the environment and the former constants
export const ACCESS_DEFAULTS: AccessSettings = {
  signupEnabled: AUTH_SIGNUP_ENABLED,
  allowedDomains: [],
  loginCodeMinutes: AUTH_EMAIL_OTP_EXPIRATION_IN_MINUTES,
  invitationDays: INVITATION_EXPIRATION_IN_DAYS,
  twoFactorRequired: 'off',
};
