# Admin app

Admin UI for operational and identity workflows.

## Uses

- generated API access through the backend
- `@lemma/ui` for shared components
- Keycloak OIDC public client

## Commands

```bash
pnpm --filter admin dev
pnpm --filter admin build
pnpm --filter admin test
pnpm --filter admin check:types
```

## Notes

Keep admin workflows dense and operational. Avoid duplicating user-facing web
feature logic when package APIs can be shared.
