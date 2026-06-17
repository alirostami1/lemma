# Lemma Codebase Summary and Structure for LLM Agents

## 1. Project summary

Lemma is a TypeScript pnpm/Turbo monorepo for creating, saving, and generating question sets from reusable question generators. The product currently focuses on a visual question authoring studio where users compose questions from blocks, bind parts of those questions to workbook values, save the result as a generator, and generate multiple questions from workbook snapshots.

The system has four main runtime surfaces:

1. `apps/web`: React/TanStack frontend for authoring generators, uploading/selecting workbook sources, and viewing question sets.
2. `apps/admin`: React/Vite admin console for operational views and actions.
3. `apps/api`: Hono backend API that composes bounded-context modules.
4. `apps/api-docs`: Scalar/Vite app for API documentation from the composed OpenAPI contract.

The core business packages live under `packages/*`. Important bounded contexts are:

* `@lemma/identity`
* `@lemma/files`
* `@lemma/workbook`
* `@lemma/questions`

Each major backend bounded-context package follows the same layered structure:

```txt
src/domain          Pure domain models, IDs, invariants, state transitions
src/application     Use cases, services, policies, ports, DTO mapping
src/http            Hono routes, handlers, presenters, HTTP error mapping
src/infrastructure  Kysely repositories and external adapters
src/gen             Generated OpenAPI/Hono/Zod/types output
src/module.ts       Composition root for that bounded context
```

Do not put infrastructure, HTTP, database, storage, Keycloak, generated API, or React concerns into `src/domain`.

---

## 2. Monorepo structure

```txt
apps/
  api/              Main Hono API server
  admin/            Admin/operations frontend app
  web/              Main frontend app
  api-docs/         API reference/docs app

packages/
  api-contract/     Composes OpenAPI fragments from bounded contexts
  config/           Shared environment schemas/config parsing
  db/               Kysely database setup and migrations
  domain/           Shared pure primitives such as branded IDs / JSON helpers
  error/            Shared error primitives
  files/            File upload/download bounded context
  http/             Shared HTTP/OpenAPI helpers
  identity/         User/role/current-user bounded context
  openapi-hono-generator/
                    Internal code generator package
  questions/        Question sets, blueprints, generated questions, grading
  typescript-config/
                    Shared TS config
  ui/               Shared Radix/shadcn-style UI components
  workbook/         Workbook records, validation, calculations, snapshots
  workbook-engine/  XLSX/cache/LibreOffice workbook calculation runtime

infra/
  compose-apps.yml
  compose-dev.yml
  compose-keycloak.yml
  compose-libreoffice-worker.yml
  compose-observability.yml
  compose-realtime.yml
  garage/
  grafana/
  keycloak-realm.json
  otel/
  prometheus/
```

Root commands are managed through Turbo:

```bash
pnpm build
pnpm dev
pnpm dev:env
pnpm test
pnpm check-types
pnpm check
pnpm lint
pnpm format
pnpm db:migrate
pnpm infra:config
pnpm infra:dev
pnpm infra:up
pnpm infra:down
```

`pnpm check` runs package-boundary and app architecture checks before package
Biome checks. `pnpm lint` remains available for lint-only diagnostics. Use
`pnpm check:architecture` when you only need those import-boundary checks.

The repo uses Node `>=22` and pnpm.
Infrastructure scripts use `podman compose`.

---

## 3. Backend app composition

The API entrypoint is `apps/api`.

Important files:

```txt
apps/api/src/index.ts       Starts the Hono server
apps/api/src/app.ts         Composes all backend modules
apps/api/src/auth.ts        Bearer-token auth middleware
apps/api/src/config.ts      API/env config
apps/api/src/database.ts    Kysely/Postgres connection
apps/api/src/errors.ts      Global error/not-found handlers
apps/api/src/health.ts      Health endpoint
```

`newApp()` creates a Hono app under `/api`, adds common middleware, then mounts `/api/v1` routes from these modules:

```txt
identityModule.routes
filesModule.routes
workbookModule.routes
questionsModule.routes
```

The backend dependency flow is:

```txt
apps/api
  creates shared clock/id generators/config/db
  creates identity module
  creates files module with S3 storage
  creates workbook module with file provider backed by files module
  creates questions module with workbook ports from workbook module
```

The workbook module exposes application ports used by the questions module:

```txt
workbookAccessPort
workbookCalculationPort
workbookSnapshotResolverPort
workbookInternalSnapshotResolverPort
```

