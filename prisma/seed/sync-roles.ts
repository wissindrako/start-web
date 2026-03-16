import { db } from '@/server/db';

async function syncCustomRoles() {
  console.log('⏳ Syncing UserRoleAssignment for existing users...');

  const roles = await db.role.findMany();
  const roleMap = Object.fromEntries(roles.map((r) => [r.name, r.id]));
  console.log('Found roles:', Object.keys(roleMap));

  const usersWithoutRoles = await db.user.findMany({
    where: { roles: { none: {} } },
  });
  console.log(
    `Found ${usersWithoutRoles.length} users without any role assignment`
  );

  let count = 0;
  for (const user of usersWithoutRoles) {
    const roleName = (user.role as string) ?? 'user';
    const roleId = roleMap[roleName] ?? null;
    if (roleId) {
      await db.userRoleAssignment.upsert({
        where: { userId_roleId: { userId: user.id, roleId } },
        create: { userId: user.id, roleId },
        update: {},
      });
      count++;
    }
  }

  console.log(`✅ Synced ${count} users`);
}

syncCustomRoles()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    db.$disconnect();
  });
