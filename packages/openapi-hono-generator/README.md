# @lemma/openapi-hono-generator

Code generator that creates typed Hono route helpers from OpenAPI
operations.

## Main Surface

- generator API for package Orval hooks

## Used By

- package `orval.config.ts` files
- generated `src/gen/hono` route helpers

## Commands

```bash
pnpm --filter @lemma/openapi-hono-generator build
pnpm --filter @lemma/openapi-hono-generator test
pnpm --filter @lemma/openapi-hono-generator lint
```

## Notes

Generated output should be changed by improving the generator, not by editing
generated files.