This means questions do not directly know about workbook infrastructure. They call workbook application ports.

---

## 4. Backend bounded contexts

### 4.1 Identity package

Path:

```txt
packages/identity
```

Purpose:

* Current user service
* Identity user records
* Roles and user roles
* Keycloak integration
* Authenticated user policies

Important files:

```txt
src/domain/user.ts
src/domain/role.ts
src/application/CurrentUserService.ts
src/application/IdentityService.ts
src/infrastructure/KeycloakIdentityProvider.ts
src/infrastructure/KyselyIdentityRepository.ts
src/http/routes.ts
src/module.ts
```

The API app uses `KeycloakIdentityProvider` and `CurrentUserService` to resolve access tokens.

---

### 4.2 Files package

Path:

```txt
packages/files
```

Purpose:

* File upload records
* Presigned upload/download URLs
* S3 storage adapter
* File metadata and file content access for other modules

Important files:

```txt
src/domain/file.ts
src/domain/file-upload.ts
src/application/FilesService.ts
src/application/FileContentReader.ts
src/infrastructure/S3FileStorage.ts
src/infrastructure/KyselyFilesRepository.ts
src/module.ts
```

Files currently support workbook files. The frontend creates an upload, uploads to presigned storage, then completes the upload.

---

### 4.3 Workbook package

Path:

```txt
packages/workbook
```

Purpose:

* Workbook records
* Workbook validation
* Workbook calculations
* Workbook snapshots
* Snapshot value resolution
* Ports used by the questions module

Important files:

```txt
src/domain/workbook.ts
src/domain/workbook-calculation.ts
src/domain/workbook-snapshot.ts
src/domain/workbook-values.ts
src/application/WorkbookService.ts
src/application/WorkbookCalculationService.ts
src/application/ports.ts
src/infrastructure/EngineWorkbookCalculator.ts
src/infrastructure/KyselyWorkbookRepository.ts
src/module.ts
```

The workbook module receives a `WorkbookFileProviderPort`, which is implemented in `apps/api/src/app.ts` by delegating to the files module. It creates an `EngineWorkbookCalculator` configured by `LEMMA_WORKBOOK_*` env values.

Workbook values are represented as sparse workbook snapshots:

```ts
type WorkbookSparseValues = {
  sheets: Array<{
    name: string;
    cells: Record<string, string>;
    rowCount: number;
    columnCount: number;
  }>;
};
```

The workbook engine supports cached values and LibreOffice-backed recalculation.

---

### 4.4 Workbook engine package

Path:

```txt
packages/workbook-engine
```

Purpose:

* Low-level workbook inspection and calculation runtime
* XLSX parsing/inspection
* Cached workbook values
* LibreOffice service integration
* Workbook engine errors

Important files:

```txt
src/domain.ts
src/runtime.ts
src/inspection.ts
src/values.ts
src/libreoffice-client.ts
```

`runtime.ts` is the public facade. Inspection, sparse XLSX value parsing, and
LibreOffice worker HTTP behavior live in focused modules.

Key concepts:

```txt
WorkbookEngineName: "cached" | "libreoffice"
WorkbookEngineConfig
WorkbookValues
WorkbookSparseValues
WorkbookEngineError
InvalidWorkbookError
```

Use this package as infrastructure/runtime. Do not make the questions domain depend on workbook-engine internals.

---

### 4.5 Questions package

Path:

```txt
packages/questions
```

Purpose:

* Question sets
* Question blueprints
* Question generation runs
* Generated questions
* Canonical question body/solution/source shapes
* Grading

Important files:

```txt
src/domain/question-set.ts
src/domain/question-blueprint.ts
src/domain/question-blueprint-document.ts
src/domain/question-body.ts
src/domain/question-source.ts
src/domain/question-answer.ts
src/domain/question-generation-run.ts
src/domain/question-grading.ts
src/domain/canonical-validation.ts

src/application/QuestionSetService.ts
src/application/QuestionBlueprintService.ts
src/application/QuestionLibraryService.ts
src/application/QuestionGenerationService.ts
src/application/QuestionGenerationWorkerService.ts
src/application/CanonicalQuestionMaterializer.ts
src/application/QuestionGradingService.ts
src/application/workbook-value-source-adapter.ts
src/application/ports.ts

src/infrastructure/KyselyQuestionsRepository.ts
src/infrastructure/WorkbookQuestionSourceResolver.ts
src/http/routes.ts
src/module.ts
```

Core backend concepts:

