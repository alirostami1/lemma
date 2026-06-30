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

Web currently uses Vite/Vitest `resolve.conditions: ["source"]` as a deliberate
issue #129 experiment to avoid building workspace packages for web
tests/dev/build.
This is guarded by direct import-boundary checks and the public
`@lemma/questions/inline-blueprint` leaf export; web may not import broader
questions or server/node package surfaces.

## Generated Files

See [Generated Files](../../docs/generated-files.md) for ownership and
regeneration commands.
