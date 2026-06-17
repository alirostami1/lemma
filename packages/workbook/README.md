# @lemma/workbook

Workbook bounded context for uploaded workbook sources, snapshots, validation,
and calculation orchestration.

## Main Surface

- workbook and snapshot domain models
- workbook services and policies
- calculation request adapters
- HTTP handlers and generated Hono route helpers
- OpenAPI fragment

## Snapshot Values

Workbook values are backend-owned. The worker stores sanitized sparse snapshot
values after inspection/calculation, and Studio reads bounded preview windows
through workbook APIs. Normal source selection does not download or parse the
original workbook in the browser.

## Used By

- API app
- worker app
- questions package
- web workbook flows

## Commands

```bash
pnpm --filter @lemma/workbook build
pnpm --filter @lemma/workbook test
pnpm --filter @lemma/workbook generate:openapi
```

## Generated Files

See [Generated Files](../../docs/generated-files.md) for ownership and
regeneration commands.
