import { Prisma } from './generated/client';

/**
 * Better Auth keeps several OAuth fields as lists (scopes, redirect URIs,
 * grant types…). On MySQL its Prisma adapter wrote them as JSON text; on
 * PostgreSQL it assumes native arrays and sends them as they are. The columns
 * stay as text (see CLAUDE.md, "Moving the database from MySQL to
 * PostgreSQL"), so this does what the adapter did on MySQL: lists are written
 * as JSON and read back as lists, or as null when the column is empty.
 *
 * Native arrays (String[]) would not work: Better Auth sends null for an
 * unset list, which Prisma refuses in an array column, and Prisma reads an
 * empty array as [], which Better Auth takes as "nothing allowed" instead of
 * "use the defaults".
 */
const LIST_FIELDS = {
  oauthClient: [
    'scopes',
    'clientCredentialsScopes',
    'contacts',
    'redirectUris',
    'postLogoutRedirectUris',
    'grantTypes',
    'responseTypes',
  ],
  oauthResource: ['allowedScopes'],
  oauthRefreshToken: ['resources', 'requestedUserInfoClaims', 'scopes'],
  oauthAccessToken: ['resources', 'requestedUserInfoClaims', 'scopes'],
  oauthConsent: ['resources', 'requestedUserInfoClaims', 'scopes'],
} as const;

type ListModel = keyof typeof LIST_FIELDS;

/** A stored list: JSON text, or (older rows) comma separated */
export const parseList = (value: unknown): string[] | null => {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) return value.map(String);
  const text = String(value);
  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // Not JSON: a plain list
  }
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const serialize = (model: ListModel, data: unknown): unknown => {
  if (Array.isArray(data)) return data.map((row) => serialize(model, row));
  if (!data || typeof data !== 'object') return data;
  const row = { ...(data as Record<string, unknown>) };
  for (const field of LIST_FIELDS[model]) {
    const value = row[field];
    if (Array.isArray(value)) row[field] = JSON.stringify(value);
    else if (
      value &&
      typeof value === 'object' &&
      Array.isArray((value as { set?: unknown }).set)
    ) {
      row[field] = { set: JSON.stringify((value as { set: unknown[] }).set) };
    }
  }
  return row;
};

const WRITES = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
]);

/** Result field that reads a stored list back as a list */
const listField = <K extends string>(name: K) => ({
  needs: { [name]: true } as { [P in K]: true },
  compute: (row: { [P in K]: string | null }) => parseList(row[name]),
});

const tokenLists = {
  resources: listField('resources'),
  requestedUserInfoClaims: listField('requestedUserInfoClaims'),
  scopes: listField('scopes'),
};

export const oauthLists = Prisma.defineExtension({
  name: 'oauth-lists-as-json-text',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const key = (model.charAt(0).toLowerCase() +
          model.slice(1)) as ListModel;
        if (!(key in LIST_FIELDS) || !WRITES.has(operation)) {
          return query(args);
        }
        const next = { ...(args as Record<string, unknown>) };
        if ('data' in next) next.data = serialize(key, next.data);
        if ('create' in next) next.create = serialize(key, next.create);
        if ('update' in next) next.update = serialize(key, next.update);
        return query(next as typeof args);
      },
    },
  },
  result: {
    oauthClient: {
      scopes: listField('scopes'),
      clientCredentialsScopes: listField('clientCredentialsScopes'),
      contacts: listField('contacts'),
      redirectUris: listField('redirectUris'),
      postLogoutRedirectUris: listField('postLogoutRedirectUris'),
      grantTypes: listField('grantTypes'),
      responseTypes: listField('responseTypes'),
    },
    oauthResource: { allowedScopes: listField('allowedScopes') },
    oauthRefreshToken: tokenLists,
    oauthAccessToken: tokenLists,
    oauthConsent: tokenLists,
  },
});
