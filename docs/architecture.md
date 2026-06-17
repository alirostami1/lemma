# Architecture

Lemma is a web application organized as a pnpm/Turbo workspace. Apps compose
package modules; packages own domain logic, infrastructure adapters, generated
HTTP contracts, or shared UI.

## Package Direction

```mermaid
flowchart TB
  Apps[apps/*] --> Packages[packages/* public exports]
  Packages --> Shared[config, domain, error, http, observability]
  Bounded[identity, files, questions, workbook, notifications, events, jobs, ops] --> DB[db]
  Questions[questions] --> Workbook[workbook]
  Workbook --> Engine[workbook-engine]
  APIContract[api-contract] --> OpenAPI[OpenAPI fragments]
  OpenAPIGen[openapi-hono-generator] --> HonoGen[src/gen/hono]
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
  API->>Questions: Validate request
  Questions->>DB: Save run
  Questions->>Events: Write outbox event
  Worker->>Events: Poll outbox
  Worker->>Questions: Execute generation
  Questions->>Workbook: Resolve workbook values
  Questions->>DB: Store generated questions
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
  API->>Workbook: Register source
  Workbook->>Engine: Inspect or calculate workbook
  Engine-->>Workbook: Values and findings
  Workbook-->>API: Persist sanitized snapshot values
  Web->>API: Read bounded snapshot preview
```

## OpenAPI Generation Flow

```mermaid
flowchart LR
  Packages[package openapi/openapi.ts] --> Contract[api-contract]
  Packages --> Orval[orval]
  Orval --> Types[src/gen/types]
  Orval --> Zod[src/gen/zod]
  HonoGen[openapi-hono-generator] --> Hono[src/gen/hono]
  Contract --> WebClient[apps/web/src/api/generated]
```