```txt
QuestionBlueprintDocument
  Authoring-time blueprint definition.
  May contain references and workbook-backed sources.

QuestionBody
  Rendered/generated question shown to students.
  References should be materialized into display values.

QuestionSolution
  Private answer key / grading rules.

QuestionSourcePlan
  Records where generated values came from.

QuestionGenerationRun
  Tracks bulk generation lifecycle.

QuestionAnswer
  Submitted answer shape.

GradeResult
  Grading output.
```

Question generation flow:

```txt
1. User saves or submits a QuestionBlueprintDocument.
2. QuestionGenerationService starts a generation run.
3. If workbook-backed sources are needed, it requests/uses workbook calculations.
4. CanonicalQuestionMaterializer resolves references into rendered question bodies and solutions.
5. Questions are persisted and optionally attached to a question set.
6. The generation run is marked succeeded or failed.
```

Generation run statuses include states such as queued, waiting for workbook calculation, materializing, succeeded, failed, and cancelled.

---

## 5. Database structure

Database code lives in:

```txt
packages/db
```

Important files:

```txt
src/index.ts
src/migrate.ts
src/types.d.ts
src/migrations/*
```

Main tables created by migrations:

```txt
users
roles
user_roles

file_uploads
files

question_sets
question_set_members
question_blueprints
question_blueprint_versions
question_blueprint_members

workbooks
workbook_calculations
workbook_snapshots

question_generation_runs
questions
question_set_questions
```

Backend repositories use Kysely and should map database rows into domain/application models through proper constructors/reconstitution functions. Do not cast raw DB rows directly into domain objects.

---

## 6. OpenAPI and generated clients

Generator ownership and commands are documented in
[`docs/generated-files.md`](./generated-files.md).

The OpenAPI contract is composed in:

```txt
packages/api-contract/src/openapi.ts
packages/api-contract/src/compose.ts
```

It imports OpenAPI fragments from:

```txt
@lemma/files/openapi
@lemma/identity/openapi
@lemma/ops/openapi
@lemma/questions/openapi
@lemma/workbook/openapi
```

Then it prefixes bounded-context paths with `/api/v1`.

The frontend uses Orval:

```txt
apps/web/orval.config.ts
```

Generated frontend API code goes into:

```txt
apps/web/src/api/generated
```

Generated API code should stay isolated. React feature components should not directly import generated DTO types. Prefer this flow:

```txt
generated API client/types
  → apps/web/src/domains/*/api.ts
  → apps/web/src/domains/*/mappers.ts
  → apps/web/src/domains/*/model.ts
  → features/routes/components
```

---

## 7. Frontend app structure

Path:

```txt
apps/web
```

Tech:

* React
* Vite
* TanStack Router
* TanStack Query
* Orval generated API client
* OIDC SPA auth
* Shared UI package `@lemma/ui`
* Tailwind/Radix-style components
* `xlsx` for local workbook-related frontend behavior

Important top-level files:

```txt
src/router.tsx
src/routeTree.gen.ts
src/routes/*
src/env.ts
src/lib/custom-fetch.ts
src/lib/oidc.ts
src/api/errors.ts
src/api/generated/*
```

Routes are thin and mostly delegate to feature pages.

Current route areas:

```txt
/                                      Dashboard
/create                                Create flow
/studio                                Studio/editor route
/question-sets                         Question sets shell and list
/question-sets/$questionSetId          Question set detail
/question-sets/$questionSetId/questions/$questionId
                                       Generated question detail
```

Compatibility route policy:

* Compatibility routes must have a named owner.
* Compatibility routes must document the reason they exist.
* Compatibility routes must document a removal trigger.
* Compatibility routes should redirect to the canonical route unless a product
  requirement explicitly needs a separate page.

No web compatibility routes are currently documented as active. Product and docs
language should use "question sets".

---

## 8. Frontend domain layer

Frontend domain models live under:

```txt
apps/web/src/domains
```

Main domains:

```txt
domains/files
domains/questions
domains/workbooks
```

Each domain usually has:

```txt
api.ts              Calls generated Orval client
hooks.ts            React Query hooks
keys.ts             Query keys
mappers.ts          DTO → app/domain model conversion
model.ts            Frontend app/domain model
request-mappers.ts  App/domain model → API request conversion
```

### Questions frontend domain

Important files:

