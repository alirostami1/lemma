# Project Structure

Lemma is a web application implemented as a pnpm/Turbo TypeScript workspace.
Apps compose bounded-context packages; packages own domain logic,
infrastructure adapters, generated HTTP contracts, or shared UI.

## Main Directories

```text
apps/
  api/              Hono API composition root
  web/              user-facing app
  admin/            admin app
  worker/           background worker runtime
  api-docs/         API documentation app
  keycloak-theme/   Keycloak login theme
  libreoffice-worker/

packages/
  identity/         users, roles, Keycloak integration
  files/            upload and object storage lifecycle
  workbook/         workbook sources, snapshots, calculations
  workbook-engine/  workbook inspection and calculation helpers
  questions/        blueprints, question sets, generation, grading
  events/           transactional outbox
  jobs/             background queue dispatch
  notifications/    realtime notification/auth support
  ops/              operational views and repair actions
  db/               migrations and generated Kysely types
  http/             shared HTTP/OpenAPI helpers
  ui/               shared React UI primitives
  api-contract/     composed OpenAPI contracts
  openapi-hono-generator/

infra/              local Compose infrastructure
docs/               architecture, workflow, operations docs
```

## Commands

Command references live in focused docs:

- [Testing](testing.md)
- [Operations](operations.md)
- [Infrastructure](infra.md)

## Backend Shape

Most backend packages follow this layout:

```text
src/domain/          business rules and invariants
src/application/     orchestration, policies, ports
src/infrastructure/  Kysely and external adapters
src/http/            handlers, presenters, route binding
src/generated/             generated OpenAPI/Hono/Zod output
openapi/             package OpenAPI fragment
```

Domain code must not know about persistence, HTTP, generated code, storage,
Keycloak, or runtime adapters. See [Domain Package Guidelines](domain-packages-guidlines.md).

## Frontend Shape

The web app keeps generated API code isolated:

```text
apps/web/src/api/generated     generated Orval client and DTOs
apps/web/src/domains/*         app models, mappers, API wrappers
apps/web/src/features/*        UI workflows and route controllers
apps/web/src/components/*      app-level reusable UI
packages/ui                   shared UI primitives
```

Feature components should consume app/domain models, not generated DTOs. See
[Frontend Guidelines](frontend-guidlines.md).

## Generated Files

Generated-output ownership and commands live in
[Generated Files](generated-files.md).

## Architecture Diagrams

See [Architecture](architecture.md) for Mermaid diagrams covering:

- package direction
- runtime services
- auth flow
- question generation flow
- workbook flow
- OpenAPI generation flow

## Where To Edit

- API composition: `apps/api/src`
- web app UI: `apps/web/src/features`
- admin UI: `apps/admin/src`
- question domain rules: `packages/questions/src/domain`
- question workflows: `packages/questions/src/application`
- workbook domain rules: `packages/workbook/src/domain`
- workbook engine behavior: `packages/workbook-engine/src`
- file upload/storage behavior: `packages/files/src`
- identity and roles: `packages/identity/src`
- migrations: `packages/db/src/migrations`
- shared UI primitives: `packages/ui/src`
- generated Hono route generator: `packages/openapi-hono-generator`

## Change Checklist

- Keep package boundaries intact.
- Update the owning package README when purpose or public surface changes.
- Regenerate code instead of editing generated output.
- Add focused tests near changed behavior.
- Run the validation command from [Testing](testing.md) before PR.
