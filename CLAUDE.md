# Claude Code — Project Instructions

## Before every commit

Always run `pnpm lint` before committing. If there are errors, fix them first, then commit.

```bash
pnpm lint
```

- `lint:eslint` — ESLint with auto-fix (`eslint ./src --fix`)
- `lint:ts` — TypeScript type check (`tsc --noEmit`)

If TypeScript errors are found, fix them before proceeding with the commit.
