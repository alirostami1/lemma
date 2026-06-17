# @lemma/events

Transactional outbox and event envelope package.

## Main Surface

- outbox service
- event envelope primitives
- repository ports and infrastructure adapters

## Used By

- API modules that publish durable events
- worker outbox processing

## Commands

```bash
pnpm --filter @lemma/events build
pnpm --filter @lemma/events test
pnpm --filter @lemma/events lint
```
