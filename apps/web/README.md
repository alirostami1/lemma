# Web app

Main user-facing application for authoring question generators, managing
workbooks, generating question sets, and playing or reviewing questions.

## Uses

- TanStack Router and TanStack Query
- generated API client in `src/api/generated`
- `@lemma/ui` for shared components
- Keycloak OIDC public client

## Commands

```bash
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web test
pnpm --filter web generate:client
```

## Generated Files

See [Generated Files](../../docs/generated-files.md) for ownership and
regeneration commands.
