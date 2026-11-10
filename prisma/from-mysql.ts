/**
 * Copies the data of the old MySQL database into the PostgreSQL one, once,
 * after `pnpm db:deploy` created its tables. Every table and column that
 * exists in both is copied as it is (ids, OAuth clients and their secrets,
 * signing keys, users, roles…), so the systems connected to nucleo-admin keep
 * working without registering them again. The MySQL database is only read.
 *
 *   pnpm db:from-mysql             copies into an empty PostgreSQL database
 *   pnpm db:from-mysql --replace   empties PostgreSQL first
 *
 * The MySQL database is read with `docker exec` (settings in .env):
 *   MYSQL_SOURCE_CONTAINER   container (default mysql-docker)
 *   MYSQL_SOURCE_DATABASE, MYSQL_SOURCE_USERNAME, MYSQL_SOURCE_PASSWORD
 */
/* eslint-disable no-process-env */
import { spawnSync } from 'node:child_process';

import { PrismaClient } from '@/server/db/generated/client';

const replace = process.argv.includes('--replace');
const source = {
  container: process.env.MYSQL_SOURCE_CONTAINER ?? 'mysql-docker',
  database: process.env.MYSQL_SOURCE_DATABASE,
  username: process.env.MYSQL_SOURCE_USERNAME,
  password: process.env.MYSQL_SOURCE_PASSWORD ?? '',
};
if (!source.database || !source.username) {
  throw new Error(
    'Set MYSQL_SOURCE_DATABASE and MYSQL_SOURCE_USERNAME (and MYSQL_SOURCE_PASSWORD) in .env'
  );
}

/** Runs a query in MySQL: one line per row, without escaping */
const mysql = (sql: string) => {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      // The password goes in the environment, never in the command line
      '-e',
      'MYSQL_PWD',
      source.container,
      'mysql',
      '--default-character-set=utf8mb4',
      '-N',
      '-B',
      '-r',
      '-u',
      source.username!,
      source.database!,
    ],
    {
      input: sql,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 1024,
      env: { ...process.env, MYSQL_PWD: source.password },
    }
  );
  if (result.status !== 0) {
    throw new Error(String(result.stderr || result.error));
  }
  return result.stdout.split('\n').filter((line) => line !== '');
};

const db = new PrismaClient();

type Column = { name: string; type: string; udt: string };

const pgValue = (column: Column, value: unknown) => {
  if (value === null || value === undefined) return null;
  switch (column.type) {
    case 'boolean':
      return value === true || value === 1 || value === '1';
    case 'json':
    case 'jsonb':
      return JSON.stringify(value);
    default:
      return typeof value === 'object' ? JSON.stringify(value) : value;
  }
};

/** Cast of a parameter to the column type ("$1::timestamp(3)") */
const pgCast = (column: Column) => {
  if (column.type === 'USER-DEFINED') return `"${column.udt}"`;
  if (column.type === 'ARRAY') return `${column.udt.slice(1)}[]`;
  if (column.type.startsWith('timestamp')) return 'timestamp(3)';
  return column.udt;
};

const main = async () => {
  const sourceTables = new Set(
    mysql(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE';"
    )
  );

  const rows = await db.$queryRaw<
    { table: string; column: string; type: string; udt: string }[]
  >`SELECT table_name AS "table", column_name AS "column", data_type AS "type", udt_name AS "udt"
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
    ORDER BY table_name, ordinal_position`;
  const targetTables = new Map<string, Column[]>();
  for (const row of rows) {
    const columns = targetTables.get(row.table) ?? [];
    columns.push({ name: row.column, type: row.type, udt: row.udt });
    targetTables.set(row.table, columns);
  }

  const [{ count } = { count: 0n }] = await db.$queryRaw<
    { count: bigint }[]
  >`SELECT count(*) AS count FROM "user"`;
  if (count > 0n && !replace) {
    throw new Error(
      `PostgreSQL already has ${count} user(s). Run with --replace to empty it first.`
    );
  }

  const copied: string[] = [];
  const skipped: string[] = [];

  await db.$transaction(
    async (tx) => {
      // Foreign keys are not checked while copying (tables in any order)
      await tx.$executeRawUnsafe(
        'SET LOCAL session_replication_role = replica'
      );
      if (replace) {
        await tx.$executeRawUnsafe(
          `TRUNCATE ${[...targetTables.keys()].map((table) => `"${table}"`).join(', ')} CASCADE`
        );
      }

      for (const [table, allColumns] of targetTables) {
        if (!sourceTables.has(table)) {
          skipped.push(`${table} (not in MySQL)`);
          continue;
        }
        const sourceColumns = new Set(
          mysql(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = '${table}';`
          )
        );
        const columns = allColumns.filter((column) =>
          sourceColumns.has(column.name)
        );
        const missing = allColumns.filter(
          (column) => !sourceColumns.has(column.name)
        );
        if (missing.length) {
          skipped.push(
            `${table}: ${missing.map((column) => column.name).join(', ')} (not in MySQL)`
          );
        }

        const lines = mysql(
          `SELECT JSON_OBJECT(${columns.map((column) => `'${column.name}', \`${column.name}\``).join(', ')}) FROM \`${table}\`;`
        );
        const names = columns.map((column) => `"${column.name}"`).join(', ');
        const BATCH = 200;
        for (let start = 0; start < lines.length; start += BATCH) {
          const batch = lines
            .slice(start, start + BATCH)
            .map((line) => JSON.parse(line) as Record<string, unknown>);
          const params: unknown[] = [];
          const values = batch.map(
            (row) =>
              `(${columns
                .map((column) => {
                  params.push(pgValue(column, row[column.name]));
                  return `$${params.length}::${pgCast(column)}`;
                })
                .join(', ')})`
          );
          await tx.$executeRawUnsafe(
            `INSERT INTO "${table}" (${names}) VALUES ${values.join(', ')}`,
            ...params
          );
        }
        copied.push(`${table}: ${lines.length}`);
      }
    },
    { timeout: 10 * 60 * 1000, maxWait: 30_000 }
  );

  console.log('Copied rows:');
  for (const line of copied) console.log(`  · ${line}`);
  if (skipped.length) {
    console.log('Not copied:');
    for (const line of skipped) console.log(`  · ${line}`);
  }
  console.log('✔ MySQL data copied into PostgreSQL');
};

await main()
  .catch((error) => {
    console.error(`✖ ${(error as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
