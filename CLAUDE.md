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

**Fix (proven in a MySQL → Postgres migration on 10/11/2026):** keep the columns as text, as in MySQL, and add a Prisma client extension (`src/server/db/oauth-lists.ts`) that does what the adapter did on MySQL: on write, serialize lists to JSON; on read, parse them back to lists, or `null` when empty. Better Auth then sees exactly what it saw with MySQL.

## Module structure

See the [Creating a new module](README.md#creating-a-new-module) section in README.md for the step-by-step guide.
