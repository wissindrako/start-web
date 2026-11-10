import { z } from 'zod';

import { envServer } from '@/env/server';
import { TWO_FACTOR_POLICIES } from '@/features/access-settings/schema';
import { getAccessSettings } from '@/server/access-settings';
import { MAIL_SETTINGS_ID } from '@/server/email';
import { protectedProcedure } from '@/server/orpc';
import {
  getEffectivePermissions,
  satisfiesPermission,
} from '@/server/permissions';
import { uploadClient } from '@/server/s3';

const tags = ['dashboard'];

const DAY = 24 * 60 * 60 * 1000;

export const zDashboardSummary = () =>
  z.object({
    users: z
      .object({
        total: z.number(),
        verified: z.number(),
        banned: z.number(),
        twoFactor: z.number(),
        newLast30Days: z.number(),
        activeSessions: z.number(),
        activeUsers: z.number(),
        pendingInvitations: z.number(),
        recent: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
            createdAt: z.date(),
          })
        ),
      })
      .nullable(),
    roles: z.object({ local: z.number(), external: z.number() }).nullable(),
    systems: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          label: z.string().nullable(),
          modules: z.number(),
          roles: z.number(),
          oidc: z.boolean(),
          service: z.boolean(),
          catalogSyncedAt: z.date().nullable(),
        })
      )
      .nullable(),
    services: z.object({
      // Where emails go: a mail server, or the server log
      mail: z.enum(['smtp', 'log']),
      storage: z.boolean(),
    }),
    access: z.object({
      signupEnabled: z.boolean(),
      twoFactorRequired: z.enum(TWO_FACTOR_POLICIES),
      allowedDomains: z.number(),
    }),
  });

export default {
  // What the identity center has today; each section only with the
  // permission to see it in the manager
  summary: protectedProcedure({ permission: { apps: ['manager'] } })
    .route({ method: 'GET', path: '/dashboard', tags })
    .output(zDashboardSummary())
    .handler(async ({ context }) => {
      const { db, user } = context;
      const { permissions } = await getEffectivePermissions(db, {
        userId: user.id,
        systemId: null,
      });
      const can = (permission: Record<string, string[]>) =>
        satisfiesPermission(permissions, permission);
      const now = new Date();

      const users = can({ user: ['list'] })
        ? await (async () => {
            const [
              total,
              verified,
              banned,
              twoFactor,
              newLast30Days,
              activeSessions,
              activeUsers,
              pendingInvitations,
              recent,
            ] = await Promise.all([
              db.user.count(),
              db.user.count({ where: { verifiedAt: { not: null } } }),
              db.user.count({ where: { banned: true } }),
              db.user.count({ where: { twoFactorEnabled: true } }),
              db.user.count({
                where: {
                  createdAt: { gte: new Date(now.getTime() - 30 * DAY) },
                },
              }),
              db.session.count({ where: { expiresAt: { gt: now } } }),
              db.user.count({
                where: { sessions: { some: { expiresAt: { gt: now } } } },
              }),
              db.invitation.count({
                where: { acceptedAt: null, expiresAt: { gt: now } },
              }),
              db.user.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: { id: true, name: true, email: true, createdAt: true },
              }),
            ]);
            return {
              total,
              verified,
              banned,
              twoFactor,
              newLast30Days,
              activeSessions,
              activeUsers,
              pendingInvitations,
              recent,
            };
          })()
        : null;

      const roles = can({ role: ['read'] })
        ? {
            local: await db.role.count({ where: { scope: 'local' } }),
            external: await db.role.count({ where: { scope: 'external' } }),
          }
        : null;

      const systems = can({ externalSystem: ['read'] })
        ? (
            await db.externalSystem.findMany({
              orderBy: { name: 'asc' },
              select: {
                id: true,
                name: true,
                label: true,
                oauthClientId: true,
                serviceClientId: true,
                catalogSyncedAt: true,
                _count: { select: { modules: true, roles: true } },
              },
            })
          ).map((system) => ({
            id: system.id,
            name: system.name,
            label: system.label,
            modules: system._count.modules,
            roles: system._count.roles,
            oidc: !!system.oauthClientId,
            service: !!system.serviceClientId,
            catalogSyncedAt: system.catalogSyncedAt,
          }))
        : null;

      const mailSettings = await db.mailSettings.findUnique({
        where: { id: MAIL_SETTINGS_ID },
        select: { mailer: true },
      });
      const mailConfigured = mailSettings
        ? mailSettings.mailer !== 'log'
        : !!envServer.EMAIL_SERVER && !!envServer.EMAIL_FROM;

      const access = await getAccessSettings();

      return {
        users,
        roles,
        systems,
        services: {
          mail: mailConfigured ? 'smtp' : 'log',
          storage: !!uploadClient,
        },
        access: {
          signupEnabled: access.signupEnabled,
          twoFactorRequired: access.twoFactorRequired,
          allowedDomains: access.allowedDomains.length,
        },
      };
    }),
};
