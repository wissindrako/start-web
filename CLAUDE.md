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

## Module structure

See the [Creating a new module](README.md#creating-a-new-module) section in README.md for the step-by-step guide.
