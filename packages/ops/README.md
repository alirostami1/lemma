# @lemma/ops

Operational bounded context for admin and support views over queues, outbox
events, and system state.

## Main Surface

- operational repositories
- OpenAPI fragment
- generated Hono route helpers

## Used By

- API app
- admin app

## Commands

```bash
pnpm --filter @lemma/ops build
pnpm --filter @lemma/ops generate:openapi
pnpm --filter @lemma/ops lint
```

## Generated Files

See [Generated Files](../../docs/generated-files.md) for ownership and
regeneration commands.
