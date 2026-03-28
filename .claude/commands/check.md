# Check

Run all quality checks: ESLint, TypeScript type check, and Prettier format check.

```bash
pnpm lint && pnpm prettier --check "src/**/*.{ts,tsx,json}"
```

If there are errors:
1. For lint/type errors: analyze and fix them
2. For formatting errors: run `pnpm prettier --write "src/**/*.{ts,tsx,json}"` to auto-fix
3. Re-run checks to confirm everything passes
