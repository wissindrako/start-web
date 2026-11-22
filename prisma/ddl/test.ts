/**
 * Runs the SQL tests of prisma/ddl/tests (*.test.sql) against DATABASE_URL.
 * Each file sets up its own data inside a transaction and rolls it back, so
 * the database is left as it was. A failed check raises an exception and
 * this command exits with an error.
 *
 *   pnpm db:test-funciones
 *
 * Apply the functions first (pnpm db:funciones) if you changed them.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'tests');
const files = readdirSync(dir)
  .filter((file) => file.endsWith('.test.sql'))
  .sort();

let failed = 0;
for (const file of files) {
  try {
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
        stdio: ['ignore', 'ignore', 'pipe'],
        encoding: 'utf8',
        shell: process.platform === 'win32',
      }
    );
    console.log(`✓ ${file}`);
  } catch (error) {
    failed += 1;
    const stderr = String((error as { stderr?: string }).stderr ?? error);
    const reason = /FALLA: [^\n]*/.exec(stderr)?.[0] ?? stderr.trim();
    console.error(`✗ ${file}\n  ${reason}`);
  }
}

if (failed) process.exit(1);
