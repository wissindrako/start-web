/**
 * Applies the repeatable SQL files of prisma/ddl (R__NN_*.sql) in order, like
 * Flyway's repeatable migrations in rr-hh: functions and views written with
 * CREATE OR REPLACE, so this can run any number of times.
 *
 *   pnpm db:funciones          (also runs after pnpm db:deploy)
 *
 * Prisma migrations only cover tables; keeping functions here (rr-hh keeps them in ddl/ too) leaves each one
 * in a single readable file instead of copies across migrations.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir)
  .filter((file) => /^R__\d+_.+\.sql$/.test(file))
  .sort();

for (const file of files) {
  execFileSync(
    'pnpm',
    [
      'prisma',
      'db',
      'execute',
      '--schema',
      'prisma/schema.prisma',
      '--file',
      join(dir, file),
    ],
    {
      stdio: ['ignore', 'ignore', 'inherit'],
      shell: process.platform === 'win32',
    }
  );
  console.log(`✓ ${file}`);
}
