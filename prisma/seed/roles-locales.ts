/**
 * Creates or completes the identity center's own roles (admin, user, RR.HH.,
 * RR.HH. consulta) without touching users or demo data: for databases that
 * already exist. pnpm db:roles
 */
import { db } from '@/server/db';

import { createRoles } from './role';

createRoles()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
