import { ORPCError } from '@orpc/client';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import {
  zExternalSystem,
  zExternalSystemWithKey,
  zFormFieldsExternalSystem,
} from '@/features/external-system/schema';
import { db } from '@/server/db';
import { protectedProcedure } from '@/server/orpc';

type Db = typeof db;

const tags = ['external-systems'];

const includeModules = {
  modules: { orderBy: { order: 'asc' as const } },
};

export default {
  getAll: protectedProcedure({
    permission: { role: ['read'] },
  })
    .route({ method: 'GET', path: '/external-systems', tags })
    .input(
      z
        .object({
          searchTerm: z.string().trim().optional().prefault(''),
        })
        .prefault({})
    )
    .output(z.array(zExternalSystem()))
    .handler(async ({ context, input }) => {
      const where = input.searchTerm
        ? {
            OR: [
              {
                name: {
                  contains: input.searchTerm,
                  mode: 'insensitive' as const,
                },
              },
              {
                label: {
                  contains: input.searchTerm,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {};

      return context.db.externalSystem.findMany({
        where,
        orderBy: { name: 'asc' },
        include: includeModules,
      });
    }),

  getById: protectedProcedure({
    permission: { role: ['read'] },
  })
    .route({ method: 'GET', path: '/external-systems/{id}', tags })
    .input(z.object({ id: z.string() }))
    .output(zExternalSystemWithKey())
    .handler(async ({ context, input }) => {
      const system = await context.db.externalSystem.findUnique({
        where: { id: input.id },
        include: includeModules,
      });
      if (!system) throw new ORPCError('NOT_FOUND');
      return system;
    }),

  rotateApiKey: protectedProcedure({
    permission: { externalSystem: ['update'] },
  })
    .route({
      method: 'POST',
      path: '/external-systems/{id}/rotate-api-key',
      tags,
    })
    .input(z.object({ id: z.string() }))
    .output(zExternalSystemWithKey())
    .handler(async ({ context, input }) => {
      await assertExists(context.db, input.id);
      return context.db.externalSystem.update({
        where: { id: input.id },
        data: { apiKey: randomUUID() },
        include: includeModules,
      });
    }),

  create: protectedProcedure({
    permission: { externalSystem: ['create'] },
  })
    .route({ method: 'POST', path: '/external-systems', tags })
    .input(zFormFieldsExternalSystem())
    .output(zExternalSystem())
    .handler(async ({ context, input }) => {
      const modules = withDefaultAccountModule(input.modules);
      return context.db.externalSystem.create({
        data: {
          name: input.name.trim().toLowerCase(),
          label: input.label ?? null,
          modules: {
            create: modules.map((m, i) => ({
              name: m.name.trim().toLowerCase(),
              actions: m.actions,
              order: m.order ?? i,
            })),
          },
        },
        include: includeModules,
      });
    }),

  updateById: protectedProcedure({
    permission: { externalSystem: ['update'] },
  })
    .route({ method: 'POST', path: '/external-systems/{id}', tags })
    .input(zFormFieldsExternalSystem().extend({ id: z.string() }))
    .output(zExternalSystem())
    .handler(async ({ context, input }) => {
      await assertExists(context.db, input.id);

      // Replace all modules
      await context.db.externalModule.deleteMany({
        where: { systemId: input.id },
      });

      return context.db.externalSystem.update({
        where: { id: input.id },
        data: {
          name: input.name.trim().toLowerCase(),
          label: input.label ?? null,
          modules: {
            create: input.modules.map((m, i) => ({
              name: m.name.trim().toLowerCase(),
              actions: m.actions,
              order: m.order ?? i,
            })),
          },
        },
        include: includeModules,
      });
    }),

  deleteById: protectedProcedure({
    permission: { externalSystem: ['delete'] },
  })
    .route({ method: 'DELETE', path: '/external-systems/{id}', tags })
    .input(z.object({ id: z.string() }))
    .output(z.void())
    .handler(async ({ context, input }) => {
      await context.db.externalSystem.delete({ where: { id: input.id } });
    }),
};

async function assertExists(prisma: Db, id: string) {
  const system = await prisma.externalSystem.findUnique({ where: { id } });
  if (!system) throw new ORPCError('NOT_FOUND');
}

function withDefaultAccountModule(
  modules: Array<{ name: string; actions: string[]; order?: number }>
) {
  const hasAccount = modules.some(
    (m) => m.name.trim().toLowerCase() === 'account'
  );
  if (hasAccount) return modules;
  return [
    { name: 'account', actions: ['read', 'update'], order: 0 },
    ...modules,
  ];
}
