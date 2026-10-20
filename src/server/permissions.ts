import { ORPCError } from '@orpc/client';

import { AVAILABLE_PERMISSIONS } from '@/features/role/schema';
import { db } from '@/server/db';

type Db = typeof db;

export type DynamicPermission = { subject: string; action: string };

export type PermissionSource = 'role' | 'grant';

export type EffectivePermissions = {
  roles: { id: string; name: string }[];
  permissions: (DynamicPermission & { source: PermissionSource })[];
  denied: DynamicPermission[];
};

const keyOf = ({ subject, action }: DynamicPermission) =>
  `${subject}:${action}`;

/**
 * Effective permissions of a user in one system (`systemId: null` = the
 * identity center itself):
 *   permissions of the roles of that system
 *   + granted privileges
 *   - denied privileges (deny wins)
 * Expired privileges are ignored. Roles of other systems never count, so an
 * external role cannot give access to the identity center.
 */
export async function getEffectivePermissions(
  prisma: Db,
  { userId, systemId }: { userId: string; systemId: string | null }
): Promise<EffectivePermissions> {
  const now = new Date();

  const [assignments, overrides] = await Promise.all([
    prisma.userRoleAssignment.findMany({
      where: { userId, role: { systemId } },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    }),
    prisma.userPermissionOverride.findMany({
      where: {
        userId,
        systemId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { permission: true },
    }),
  ]);

  const effective = new Map<
    string,
    DynamicPermission & { source: PermissionSource }
  >();

  for (const { role } of assignments) {
    for (const { permission } of role.permissions) {
      effective.set(keyOf(permission), {
        subject: permission.subject,
        action: permission.action,
        source: 'role',
      });
    }
  }

  for (const override of overrides) {
    const key = keyOf(override.permission);
    if (override.effect === 'grant' && !effective.has(key)) {
      effective.set(key, {
        subject: override.permission.subject,
        action: override.permission.action,
        source: 'grant',
      });
    }
  }

  const denied: DynamicPermission[] = [];
  for (const override of overrides) {
    if (override.effect === 'deny') {
      effective.delete(keyOf(override.permission));
      denied.push({
        subject: override.permission.subject,
        action: override.permission.action,
      });
    }
  }

  return {
    roles: assignments.map(({ role }) => ({ id: role.id, name: role.name })),
    permissions: [...effective.values()].sort((a, b) =>
      keyOf(a).localeCompare(keyOf(b))
    ),
    denied,
  };
}

/**
 * Route requirement check: `{ subject: actions[] }`, the user needs at
 * least one of the actions of every listed subject.
 */
export const satisfiesPermission = (
  granted: DynamicPermission[],
  permission: Record<string, readonly string[] | undefined>
) =>
  Object.entries(permission).every(([subject, actions]) =>
    (actions ?? []).some((action) =>
      granted.some((p) => p.subject === subject && p.action === action)
    )
  );

export const hasPermissions = (
  granted: DynamicPermission[],
  required: DynamicPermission[]
) =>
  required.every((req) =>
    granted.some((p) => p.subject === req.subject && p.action === req.action)
  );

/**
 * Permissions that exist in a system: the AVAILABLE_PERMISSIONS catalog for
 * the identity center, the modules and actions of an external system.
 */
export async function getSystemCatalog(
  prisma: Db,
  systemId: string | null
): Promise<DynamicPermission[]> {
  if (!systemId) {
    // 'local' and 'both' subjects apply to the identity center
    return AVAILABLE_PERMISSIONS.flatMap((p) =>
      p.actions.map((action) => ({ subject: p.subject, action }))
    );
  }

  const modules = await prisma.externalModule.findMany({ where: { systemId } });
  return modules.flatMap((m) =>
    (m.actions as string[]).map((action) => ({ subject: m.name, action }))
  );
}

/**
 * Nobody can hand out (or take away) identity-center permissions they do
 * not hold: applies to local roles and local privileges. Permissions of
 * external systems are managed by whoever administers roles/privileges.
 */
export async function assertRequesterHolds(
  prisma: Db,
  requesterId: string,
  permissions: DynamicPermission[]
) {
  if (!permissions.length) return;

  const own = await getEffectivePermissions(prisma, {
    userId: requesterId,
    systemId: null,
  });
  const missing = permissions.filter(
    (p) => !hasPermissions(own.permissions, [p])
  );

  if (missing.length) {
    throw new ORPCError('FORBIDDEN', {
      message: 'Cannot manage permissions you do not hold',
      data: { missing },
    });
  }
}