```txt
src/domains/questions/model.ts
src/domains/questions/api.ts
src/domains/questions/hooks.ts
src/domains/questions/mappers.ts
src/domains/questions/request-mappers.ts
src/domains/questions/blueprint.ts
src/domains/questions/workbook-reference.ts
src/domains/questions/workbook-preview.ts
src/domains/questions/reference-preview.ts
src/domains/questions/canonical-authoring.ts
src/domains/questions/authoring/*
```

The frontend has its own authoring model that maps to the canonical backend `QuestionBlueprintDocument`.

---

## 9. Authoring model and canonical model

The most important frontend authoring model is:

```txt
apps/web/src/domains/questions/authoring/composed-model.ts
```

Core type:

```ts
type ComposedEditorModel = {
  schemaVersion: 1;
  blocks: ComposedEditorBlock[];
  responseFields: ComposedResponseField[];
  references: ComposedReferenceDraft[];
};
```

Supported block types:

```txt
text
rich_text
response
separator
table
```

Supported reference/source concepts:

```txt
literal
workbook_cell
workbook_range
```

Supported answer value source concepts:

```txt
literal
reference
```

Important authoring files:

```txt
authoring/composed-model.ts
authoring/inline-content.ts
authoring/rich-content.ts
authoring/table-model.ts
authoring/value-source.ts
```

Important mapper:

```txt
domains/questions/canonical-authoring.ts
```

It handles:

```txt
createDefaultQuestionBlueprintDocument()
composedEditorModelToQuestionBlueprintDocument()
questionBlueprintDocumentToComposedEditorModel()
questionBodyToComposedPreviewModel()
tableEditorModelToQuestionBlueprintDocument()
questionBlueprintDocumentToTableEditorModel()
questionBodyToTableBlockPreviewModel()
```

Important constraints:

* The composed editor supports references through explicit inline reference nodes and answer value references.
* Used workbook-backed references are extracted from the authoring model to decide if a workbook source is required.
* Standalone table conversion is more limited than composed documents; reference-backed table content/answers are supported in composed context, not standalone table conversion.
* Rich text currently has limitations around canonical reference nodes; avoid assuming rich text supports every inline reference behavior unless tests say so.

---

## 10. Question studio/frontend flow

The main question authoring page is:

```txt
apps/web/src/features/questions/studio/studio-page.tsx
```

It delegates most state and behavior to:

```txt
apps/web/src/features/questions/studio/use-studio-controller.ts
```

Important studio files:

```txt
studio/studio-command-bar.tsx
studio/studio-readiness.ts
studio/studio-controller-helpers.ts
studio/studio-controller-types.ts
studio/use-studio-controller.ts
studio/use-selected-workbook-preview.ts
studio/use-blueprint-draft-controller.ts
studio/use-studio-blueprint-open-warning.ts
studio/use-studio-local-draft-effects.ts
studio/use-studio-undo-redo-hotkeys.ts
studio/save-blueprint-dialog.tsx
studio/generation/generate-questions-dialog.tsx
studio/generation/generation-status-banner.tsx
studio/source/source-picker-dialog.tsx
studio/source/studio-source-bar.tsx
```

The studio controller owns:

* selected question set
* loaded blueprint
* blueprint name
* current `ComposedEditorModel`
* selected workbook/source
* workbook preview
* save dialog state
* generate dialog state
* active generation run
* readiness issues
* save/generate mutations

Readiness logic lives in:

```txt
studio/studio-readiness.ts
```

It checks things like:

* question set selected
* blueprint name present
* at least one block exists
* at least one answer exists
* reference validity
* workbook-backed sources have ready workbook source
* workbook preview status

Business/readiness logic should stay in pure helpers, not hidden inside JSX button conditions.

---

## 11. Composed question editor

Main path:

```txt
apps/web/src/features/questions/composed-editor
```

Important files:

```txt
composed-question-editor.tsx
composed-question-preview.tsx
block-list.tsx
sortable-block-list.tsx
block-shell.tsx
block-editor.tsx
block-preview.tsx
block-library.tsx
insert-block-menu.tsx
editor-selection.ts
composed-editor-operations.ts
inline-content-renderer.tsx
rich-text-editor.tsx
editor-toolbar.tsx
block-menu.tsx
reference-insertion-controller.ts
```

Inspector files:

```txt
inspector/inspector-panel.tsx
inspector/elements-tab.tsx
inspector/references-tab.tsx
inspector/document-inspector.tsx
inspector/selected-element-inspector.tsx
inspector/block-inspector.tsx
inspector/response-block-inspector.tsx
inspector/table-inspector.tsx
inspector/table-row-inspector.tsx
inspector/table-column-inspector.tsx
inspector/table-cell-inspector.tsx
inspector/reference-editor.tsx
inspector/reference-create-form.tsx
inspector/reference-picker-popover.tsx
inspector/value-expression-input.tsx
```

