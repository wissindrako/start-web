import { faker } from '@faker-js/faker';

import { db } from '@/server/db';

import { emphasis } from './_utils';

async function getRoleId(name: string): Promise<string | null> {
  const role = await db.role.findUnique({ where: { name } });
  return role?.id ?? null;
}

async function assignRole(userId: string, roleId: string | null) {
  if (!roleId) return;
  await db.userRoleAssignment.upsert({
    where: { userId_roleId: { userId, roleId } },
    create: { userId, roleId },
    update: {},
  });
}

export async function createUsers() {
  console.log(`⏳ Seeding users`);

  const [adminRoleId, userRoleId] = await Promise.all([
    getRoleId('admin'),
    getRoleId('user'),
  ]);

  let createdCounter = 0;
  const existingCount = await db.user.count();

  await Promise.all(
    Array.from({ length: Math.max(0, 98 - existingCount) }, async () => {
      const user = await db.user.create({
        data: {
          name: faker.person.fullName(),
          email: faker.internet.email().toLowerCase(),
          emailVerified: true,
          role: 'user',
        },
      });
      await assignRole(user.id, userRoleId);
      createdCounter += 1;
    })
  );

  if (!(await db.user.findUnique({ where: { email: 'user@user.com' } }))) {
    const user = await db.user.create({
      data: {
        name: 'User',
        email: 'user@user.com',
        emailVerified: true,
        onboardedAt: new Date(),
        role: 'user',
      },
    });
    await assignRole(user.id, userRoleId);
    createdCounter += 1;
  }

  if (!(await db.user.findUnique({ where: { email: 'admin@admin.com' } }))) {
    const user = await db.user.create({
      data: {
        name: 'Admin',
        email: 'admin@admin.com',
        emailVerified: true,
        role: 'admin',
        onboardedAt: new Date(),
      },
    });
    await assignRole(user.id, adminRoleId);
    createdCounter += 1;
  }

  // Sync UserRoleAssignment for existing users that have none
  const usersWithoutRoles = await db.user.findMany({
    where: { roles: { none: {} } },
  });
  for (const user of usersWithoutRoles) {
    const roleName = (user.role as string) ?? 'user';
    const roleId = roleName === 'admin' ? adminRoleId : userRoleId;
    await assignRole(user.id, roleId);
  }

  console.log(
    `✅ ${existingCount} existing user 👉 ${createdCounter} users created`
  );
  console.log(`👉 Admin connect with: ${emphasis('admin@admin.com')}`);
  console.log(`👉 User connect with: ${emphasis('user@user.com')}`);
}
