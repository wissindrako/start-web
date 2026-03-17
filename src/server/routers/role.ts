import { ORPCError } from '@orpc/client';
import { z } from 'zod';

import { zFormFieldsRole, zRole } from '@/features/role/schema';
import { db } from '@/server/db';
import { protectedProcedure } from '@/server/orpc';

type Db = typeof db;

export const zDynamicPermission = () =>
  z.object({ subject: z.string(), action: z.string() });

const tags = ['roles'];

export default {
  getMyPermissions: protectedProcedure({ permission: null })
    .route({ method: 'GET', path: '/roles/my-permissions', tags })
    .output(z.array(zDynamicPermission()))
    .handler(async ({ context }) => {
      const user = await context.db.user.findUnique({
        where: { id: context.user.id },
        include: {
          roles: {
            include: {
              role: {
                include: { permissions: { include: { permission: true } } },
              },
            },
          },
        },
      });

      // Union of permissions from all assigned roles (deduplicated)
      const seen = new Set<string>();
      const permissions: { subject: string; action: string }[] = [];
      for (const assignment of user?.roles ?? []) {
        for (const rp of assignment.role.permissions) {
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
      return permissions;
    }),

  getAll: protectedProcedure({
    permission: { role: ['read'] },
  })
    .route({
      method: 'GET',
      path: '/roles',
      tags,
    })
    .input(
      z
        .object({
          cursor: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(100).prefault(20),
          searchTerm: z.string().trim().optional().prefault(''),
        })
        .prefault({})
    )
    .output(
      z.object({
        items: z.array(zRole()),
        nextCursor: z.string().optional(),
        total: z.number(),
      })
    )
    .handler(async ({ context, input }) => {
      context.logger.info('Getting roles from database');

      const where = input.searchTerm
        ? {
            name: {
              contains: input.searchTerm,
              mode: 'insensitive' as const,
            },
          }
        : {};

      const [total, items] = await Promise.all([
        context.db.role.count({ where }),
        context.db.role.findMany({
          take: input.limit + 1,
          cursor: input.cursor ? { id: input.cursor } : undefined,
          orderBy: { name: 'asc' },
          where,
          include: {
            permissions: { include: { permission: true } },
            _count: { select: { userAssignments: true } },
          },
        }),
      ]);

      let nextCursor: typeof input.cursor | undefined = undefined;
      if (items.length > input.limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
      }

      return { items, nextCursor, total };
    }),

  getById: protectedProcedure({
    permission: { role: ['read'] },
  })
    .route({
      method: 'GET',
      path: '/roles/{id}',
      tags,
    })
    .input(z.object({ id: z.string() }))
    .output(zRole())
    .handler(async ({ context, input }) => {
      context.logger.info('Getting role');
      const role = await context.db.role.findUnique({
        where: { id: input.id },
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { userAssignments: true } },
        },
      });

      if (!role) {
        context.logger.warn('Unable to find role with the provided input');
        throw new ORPCError('NOT_FOUND');
      }

      return role;
    }),

  create: protectedProcedure({
    permission: { role: ['create'] },
  })
    .route({
      method: 'POST',
      path: '/roles',
      tags,
    })
    .input(zFormFieldsRole())
    .output(zRole())
    .handler(async ({ context, input }) => {
      context.logger.info('Create role');

      const permissionIds = await getOrCreatePermissions(
        context.db,
        input.permissions
      );

      return await context.db.role.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          permissions: {
            create: permissionIds.map((permissionId) => ({ permissionId })),
          },
        },
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { userAssignments: true } },
        },
      });
    }),

  updateById: protectedProcedure({
    permission: { role: ['update'] },
  })
    .route({
      method: 'POST',
      path: '/roles/{id}',
      tags,
    })
    .input(zFormFieldsRole().extend({ id: z.string() }))
    .output(zRole())
    .handler(async ({ context, input }) => {
      context.logger.info('Update role');

      const permissionIds = await getOrCreatePermissions(
        context.db,
        input.permissions
      );

      // Replace all permissions
      await context.db.rolePermission.deleteMany({
        where: { roleId: input.id },
      });

      return await context.db.role.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description ?? null,
          permissions: {
            create: permissionIds.map((permissionId) => ({ permissionId })),
          },
        },
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { userAssignments: true } },
        },
      });
    }),

  deleteById: protectedProcedure({
    permission: { role: ['delete'] },
  })
    .route({
      method: 'DELETE',
      path: '/roles/{id}',
      tags,
    })
    .input(z.object({ id: z.string() }))
    .output(z.void())
    .handler(async ({ context, input }) => {
      context.logger.info('Delete role');
      await context.db.role.delete({ where: { id: input.id } });
    }),
};

async function getOrCreatePermissions(
  prisma: Db,
  permissions: Array<{ subject: string; action: string }>
): Promise<string[]> {
  const ids: string[] = [];
  for (const { subject, action } of permissions) {
    const perm = await prisma.permission.upsert({
      where: { subject_action: { subject, action } },
      create: { subject, action },
      update: {},
    });
    ids.push(perm.id);
  }
  return ids;
}
