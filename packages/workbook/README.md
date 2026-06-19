# @lemma/workbook

Workbook bounded context for blueprint-attached workbook assets, snapshots,
validation, and calculation orchestration.

## Main Surface

- workbook and snapshot domain models
- workbook services and policies
- calculation request adapters
- HTTP handlers and generated Hono route helpers
- OpenAPI fragment

## Snapshot Values

Workbook values are backend-owned. The worker stores sanitized sparse snapshot
values after inspection/calculation, and Studio reads bounded preview windows
through workbook APIs. Studio does not expose a global workbook source chooser;
workbooks are attached from inside a blueprint workflow and are surfaced only
through that blueprint/package context.

Public snapshot responses do not expose the full sparse value payload. Callers
use metadata for snapshot status, paginated sheet lists for sheet details, cells
for bounded displayed sheet windows, range for bounded selections, and value
resolution for single references.

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
