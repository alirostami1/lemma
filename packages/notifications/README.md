# @lemma/notifications

Realtime notification bounded context.

## Main Surface

- realtime auth service
- notification channel domain model
- HTTP routes for realtime authorization

## Used By

- API app
- web realtime flows
- Centrifugo integration

## Commands

```bash
pnpm --filter @lemma/notifications build
pnpm --filter @lemma/notifications test
pnpm --filter @lemma/notifications lint
```
