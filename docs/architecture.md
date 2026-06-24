# Architecture

Lemma is a web application organized as a pnpm/Turbo workspace. Apps compose
package modules; packages own domain logic, infrastructure adapters, generated
HTTP contracts, or shared UI.

Architecture decision records live in [docs/adr](adr/). The draft/source
lifecycle source of truth is
[ADR 0002: Draft-Only Authoring, Immutable Blueprint Versions, and Source Artifact Lifecycle](adr/0002-draft-only-authoring-source-artifacts.md).

## Package Direction

```mermaid
flowchart TB
  Apps[apps/*] --> Packages[packages/* public exports]
  Packages --> Shared[config, domain, error, http, observability]
  Bounded[identity, files, questions, workbook, notifications, events, jobs, ops] --> DB[db]
  Questions[questions] --> Workbook[workbook]
  Workbook --> Engine[workbook-engine]
  APIContract[api-contract] --> OpenAPI[OpenAPI fragments]
  OpenAPIGen[openapi-hono-generator] --> HonoGen[src/generated/hono]
```

Rules:

- apps may compose packages
- packages may import other packages through public exports
- packages must not import another package's `src/*`
- packages must not import another package's `dist/*`
- relative imports must not cross workspace package source roots
- each workspace package must declare imported package dependencies
- new public entry points must be added to `package.json` exports intentionally
- generated files are regenerated, not hand edited

## Runtime Services

```mermaid
flowchart LR
  Browser[Browser] --> Web[web]
  Browser --> Admin[admin]
  Web --> API[api]
  Admin --> API
  Browser --> Keycloak[Keycloak]
  API --> Postgres[(Postgres)]
  API --> Garage[(Garage or S3)]
  API --> Centrifugo[Centrifugo]
  Worker[worker] --> Postgres
  Worker --> Garage
  Worker --> LibreOffice[libreoffice-worker]
  API --> Keycloak
```

## Request And Auth Flow

```mermaid
sequenceDiagram
  participant User
  participant Web
  participant Keycloak
  participant API
  participant Identity

  User->>Web: Open app
  Web->>Keycloak: OIDC login
  Keycloak-->>Web: Token
  Web->>API: Request with bearer token
  API->>Keycloak: Fetch JWKS when needed
  API->>Identity: Resolve user and roles
  API-->>Web: Authorized response
```

## Question Generation Flow

```mermaid
sequenceDiagram
  participant Web
  participant API
  participant Questions
  participant Events
  participant Worker
  participant Workbook
  participant DB

  Web->>API: Create generation run
  API->>Questions: Validate request and freeze blueprint snapshot
  Questions->>DB: Save queued run
  Questions->>Events: Write outbox event
  Worker->>Events: Poll outbox
  Worker->>Questions: Orchestrate run by id
  Questions->>Workbook: Request one multi-source calculation
  Workbook->>DB: Persist source/question snapshots
  Worker->>Questions: Materialize from run snapshot and snapshot metadata
  Questions->>DB: Store durable questions and private lineage
```

## Workbook Flow

```mermaid
sequenceDiagram
  participant Web
  participant API
  participant Files
  participant Workbook
  participant Engine
  participant Storage

  Web->>API: Request upload URL
  API->>Files: Create upload
  Files->>Storage: Sign object operation
  Web->>Storage: Upload workbook
  Web->>API: Create workbook
  API->>Workbook: Register workbook
  Workbook->>Engine: Inspect or calculate workbook
  Engine-->>Workbook: Values and findings
  Workbook-->>API: Persist sanitized snapshot values
  Web->>API: Read bounded snapshot preview
```

Generation workers load persisted state by id. Workbook jobs carry only the
calculation id and operation lineage. Materialization validates snapshots by
calculation, source slot, workbook binding, and question index; event and row
order are never authoritative.

## OpenAPI Generation Flow

```mermaid
flowchart LR
  Packages[package openapi/openapi.ts] --> Contract[api-contract]
  Packages --> Orval[orval]
  Orval --> Types[src/generated/types]
  Orval --> Zod[src/generated/zod]
  HonoGen[openapi-hono-generator] --> Hono[src/generated/hono]
  Contract --> WebClient[apps/web/src/api/generated]
```
