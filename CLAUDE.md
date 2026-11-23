# Claude Code — Project Instructions

## Before every commit

Run `pnpm lint` once, just before committing. Do NOT run it after every individual change.

```bash
pnpm lint
```

- `lint:eslint` — ESLint with auto-fix (`eslint ./src --fix`)
- `lint:ts` — TypeScript type check (`tsc --noEmit`)

If TypeScript errors are found, fix them before proceeding with the commit.

## Known pitfalls

### Base UI Select — label shows value/ID after selection

`@base-ui/react` `Select.Value` resolves display labels from an internal item registry that is only populated while `SelectContent` is open. When the dropdown closes and items unmount, the registry clears and the component falls back to the raw value (e.g. a database ID).

**Fix:** always pass the computed label as `children` to `SelectValue` directly — never rely on the item registry for display:

```tsx
<SelectValue placeholder={t('filterPlaceholder')}>
  {selectedId
    ? (items.find((i) => i.id === selectedId)?.name ?? selectedId)
    : undefined}
</SelectValue>
```

### URL search params — clearing optional filters

When a filter Select has an "all / show everything" option, give it `value=""`. Then use `value || undefined` when writing to the search params so the key is removed from the URL instead of set to an empty string:

```tsx
<SelectItem value="">{t('allItems')}</SelectItem>
// ...
onValueChange={(v) => setSearch({ ...search, filterId: v || undefined })}
```

### `WithPermissions` + absolute-positioned overlay links

When a `Card` contains a full-card `<span className="absolute inset-0" />` link overlay AND separate icon buttons, wrap the icon buttons in a `relative z-10 flex` container so they sit above the overlay and remain individually clickable.

### Moving the database from MySQL to PostgreSQL — Better Auth OAuth lists

Better Auth stores several OAuth fields as lists (scopes, redirect URIs, grant types, allowed scopes…). The Prisma columns are `String?` (JSON text).

- **MySQL:** Better Auth's Prisma adapter serializes those lists to JSON text (`'["openid","profile"]'`) because MySQL has no arrays. Works.
- **PostgreSQL:** the adapter assumes native arrays and sends them as-is (`["openid","profile"]`). With text columns Prisma rejects them: `Argument scopes: Expected String or Null, provided (String, String, ...)`.

**Do not switch those columns to native Postgres arrays (`String[]`).** It fails in two ways:

1. Better Auth sends `null` for a list with no value and Prisma does not accept `null` in a list: `Argument allowedScopes must not be null`.
2. Worse, Prisma always reads an empty list as `[]`, never `null`. For Better Auth `null` means "use the defaults" and `[]` means "none allowed", so OAuth clients would silently end up with no scopes.

**Fix (applied here on 10/11/2026, when nucleo-admin moved to PostgreSQL):** keep the columns as text, as in MySQL, and add a Prisma client extension (`src/server/db/oauth-lists.ts`) that does what the adapter did on MySQL: on write, serialize lists to JSON; on read, parse them back to lists, or `null` when empty. Better Auth then sees exactly what it saw with MySQL.

### Patched Better Auth: http on the local network (dev only)

`patches/` holds two `pnpm patch` files (`patchedDependencies` in `package.json`) so SIGEC's `pnpm red` can sign in
through this PC's LAN IP over plain http (`http://192.168.x.x:3004`):

- `@better-auth/core` — `SafeUrlSchema` (`dist/utils/redirect-uri.mjs`) accepts http redirect URIs off loopback.
- `@better-auth/oauth-provider` — `validateIssuerUrl` keeps an http issuer instead of forcing https.

Both apply **only** when `OAUTH_DEV_ALLOW_HTTP=true` **and** `NODE_ENV !== 'production'`; SIGEC's script sets the
variable only on the dev servers it starts. Without it, behaviour is upstream's. **When upgrading Better Auth**, pnpm
fails if a patch no longer applies: redo it with `pnpm patch <pkg>@<version>` (search for `OAUTH_DEV_ALLOW_HTTP`) or
drop it if upstream gained an option for this. Never set the variable in a deployed `.env`.

## Decisions (database layout)

- **Ids are UUID** (v7 for new rows); migration in progress on branch `feat/uuid-ids`. Old text ids are converted
  with `uuid_generate_v5(URL namespace, old_id)`, so systems that stored an old id can compute the new one.
- **One PostgreSQL schema per domain, with Spanish names** (decided 22/11/2026, modelled on `D:\javascript\rr-hh\rrhh-db`:
  its structure, not its data). After the UUID migration, the current tables move with `ALTER TABLE … SET SCHEMA`:
  - `identidad`: accounts and sessions (Better Auth, OAuth), invitations;
  - `acceso`: external systems, modules, roles, permissions and assignments;
  - `configuracion`: system, access and mail settings;
  - the template's demo tables (book, author, genre, publisher) go to `demo` or are dropped.
- **Human resources, new schemas:**
  - `personal`: the person (stable anchor, like rr-hh's `fun_id`) and their personal data; a person may exist without
    an account, and the account (`identidad.user`) points to the person;
  - `organizacion`: dependencies (tree DGE → unit → area, with validity) and positions (item or temporary post);
  - `movilidad`: assignments person ↔ position (titular, interim, rotation, commission; several at once, with dates),
    movements (HR acts) and delegations; as-of-date functions here, like rr-hh's `movilidad_en_fecha` but returning
    **every** assignment in force, not one per person;
  - `parametrica`: catalogues (bond type, movement type, assignment type).
- SQL functions live in repeatable files `prisma/ddl/R__NN_*.sql` (rr-hh's `ddl/R__*.sql` idea), applied by
  `pnpm db:funciones` (also part of `pnpm db:deploy`). After `prisma migrate dev`, run `pnpm db:funciones` too.
- **HR schemas, role and spreadsheet import are built** (22/11/2026): see `docs/rrhh.md` (roles `RR.HH.` and
  `RR.HH. (consulta)` via `pnpm db:roles`; import via the screen or `pnpm rrhh:importar`). `personal.persona` is the former `personal_data`
  (Prisma model still `PersonalData`); it may exist without an account.
- Open-ended dates are `NULL` (or a `daterange`), never rr-hh's `1900-01-01` sentinel.
- Raw SQL that names tables (SIGECON `scripts/nucleo-sql.ts`, `scripts/movil.mjs`; `prisma/from-mysql.ts`) must use
  schema-qualified names once tables move.

## Module structure

See the [Creating a new module](README.md#creating-a-new-module) section in README.md for the step-by-step guide.
