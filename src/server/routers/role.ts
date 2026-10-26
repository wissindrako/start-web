import { ORPCError } from '@orpc/client';
import { z } from 'zod';

import { zFormFieldsRole, zRole } from '@/features/role/schema';
import { db } from '@/server/db';
import { protectedProcedure } from '@/server/orpc';
import {
  assertRequesterHolds,
  DynamicPermission,
  getEffectivePermissions,
} from '@/server/permissions';

type Db = typeof db;

export const zDynamicPermission = () =>
  z.object({ subject: z.string(), action: z.string() });

const tags = ['roles'];

export default {
  getMyPermissions: protectedProcedure({ permission: null })
    .route({ method: 'GET', path: '/roles/my-permissions', tags })
    .output(z.array(zDynamicPermission()))
    .handler(async ({ context }) => {
      const { permissions } = await getEffectivePermissions(context.db, {
        userId: context.user.id,
        systemId: null,
      });
      return permissions.map(({ subject, action }) => ({ subject, action }));
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
            externalSystem: {
              include: { modules: { orderBy: { order: 'asc' } } },
            },
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
          externalSystem: {
            include: { modules: { orderBy: { order: 'asc' } } },
          },
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

      // Identity-center roles can only hold permissions the requester has
      if (!input.systemId) {
        await assertRequesterHolds(
          context.db,
          context.user.id,
          input.permissions
        );
      }

      const permissionIds = await getOrCreatePermissions(
        context.db,
        input.permissions
      );

      return await context.db.role.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          scope: input.scope,
          systemId: input.systemId ?? null,
          permissions: {
            create: permissionIds.map((permissionId) => ({ permissionId })),
          },
        },
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { userAssignments: true } },
          externalSystem: {
            include: { modules: { orderBy: { order: 'asc' } } },
          },
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

      const current = await context.db.role.findUnique({
        where: { id: input.id },
        include: { permissions: { include: { permission: true } } },
      });
      if (!current) throw new ORPCError('NOT_FOUND');

      // Adding or removing identity-center permissions requires holding them
      const before = current.systemId
        ? []
        : current.permissions.map(({ permission }) => permission);
      const after = input.systemId ? [] : input.permissions;
      await assertRequesterHolds(
        context.db,
        context.user.id,
        symmetricDifference(before, after)
      );

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
          scope: input.scope,
          systemId: input.systemId ?? null,
          permissions: {
            create: permissionIds.map((permissionId) => ({ permissionId })),
          },
        },
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { userAssignments: true } },
          externalSystem: {
            include: { modules: { orderBy: { order: 'asc' } } },
          },
        },
      });
    }),

  getUsersByRoleId: protectedProcedure({
    permission: { role: ['read'] },
  })
    .route({ method: 'GET', path: '/roles/{id}/users', tags })
    .input(z.object({ id: z.string() }))
    .output(
      z.array(
        z.object({
          id: z.string(),
          name: z.string().nullish(),
          email: z.string(),
          image: z.string().nullish(),
          imageThumbnail: z.string().nullish(),
        })
      )
    )
    .handler(async ({ context, input }) => {
      const assignments = await context.db.userRoleAssignment.findMany({
        where: { roleId: input.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              imageThumbnail: true,
            },
          },
        },
        orderBy: { user: { name: 'asc' } },
      });
      return assignments.map((a) => a.user);
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

function symmetricDifference(
  a: DynamicPermission[],
  b: DynamicPermission[]
): DynamicPermission[] {
  const key = (p: DynamicPermission) => `${p.subject}:${p.action}`;
  const aKeys = new Set(a.map(key));
  const bKeys = new Set(b.map(key));
  return [
    ...a.filter((p) => !bKeys.has(key(p))),
    ...b.filter((p) => !aKeys.has(key(p))),
  ].map(({ subject, action }) => ({ subject, action }));
}

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
