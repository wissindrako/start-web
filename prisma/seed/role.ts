import { db } from '@/server/db';

import { emphasis } from './_utils';

const ROLES = [
  {
    name: 'admin',
    scope: 'local' as const,
    description: 'Full access to all features',
    permissions: [
      { subject: 'apps', action: 'app' },
      { subject: 'apps', action: 'manager' },
      { subject: 'account', action: 'read' },
      { subject: 'account', action: 'update' },
      { subject: 'book', action: 'read' },
      { subject: 'book', action: 'create' },
      { subject: 'book', action: 'update' },
      { subject: 'book', action: 'delete' },
      { subject: 'genre', action: 'read' },
      { subject: 'user', action: 'list' },
      { subject: 'user', action: 'create' },
      { subject: 'user', action: 'update' },
      { subject: 'user', action: 'delete' },
      { subject: 'user', action: 'ban' },
      { subject: 'session', action: 'list' },
      { subject: 'session', action: 'revoke' },
      { subject: 'role', action: 'read' },
      { subject: 'role', action: 'create' },
      { subject: 'role', action: 'update' },
      { subject: 'role', action: 'delete' },
      { subject: 'personalData', action: 'read' },
      { subject: 'personalData', action: 'create' },
      { subject: 'personalData', action: 'update' },
      { subject: 'personalData', action: 'delete' },
      { subject: 'systemConfig', action: 'read' },
      { subject: 'systemConfig', action: 'update' },
    ],
  },
  {
    name: 'user',
    scope: 'local' as const,
    description: 'Standard user access',
    permissions: [
      { subject: 'apps', action: 'app' },
      { subject: 'account', action: 'update' },
      { subject: 'book', action: 'read' },
      { subject: 'genre', action: 'read' },
      { subject: 'role', action: 'read' },
      { subject: 'personalData', action: 'read' },
      { subject: 'personalData', action: 'update' },
    ],
  },
] as const;

export async function createRoles() {
  console.log(`⏳ Seeding roles`);

  for (const roleData of ROLES) {
    // Upsert each permission
    const permissionIds: string[] = [];
    for (const { subject, action } of roleData.permissions) {
      const perm = await db.permission.upsert({
        where: { subject_action: { subject, action } },
        create: { subject, action },
        update: {},
      });
      permissionIds.push(perm.id);
    }

    const existing = await db.role.findUnique({
      where: { name: roleData.name },
    });

    if (existing) {
      // Sync permissions: add any missing ones
      const existingPerms = await db.rolePermission.findMany({
        where: { roleId: existing.id },
        select: { permissionId: true },
      });
      const existingPermIds = new Set(existingPerms.map((p) => p.permissionId));
      const toAdd = permissionIds.filter((id) => !existingPermIds.has(id));

      await db.role.update({
        where: { id: existing.id },
        data: { scope: roleData.scope },
      });

      if (toAdd.length > 0) {
        await db.rolePermission.createMany({
          data: toAdd.map((permissionId) => ({
            roleId: existing.id,
            permissionId,
          })),
        });
        console.log(
          `  ✅ Role ${emphasis(roleData.name)}: added ${toAdd.length} missing permission(s)`
        );
      } else {
        console.log(
          `  ✅ Role ${emphasis(roleData.name)}: permissions up to date`
        );
      }
    } else {
      await db.role.create({
        data: {
          name: roleData.name,
          description: roleData.description,
          scope: roleData.scope,
          permissions: {
            create: permissionIds.map((permissionId) => ({ permissionId })),
          },
        },
      });
      console.log(`  ✅ Role ${emphasis(roleData.name)} created`);
    }
  }
}
