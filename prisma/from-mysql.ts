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

// Ids are UUID columns now. Old MySQL ids (cuid) are converted exactly as the
// uuid_ids migration does, so ids and foreign keys keep matching:
// uuid_generate_v5(URL namespace, old id).
const UUID_NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
// Fixed id of the rows that hold the center settings
const SINGLETON_TABLES = new Set([
  'system_config',
  'access_settings',
  'mail_settings',
]);
const SINGLETON_ID = '00000000-0000-0000-0000-000000000001';
const uuidValue = (parameter: string, singletonColumn: boolean) =>
  `(CASE ${
    singletonColumn
      ? `WHEN ${parameter} = 'singleton' THEN '${SINGLETON_ID}'::uuid `
      : ''
  }WHEN ${parameter} ~* '^[0-9a-f-]{36}$' THEN ${parameter}::uuid
    ELSE uuid_generate_v5('${UUID_NAMESPACE}'::uuid, ${parameter}) END)`;

const main = async () => {
  const sourceTables = new Set(
    mysql(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE';"
    )
  );

  // Tables live in one schema per domain (identidad, acceso, …); MySQL had
  // them all in one database, so they are matched by table name
  const rows = await db.$queryRaw<
    {
      schema: string;
      table: string;
      column: string;
      type: string;
      udt: string;
    }[]
  >`SELECT table_schema AS "schema", table_name AS "table", column_name AS "column", data_type AS "type", udt_name AS "udt"
    FROM information_schema.columns
    WHERE table_schema IN ('identidad', 'acceso', 'configuracion', 'demo')
    ORDER BY table_name, ordinal_position`;
  const targetTables = new Map<string, Column[]>();
  const schemaOf = new Map<string, string>();
  for (const row of rows) {
    const columns = targetTables.get(row.table) ?? [];
    columns.push({ name: row.column, type: row.type, udt: row.udt });
    targetTables.set(row.table, columns);
    schemaOf.set(row.table, row.schema);
  }
  const qualified = (table: string) => `"${schemaOf.get(table)}"."${table}"`;

  const [{ count } = { count: 0n }] = await db.$queryRaw<
    { count: bigint }[]
  >`SELECT count(*) AS count FROM identidad."user"`;
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
          `TRUNCATE ${[...targetTables.keys()].map(qualified).join(', ')} CASCADE`
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
                  const parameter = `$${params.length}`;
                  return column.udt === 'uuid'
                    ? uuidValue(
                        parameter,
                        column.name === 'id' && SINGLETON_TABLES.has(table)
                      )
                    : `${parameter}::${pgCast(column)}`;
                })
                .join(', ')})`
          );
          await tx.$executeRawUnsafe(
            `INSERT INTO ${qualified(table)} (${names}) VALUES ${values.join(', ')}`,
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