Editor architecture:

```txt
ComposedQuestionEditor
  owns/render controlled model + selection
  renders block canvas/list
  renders always-visible inspector
  uses operations helpers for model changes
  uses domains/questions/reference-preview.ts for display values
```

Selection should be UI state, not saved in the canonical model.

Expected selection model shape:

```ts
type EditorSelection =
  | { type: "document" }
  | { type: "block"; blockId: string }
  | { type: "table_cell"; blockId: string; cellId: string }
  | { type: "reference"; referenceId: string };
```

When changing the editor, prefer pure model operations and tests first, then wire UI.

---

## 12. Table block editor

Main path:

```txt
apps/web/src/features/questions/table-block-editor
```

Important files:

```txt
table-block-editor.tsx
table-block-preview.tsx
table-canvas.tsx
table-cell-view.tsx
table-context-menu.tsx
table-editor-operations.ts
table-range-operations.ts
table-selection.ts
workbook-input.tsx
```

The table editor should remain visual-first. Users should edit an actual table grid, not implementation tables. Cell/row/column/answer configuration belongs in inspector/context menus.

---

## 13. Workbook/source frontend flow

Relevant files:

```txt
apps/web/src/domains/workbooks/*
apps/web/src/features/workbooks/workbook-upload-form.tsx
apps/web/src/features/workbooks/workbooks-page.tsx
apps/web/src/features/questions/workbook-picker-dialog.tsx
apps/web/src/features/questions/workbook-selection-summary.tsx
apps/web/src/features/questions/workbook-validation.ts
apps/web/src/features/questions/use-workbook-preview.ts
apps/web/src/features/questions/studio/use-selected-workbook-preview.ts
```

Frontend workbook model includes:

```txt
Workbook
WorkbookCalculation
WorkbookSparseValues
WorkbookSnapshot
```

A workbook can be:

```txt
pending_validation
valid
invalid
archived
deleted
```

Question generation uses workbook snapshots/calculations through a source draft that maps to a backend `workbook_snapshot` source.

---

## 14. Authentication/frontend API flow

Auth lives in:

```txt
apps/web/src/lib/oidc.ts
apps/web/src/lib/custom-fetch.ts
```

`oidc.ts` configures OIDC SPA and expected token shape.

`custom-fetch.ts`:

1. Loads OIDC state.
2. Adds `Authorization: Bearer <token>` if logged in.
3. Prefixes requests with `LEMMA_WEB_API_URL`.
4. Parses JSON/text/empty responses.
5. Throws `AppApiError` for non-OK responses.

Generated Orval clients use `authedFetch` as the mutator.

---

## 15. Testing structure

Frontend tests are mostly Vitest and React Testing Library. Many pure authoring helpers already have tests.

Good test targets:

```txt
domains/questions/authoring/*
domains/questions/blueprint.test.ts
features/questions/composed-editor/*
features/questions/table-block-editor/*
features/questions/studio/*
features/workbooks/*
```

Backend package tests use Node test or Vitest depending on package.

Suggested commands:

```bash
pnpm --filter web check-types
pnpm --filter web test

pnpm --filter @lemma/questions check-types
pnpm --filter @lemma/questions test

pnpm --filter @lemma/workbook check-types
pnpm --filter @lemma/workbook test

pnpm --filter @lemma/files check-types
pnpm --filter @lemma/identity check-types

pnpm check-types
pnpm test
```

When changing OpenAPI-backed packages, generated code is refreshed by package scripts such as:

```bash
pnpm --filter @lemma/questions generate:openapi
pnpm --filter @lemma/workbook generate:openapi
pnpm --filter @lemma/files generate:openapi
pnpm --filter @lemma/identity generate:openapi
pnpm --filter web generate
```

Do not manually edit generated files.
Use `pnpm check:generated` to regenerate OpenAPI output and fail if generated
files are stale.

---

## 16. Important architectural rules for future changes

### Frontend dependency direction

Use:

```txt
routes
  → features
    → domains
      → generated API clients
```

Avoid:

```txt
domains → features
features/components/routes → api/generated directly
```

Feature components should generally consume app/domain models from `src/domains/*`, not raw generated DTOs.

### Backend dependency direction

Use:

