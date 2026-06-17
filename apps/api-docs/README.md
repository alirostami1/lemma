# API docs app

Static API documentation app for the composed OpenAPI contract.

## Uses

- `@lemma/api-contract` for the composed contract
- Vite for the docs shell

## Commands

```bash
pnpm --filter api-docs dev
pnpm --filter api-docs build
pnpm --filter api-docs lint
```

## Notes

If endpoint docs are wrong, fix package OpenAPI fragments first.
