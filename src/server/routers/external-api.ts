import { ORPCError } from '@orpc/client';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { z } from 'zod';

import { publicProcedure } from '@/server/orpc';

const tags = ['external-api'];

const externalApiProcedure = () =>
  publicProcedure().use(async ({ context, next }) => {
    const headers = getRequestHeaders();
    const apiKey = headers.get('x-api-key');

    if (!apiKey) {
      throw new ORPCError('UNAUTHORIZED', {
        message: 'Missing X-Api-Key header',
      });
    }

    const system = await context.db.externalSystem.findUnique({
      where: { apiKey },
      include: { modules: { orderBy: { order: 'asc' } } },
    });

    if (!system) {
      throw new ORPCError('UNAUTHORIZED', { message: 'Invalid API key' });
    }

    return next({ context: { system } });
  });

export default {
  getUserPermissions: externalApiProcedure()
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
      const assignments = await context.db.userRoleAssignment.findMany({
        where: {
          userId: input.userId,
          role: { systemId: context.system.id },
        },
        include: {
          role: {
            include: { permissions: { include: { permission: true } } },
          },
        },
      });

      const roles = assignments.map((a) => ({
        id: a.role.id,
        name: a.role.name,
      }));

      const seen = new Set<string>();
      const permissions: { subject: string; action: string }[] = [];
      for (const { role } of assignments) {
        for (const rp of role.permissions) {
          const key = `${rp.permission.subject}:${rp.permission.action}`;
          if (!seen.has(key)) {
            seen.add(key);
            permissions.push({
              subject: rp.permission.subject,
              action: rp.permission.action,
            });
          }
        }
      }

      return { roles, permissions };
    }),
};