```txt
domain
  pure business concepts only

application
  use cases, policies, ports, orchestration

infrastructure
  DB/storage/external adapters

http
  route validation, handlers, presenters, HTTP errors

module.ts
  composition root for package
```

Domain must not import DB, Hono, Zod, Keycloak, storage, generated OpenAPI, repositories, or application services.

### Model rules

* Keep one canonical authoring model.
* Keep mappers explicit and named source-to-target.
* Keep editor model JSON-compatible.
* Do not store React nodes, functions, DOM refs, `File` objects, or previews inside canonical editor state.
* Treat previews/cache as derived UI state.
* Treat workbook cells and uploaded files as untrusted external data.
* Keep solutions/private answer keys separate from public question bodies.

### UI/code-quality rules

* Prefer clear, boring code over abstractions.
* Avoid generic plugin systems unless there are multiple real use cases.
* Keep routes thin.
* Keep business rules out of JSX.
* Use explicit discriminated unions.
* Avoid `any`.
* Add tests for pure logic and bug fixes.
* Delete old code when replacing behavior.
* Use product language in UI: generator, question, source, reference, answer, question set.

---

## 17. Where to edit for common tasks

### Change question authoring data rules

Start in:

```txt
apps/web/src/domains/questions/authoring/*
apps/web/src/domains/questions/canonical-authoring.ts
packages/questions/src/domain/question-blueprint-document.ts
packages/questions/src/domain/question-body.ts
packages/questions/src/domain/question-source.ts
```

Add/update pure tests before changing UI.

### Change editor UI behavior

Start in:

```txt
apps/web/src/features/questions/composed-editor/*
apps/web/src/features/questions/composed-editor/inspector/*
```

Use existing operation helpers and selection helpers instead of directly mutating nested models inside JSX.

### Change save/generate workflow

Start in:

```txt
apps/web/src/features/questions/studio/use-studio-controller.ts
apps/web/src/features/questions/studio/studio-readiness.ts
apps/web/src/features/questions/studio/studio-controller-helpers.ts
apps/web/src/features/questions/studio/save-blueprint-dialog.tsx
apps/web/src/features/questions/studio/generation/generate-questions-dialog.tsx
packages/questions/src/application/QuestionGenerationService.ts
```

### Change workbook reference/source behavior

Start in:

```txt
apps/web/src/domains/questions/authoring/*
apps/web/src/domains/questions/workbook-reference.ts
apps/web/src/domains/questions/workbook-preview.ts
apps/web/src/domains/questions/reference-preview.ts
apps/web/src/features/questions/studio/use-selected-workbook-preview.ts
packages/questions/src/application/CanonicalQuestionMaterializer.ts
packages/questions/src/application/workbook-value-source-adapter.ts
packages/workbook/src/application/WorkbookCalculationService.ts
```

### Change workbook validation/calculation

Start in:

```txt
packages/workbook/src/application/WorkbookService.ts
packages/workbook/src/application/WorkbookCalculationService.ts
packages/workbook/src/infrastructure/EngineWorkbookCalculator.ts
packages/workbook-engine/src/domain.ts
packages/workbook-engine/src/runtime.ts
```

### Change API shape

Start in the bounded-context OpenAPI/source files, then regenerate. Also update:

```txt
packages/api-contract/src/openapi.ts
apps/web/src/domains/*/mappers.ts
apps/web/src/domains/*/request-mappers.ts
apps/web/src/domains/*/model.ts
```

Do not edit generated API output by hand.

---

## 18. Current high-value mental model

The central pipeline is:

```txt
Frontend visual editor
  ComposedEditorModel

Frontend canonical mapper
  QuestionBlueprintDocument

Backend questions service
  QuestionBlueprint / QuestionGenerationRun

Workbook ports if needed
  WorkbookCalculation / WorkbookSnapshot

Question materializer
  QuestionBody + QuestionSolution + QuestionSourcePlan

Database
  questions + question_set_questions
```

For most work, first decide which layer owns the concept:

```txt
User interaction?
  apps/web/src/features

Frontend business/editor model?
  apps/web/src/domains

Canonical backend business invariant?
  packages/questions/src/domain
  packages/workbook/src/domain
  packages/files/src/domain
  packages/identity/src/domain

Use case / orchestration?
  packages/*/src/application

Persistence or external service?
  packages/*/src/infrastructure

HTTP request/response?
  packages/*/src/http

App-wide composition?
  apps/api/src/app.ts
  packages/*/src/module.ts
```

When uncertain, keep logic pure and close to the domain model, add tests, and wire it into UI or services afterward.
