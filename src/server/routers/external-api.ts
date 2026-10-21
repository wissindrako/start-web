import { ORPCError } from '@orpc/client';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { z } from 'zod';

import {
  type ServiceScope,
  verifyServiceToken,
} from '@/server/identity-tokens';
import { publicProcedure } from '@/server/orpc';
import { getEffectivePermissions } from '@/server/permissions';

const tags = ['external-api'];

// Module every system has: identity-center account actions
const ACCOUNT_MODULE = 'account';

const include = { modules: { orderBy: { order: 'asc' as const } } };

// The calling system authenticates with an access token from its service
// credentials (OAuth client_credentials, the standard way) or, for older
// integrations, with its API key
const externalApiProcedure = (scope: ServiceScope) =>
  publicProcedure().use(async ({ context, next }) => {
    const headers = getRequestHeaders();
    const bearer = headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    const apiKey = headers.get('x-api-key');

    if (bearer) {
      const token = await verifyServiceToken(bearer).catch(() => null);
      if (!token?.clientId) {
        throw new ORPCError('UNAUTHORIZED', { message: 'Invalid token' });
      }
      if (!token.scopes.includes(scope)) {
        throw new ORPCError('FORBIDDEN', {
          message: `Missing scope ${scope}`,
        });
      }

      const system = await context.db.externalSystem.findUnique({
        where: { serviceClientId: token.clientId },
        include,
      });
      if (!system) {
        throw new ORPCError('UNAUTHORIZED', {
          message: 'Token not issued to an external system',
        });
      }
      return next({ context: { system } });
    }

    if (!apiKey) {
      throw new ORPCError('UNAUTHORIZED', {
        message: 'Missing Authorization (Bearer) or X-Api-Key header',
      });
    }

    const system = await context.db.externalSystem.findUnique({
      where: { apiKey },
      include,
    });

    if (!system) {
      throw new ORPCError('UNAUTHORIZED', { message: 'Invalid API key' });
    }

    return next({ context: { system } });
  });

const zModule = () =>
  z.object({
    name: z.string().trim().toLowerCase().min(1),
    actions: z.array(z.string().trim().min(1)).min(1),
  });

export default {
  // Effective permissions of a user in the calling system: its roles +
  // granted privileges - denied privileges (expired ones ignored)
  getUserPermissions: externalApiProcedure('permissions:read')
    .route({
      method: 'GET',
      path: '/external/users/{userId}/permissions',
      tags,
    })
    .input(z.object({ userId: z.string() }))
    .output(
      z.object({
        roles: z.array(z.object({ id: z.string(), name: z.string() })),
        permissions: z.array(
          z.object({ subject: z.string(), action: z.string() })
        ),
      })
    )
    .handler(async ({ context, input }) => {
      const { roles, permissions } = await getEffectivePermissions(context.db, {
        userId: input.userId,
        systemId: context.system.id,
      });

      return {
        roles,
        permissions: permissions.map(({ subject, action }) => ({
          subject,
          action,
        })),
      };
    }),

  // The system declares its permission catalog (e.g. on startup). Modules
  // not listed are removed, except the default account module.
  syncModules: externalApiProcedure('catalog:write')
    .route({ method: 'PUT', path: '/external/modules', tags })
    .input(z.object({ modules: z.array(zModule()) }))
    .output(
      z.object({
        modules: z.array(
          z.object({ name: z.string(), actions: z.array(z.string()) })
        ),
      })
    )
    .handler(async ({ context, input }) => {
      const systemId = context.system.id;
      const names = input.modules.map((m) => m.name);

      if (new Set(names).size !== names.length) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'Duplicated module names',
        });
      }

      const modules = await context.db.$transaction(async (tx) => {
        for (const [order, module] of input.modules.entries()) {
          const actions = [...new Set(module.actions)];
          await tx.externalModule.upsert({
            where: { systemId_name: { systemId, name: module.name } },
            create: { systemId, name: module.name, actions, order },
            update: { actions, order },
          });
        }

        await tx.externalModule.deleteMany({
          where: {
            systemId,
            name: { notIn: [...names, ACCOUNT_MODULE] },
          },
        });

        return tx.externalModule.findMany({
          where: { systemId },
          orderBy: { order: 'asc' },
        });
      });

      context.logger.info(
        { systemId, modules: modules.length },
        'External system modules synced'
      );

      return {
        modules: modules.map((m) => ({
          name: m.name,
          actions: m.actions as string[],
        })),
      };
    }),
};
