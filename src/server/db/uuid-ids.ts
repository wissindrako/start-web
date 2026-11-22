import { createHash } from 'node:crypto';

import { Prisma } from './generated/client';

/**
 * All ids are UUID columns. Better Auth generates them with
 * `crypto.randomUUID()` (see src/server/auth.tsx), except for two single-use
 * rows whose id is derived from the value they guard: OAuth client assertions
 * (jti) and verification reservations. With a custom id generator Better Auth
 * encodes those digests as base64url, which does not fit a uuid column.
 *
 * Convert them to a UUID v5 with the same namespace as the uuid_ids migration,
 * so the value stays deterministic and a replayed assertion still collides on
 * the primary key.
 */
const UUID_NAMESPACE = Buffer.from('6ba7b8119dad11d180b400c04fd430c8', 'hex');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const asUuid = (value: string) => {
  if (UUID.test(value)) return value;
  const bytes = Buffer.from(
    // eslint-disable-next-line sonarjs/hashing -- UUID v5 is defined with SHA-1; this is not a security hash
    createHash('sha1')
      .update(UUID_NAMESPACE)
      .update(value, 'utf8')
      .digest()
      .subarray(0, 16)
  );
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// Prisma model names ($allOperations receives them in PascalCase)
const FORCED_ID_MODELS = new Set(['Verification', 'OauthClientAssertion']);
const WRITES = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'upsert',
]);

const normalizeIdValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeIdValue);
  return typeof value === 'string' ? asUuid(value) : value;
};

const normalizeData = (data: unknown): unknown => {
  if (Array.isArray(data)) return data.map(normalizeData);
  if (!data || typeof data !== 'object') return data;
  const row = { ...(data as Record<string, unknown>) };
  if ('id' in row) row.id = normalizeIdValue(row.id);
  return row;
};

// The adapter turns Better Auth's where clauses into `{ id: { equals: value } }`
const normalizeWhere = (where: unknown): unknown => {
  if (!where || typeof where !== 'object' || Array.isArray(where)) return where;
  const row = { ...(where as Record<string, unknown>) };
  if (!('id' in row)) return row;
  const value = row.id;
  if (typeof value === 'string' || Array.isArray(value)) {
    row.id = normalizeIdValue(value);
  } else if (value && typeof value === 'object') {
    const filter = { ...(value as Record<string, unknown>) };
    for (const operator of ['equals', 'in', 'notIn', 'not']) {
      if (operator in filter) {
        filter[operator] = normalizeIdValue(filter[operator]);
      }
    }
    row.id = filter;
  }
  return row;
};

/** Prisma query args with a Better Auth forced id rewritten as a UUID */
export const normalizeIdArgs = <T>(
  model: string,
  operation: string,
  args: T
): T => {
  if (!FORCED_ID_MODELS.has(model)) return args;
  const next = { ...(args as Record<string, unknown>) };
  if (WRITES.has(operation)) {
    if ('data' in next) next.data = normalizeData(next.data);
    if ('create' in next) next.create = normalizeData(next.create);
    if ('update' in next) next.update = normalizeData(next.update);
  }
  if ('where' in next) next.where = normalizeWhere(next.where);
  return next as T;
};

export const deterministicIds = Prisma.defineExtension({
  name: 'deterministic-ids-as-uuid',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        return query(normalizeIdArgs(model, operation, args));
      },
    },
  },
});
