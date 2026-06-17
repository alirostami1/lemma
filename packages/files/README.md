# @lemma/files

File upload and object storage bounded context.

## Main Surface

- file and upload domain model
- file lifecycle application services
- HTTP handlers and generated Hono route helpers
- OpenAPI fragment

## Used By

- API app
- workbook flows
- web upload flows

## Commands

```bash
pnpm --filter @lemma/files build
pnpm --filter @lemma/files test
pnpm --filter @lemma/files generate:openapi
```

## Generated Files

See [Generated Files](../../docs/generated-files.md) for ownership and
regeneration commands.
