# @lemma/ui

Shared React UI components and styling primitives.

## Main Surface

- reusable UI components under `src/components`
- shared style helpers

## Used By

- web app
- admin app
- Keycloak theme

## Commands

```bash
pnpm --filter @lemma/ui build
pnpm --filter @lemma/ui check-types
pnpm --filter @lemma/ui lint
```

## Notes

Keep components generic. Domain-specific UI should stay in the consuming app.
