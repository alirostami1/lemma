# @lemma/identity

Identity bounded context for users, roles, and Keycloak-backed identity
operations.

## Main Surface

- current-user and identity application services
- Keycloak identity provider adapter
- HTTP handlers and generated Hono route helpers
- OpenAPI fragment

## Used By

- API app
- admin app workflows
- auth-aware domain services

## Commands

```bash
pnpm --filter @lemma/identity build
pnpm --filter @lemma/identity test
pnpm --filter @lemma/identity generate:openapi
```

## Generated Files

See [Generated Files](../../docs/generated-files.md) for ownership and
regeneration commands.
