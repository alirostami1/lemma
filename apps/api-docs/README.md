# API docs app

Static API documentation app for the composed OpenAPI contract.

## Commands

```bash
pnpm --filter api-docs dev
pnpm --filter api-docs build
pnpm --filter api-docs lint
```

## Notes

`api-docs` uses a Vite virtual module (`virtual:lemma-openapi`) populated in
`vite.config.js` from `@lemma/api-contract/source`.
The Vite commands use `--configLoader runner` so the config can import this
source-only TypeScript workspace package.

If endpoint docs are wrong, fix package OpenAPI fragments first.
