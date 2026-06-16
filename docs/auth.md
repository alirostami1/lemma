# Auth and User Bootstrap

## Token to User Flow

`CurrentUserService.fromAccessToken` is the only application path that turns an
OIDC access token into a local current user.

1. `IdentityProvider.verifyAccessToken` verifies the token and returns a
   `VerifiedIdentity`.
2. `IdentityService.getActiveUserFromIdentity` finds or creates the local user
   by `VerifiedIdentity.identityId`.
3. `IdentityService.listUserRolesForAuthentication` loads role grants from the
   database.
4. `createCurrentUser` derives authorization flags from database role grants.

OIDC token roles, usernames, and emails do not grant application permissions.
Application authorization is explained by rows in `user_roles`.

## IDs

- `users.identity_id` stores the OIDC `sub` value. It is an external identity ID
  and may be any non-empty provider subject string.
- `users.id` is an app-owned UUIDv7. It is the ID other domain packages should
  reference for ownership, audit, jobs, notifications, and lineage.
- Do not assume `users.id` and `users.identity_id` are equal.

## Dev Seed Users

`pnpm db:seed:dev` seeds local users for the Keycloak dev realm:

| Login | Email | Local Role |
| --- | --- | --- |
| `test` | `test@example.com` | `member` |
| `admin` | `admin@example.com` | `admin` |

The seed script maps the fixed Keycloak user IDs from `infra/keycloak-realm.json`
to separate local UUIDv7 user IDs. Re-running the seed updates profile fields and
role grants by `identity_id`; it does not rewrite existing local user IDs.

## Production Rules

- New users are bootstrapped only from a verified identity provider token.
- Admin access comes from an explicit database role grant.
- No application code should infer roles from email, username, Keycloak realm
  roles, or client roles.
- Disabling or deleting a user in the application must continue to block auth
  even when the identity provider token remains valid.
