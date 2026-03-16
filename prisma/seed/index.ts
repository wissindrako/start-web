import { db } from '@/server/db';

import { createBooks } from './book';
import { createRoles } from './role';
import { createUsers } from './user';

async function main() {
  await createRoles();
  await createUsers();
  await createBooks();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    db.$disconnect();
  });
