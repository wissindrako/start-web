import { expo } from '@better-auth/expo';
import { oauthProvider } from '@better-auth/oauth-provider';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin, emailOTP, jwt, openAPI } from 'better-auth/plugins';
import { match } from 'ts-pattern';

import i18n from '@/lib/i18n';

import TemplateLoginCode from '@/emails/templates/login-code';
import { envClient } from '@/env/client';
import { envServer } from '@/env/server';
import {
  AUTH_EMAIL_OTP_EXPIRATION_IN_MINUTES,
  AUTH_EMAIL_OTP_MOCKED,
  AUTH_SIGNUP_ENABLED,
} from '@/features/auth/config';
import { permissions } from '@/features/auth/permissions';
import { db } from '@/server/db';
import { sendEmail } from '@/server/email';
import { SERVICE_SCOPES } from '@/server/identity-tokens';
import { getEffectivePermissions, hasPermissions } from '@/server/permissions';
import { getUserLanguage } from '@/server/utils';

async function canManageExternalSystems(userId: string | undefined) {
  if (!userId) return false;
  const { permissions } = await getEffectivePermissions(db, {
    userId,
    systemId: null,
  });
  return hasPermissions(permissions, [
    { subject: 'externalSystem', action: 'update' },
  ]);
}

// Roles and permissions of the user in the system whose API (resource) the
// token is for, so any backend can authorize with the JWT alone. Format:
// "subject:action". Systems that need instant changes ask the external API.
async function systemAccessClaims(
  userId: string,
  resources: string[] | undefined
) {
  if (!resources?.length) return {};
  const system = await db.externalSystem.findFirst({
    where: { resourceIdentifier: { in: resources } },
    select: { id: true },
  });
  if (!system) return {};

  const { roles, permissions } = await getEffectivePermissions(db, {
    userId,
    systemId: system.id,
  });
  return {
    roles: roles.map((role) => role.name),
    permissions: permissions.map((p) => `${p.subject}:${p.action}`),
  };
}

export type Auth = typeof auth;
export const auth = betterAuth({
  // Issuer of the identity center: tokens carry it and systems verify it
  baseURL: envClient.VITE_BASE_URL,
  // The OAuth provider issues tokens through /oauth2/token instead
  disabledPaths: ['/token'],
  session: {
    expiresIn: envServer.AUTH_SESSION_EXPIRATION_IN_SECONDS,
    updateAge: envServer.AUTH_SESSION_UPDATE_AGE_IN_SECONDS,
  },
  trustedOrigins: envServer.AUTH_TRUSTED_ORIGINS,
  database: prismaAdapter(db, {
    provider: 'mysql',
  }),
  user: {
    additionalFields: {
      verifiedAt: {
        type: 'date',
      },
    },
  },
  onAPIError: {
    throw: true,
    errorURL: '/login/error',
  },
  socialProviders: {
    github: {
      enabled: !!(envServer.GITHUB_CLIENT_ID && envServer.GITHUB_CLIENT_SECRET),
      clientId: envServer.GITHUB_CLIENT_ID!,
      clientSecret: envServer.GITHUB_CLIENT_SECRET!,
      disableImplicitSignUp: !AUTH_SIGNUP_ENABLED,
    },
  },

  plugins: [
    // Signing keys (JWKS) for id tokens and JWT access tokens
    jwt(),
    expo(), // Allows an Expo native app to use auth, can be delete if no needed
    openAPI({
      disableDefaultReference: true, // Use custom exposition in /routes/api/openapi folder
    }),
    admin({
      ...permissions,
    }),
    emailOTP({
      disableSignUp: !AUTH_SIGNUP_ENABLED,
      expiresIn: AUTH_EMAIL_OTP_EXPIRATION_IN_MINUTES * 60,
      // Use predictable mocked code in dev and demo
      ...(import.meta.env.DEV || envClient.VITE_IS_DEMO
        ? { generateOTP: () => AUTH_EMAIL_OTP_MOCKED }
        : undefined),
      async sendVerificationOTP({ email, otp, type }) {
        await match(type)
          .with('sign-in', async () => {
            await sendEmail({
              to: email,
              subject: i18n.t('emails:loginCode.subject', {
                lng: getUserLanguage(),
              }),
              template: (
                <TemplateLoginCode language={getUserLanguage()} code={otp} />
              ),
            });
          })
          .with('email-verification', async () => {
            throw new Error(
              'email-verification email not implemented, update the /app/server/auth.tsx file'
            );
          })
          .with('forget-password', async () => {
            throw new Error(
              'forget-password email not implemented, update the /app/server/auth.tsx file'
            );
          })
          .with('change-email', async () => {
            throw new Error(
              'change-email email not implemented, update the /app/server/auth.tsx file'
            );
          })
          .exhaustive();
      },
    }),
    // Identity center: external systems sign users in through OAuth 2.1 /
    // OpenID Connect and get JWT access tokens for their own API (resource)
    oauthProvider({
      loginPage: '/login',
      consentPage: '/oauth/consent',
      scopes: [
        'openid',
        'profile',
        'email',
        'offline_access',
        ...SERVICE_SCOPES,
      ],
      accessTokenExpiresIn:
        envServer.AUTH_OAUTH_ACCESS_TOKEN_EXPIRATION_IN_SECONDS,
      customAccessTokenClaims: ({ user, resources }) =>
        user ? systemAccessClaims(user.id, resources) : {},
      // OAuth clients and resources belong to external systems: only those
      // who manage external systems can create or change them
      clientPrivileges: ({ user }) => canManageExternalSystems(user?.id),
      resourcePrivileges: ({ user }) => canManageExternalSystems(user?.id),
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (envClient.VITE_IS_DEMO) throw new Error('DEMO MODE');
          return { data: user };
        },
        after: async (user) => {
          const roleName = (user.role as string) ?? 'user';
          const dynamicRole = await db.role.findUnique({
            where: { name: roleName },
          });
          if (dynamicRole) {
            await db.userRoleAssignment.upsert({
              where: {
                userId_roleId: { userId: user.id, roleId: dynamicRole.id },
              },
              create: { userId: user.id, roleId: dynamicRole.id },
              update: {},
            });
          }
        },
      },
      update: {
        before: async (user) => {
          if (envClient.VITE_IS_DEMO) throw new Error('DEMO MODE');
          return { data: user };
        },
      },
    },
  },
});
