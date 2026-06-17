# API app

Hono backend composition root. It wires bounded-context modules, HTTP routes,
authentication, realtime access, storage, and health endpoints.

## Uses

- `@lemma/identity`, `@lemma/files`, `@lemma/questions`, `@lemma/workbook`
- `@lemma/notifications`, `@lemma/ops`, `@lemma/db`
- Keycloak for OIDC/JWKS
- Postgres, object storage, Centrifugo, workbook engine

## Commands

```bash
pnpm --filter api dev
pnpm --filter api build
pnpm --filter api test
pnpm --filter api check-types
```

## Notes

This app should compose package APIs. Domain behavior belongs in packages.
