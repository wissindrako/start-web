import { ORPCError } from '@orpc/client';
import { z } from 'zod';

import { db } from '@/server/db';
import { protectedProcedure } from '@/server/orpc';
import {
  assertRequesterHolds,
  DynamicPermission,
  getEffectivePermissions,
  getSystemCatalog,
  hasPermissions,
} from '@/server/permissions';

type Db = typeof db;

const tags = ['privileges'];

// Absent = the identity center itself; otherwise an external system id
const zSystemId = () => z.string().optional();

const zPrivilege = () =>
  z.object({
    id: z.string(),
    userId: z.string(),
    systemId: z.string().nullish(),
    effect: z.enum(['grant', 'deny']),
    reason: z.string().nullish(),
    expiresAt: z.date().nullish(),
    expired: z.boolean(),
    permission: z.object({ subject: z.string(), action: z.string() }),
    system: z
      .object({ name: z.string(), label: z.string().nullish() })
      .nullish(),
    grantedBy: z
      .object({ id: z.string(), name: z.string(), email: z.string() })
      .nullish(),
    createdAt: z.date(),
    updatedAt: z.date(),
  });

const privilegeInclude = {
  permission: true,
  system: { select: { name: true, label: true } },
  grantedBy: { select: { id: true, name: true, email: true } },
} as const;

export default {
  getByUser: protectedProcedure({ permission: { privilege: ['read'] } })
    .route({ method: 'GET', path: '/users/{userId}/privileges', tags })
    .input(z.object({ userId: z.string(), systemId: zSystemId() }))
    .output(z.array(zPrivilege()))
    .handler(async ({ context, input }) => {
      const now = new Date();
      const privileges = await context.db.userPermissionOverride.findMany({
        where: { userId: input.userId, systemId: input.systemId ?? null },
        include: privilegeInclude,
        orderBy: { createdAt: 'desc' },
      });

      return privileges.map((p) => ({
        ...p,
        expired: !!p.expiresAt && p.expiresAt <= now,
      }));
    }),

  // What the user can do in a system and why (role or granted privilege)
  getEffectivePermissions: protectedProcedure({
    permission: { privilege: ['read'] },
  })
    .route({
      method: 'GET',
      path: '/users/{userId}/effective-permissions',
      tags,
    })
    .input(z.object({ userId: z.string(), systemId: zSystemId() }))
    .output(
      z.object({
        roles: z.array(z.object({ id: z.string(), name: z.string() })),
        permissions: z.array(
          z.object({
            subject: z.string(),
            action: z.string(),
            source: z.enum(['role', 'grant']),
          })
        ),
        denied: z.array(z.object({ subject: z.string(), action: z.string() })),
      })
    )
    .handler(async ({ context, input }) => {
      await assertUserExists(context.db, input.userId);
      return getEffectivePermissions(context.db, {
        userId: input.userId,
        systemId: input.systemId ?? null,
      });
    }),

  // Grants or denies one permission to a user; replaces the existing
  // privilege for the same user, system and permission
  set: protectedProcedure({ permission: { privilege: ['manage'] } })
    .route({ method: 'PUT', path: '/users/{userId}/privileges', tags })
    .input(
      z.object({
        userId: z.string(),
        systemId: zSystemId(),
        subject: z.string().trim().min(1),
        action: z.string().trim().min(1),
        effect: z.enum(['grant', 'deny']),
        reason: z.string().trim().max(255).optional(),
        expiresAt: z.coerce.date().optional(),
      })
    )
    .output(zPrivilege())
    .handler(async ({ context, input }) => {
      const systemId = input.systemId ?? null;
      const permission = { subject: input.subject, action: input.action };

      await assertCanChangePrivileges(context.db, {
        requesterId: context.user.id,
        userId: input.userId,
        systemId,
        permission,
      });

      // Admins hold the whole identity center: a privilege there could only
      // lock them out (removing old ones stays allowed)
      if (!systemId) await assertNotAdmin(context.db, input.userId);

      if (input.expiresAt && input.expiresAt <= new Date()) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'expiresAt must be in the future',
        });
      }

      const { id: permissionId } = await context.db.permission.upsert({
        where: { subject_action: permission },
        create: permission,
        update: {},
      });

      // Compound unique keys with a nullable column cannot be used in
      // upsert, so look the privilege up first
      const existing = await context.db.userPermissionOverride.findFirst({
        where: { userId: input.userId, systemId, permissionId },
      });

      const data = {
        effect: input.effect,
        reason: input.reason ?? null,
        expiresAt: input.expiresAt ?? null,
        grantedById: context.user.id,
      };

      const privilege = existing
        ? await context.db.userPermissionOverride.update({
            where: { id: existing.id },
            data,
            include: privilegeInclude,
          })
        : await context.db.userPermissionOverride.create({
            data: { userId: input.userId, systemId, permissionId, ...data },
            include: privilegeInclude,
          });

      context.logger.info(
        { userId: input.userId, systemId, permission, effect: input.effect },
        'Privilege set'
      );

      return { ...privilege, expired: false };
    }),

  // Removes a privilege: the user goes back to what their roles say
  deleteById: protectedProcedure({ permission: { privilege: ['manage'] } })
    .route({ method: 'DELETE', path: '/privileges/{id}', tags })
    .input(z.object({ id: z.string() }))
    .output(z.void())
    .handler(async ({ context, input }) => {
      const privilege = await context.db.userPermissionOverride.findUnique({
        where: { id: input.id },
        include: { permission: true },
      });

      if (!privilege) throw new ORPCError('NOT_FOUND');

      await assertCanChangePrivileges(context.db, {
        requesterId: context.user.id,
        userId: privilege.userId,
        systemId: privilege.systemId,
        permission: privilege.permission,
      });

      await context.db.userPermissionOverride.delete({
        where: { id: input.id },
      });

      context.logger.info(
        { userId: privilege.userId, systemId: privilege.systemId },
        'Privilege removed'
      );
    }),
};

async function assertUserExists(prisma: Db, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) throw new ORPCError('NOT_FOUND', { message: 'User not found' });
}

async function assertNotAdmin(prisma: Db, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role === 'admin') {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Admins already hold every permission of the identity center',
      data: { reason: 'adminTarget' },
    });
  }
}

async function assertCanChangePrivileges(
  prisma: Db,
  {
    requesterId,
    userId,
    systemId,
    permission,
  }: {
    requesterId: string;
    userId: string;
    systemId: string | null;
    permission: DynamicPermission;
  }
) {
  if (requesterId === userId) {
    throw new ORPCError('FORBIDDEN', {
      message: 'Cannot change your own privileges',
    });
  }

  await assertUserExists(prisma, userId);

  if (systemId) {
    const system = await prisma.externalSystem.findUnique({
      where: { id: systemId },
      select: { id: true },
    });
    if (!system) {
      throw new ORPCError('NOT_FOUND', { message: 'System not found' });
    }
  }

  const catalog = await getSystemCatalog(prisma, systemId);
  if (!hasPermissions(catalog, [permission])) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Permission does not exist in this system',
      data: { permission },
    });
  }

  if (!systemId) {
    await assertRequesterHolds(prisma, requesterId, [permission]);
  }
}
