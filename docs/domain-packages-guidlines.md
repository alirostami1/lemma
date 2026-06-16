# Domain Package Coding Standard and Quality Gate

## 1. Purpose

This document defines the rules that every domain package must follow.

A domain package is the business core of a bounded context. It owns business concepts, invariants, lifecycle rules, value objects, entity state transitions, and domain-specific errors. It must not know how data is transported, persisted, authenticated, authorized, rendered, generated, calculated by infrastructure, or exposed through HTTP.

The goal is to keep domain code:

* pure
* deterministic
* infrastructure-independent
* easy to test
* stable over time
* expressive in business language
* protected from application, HTTP, DB, worker, storage, and external service details

This document is a compliance checklist for code review, implementation, and refactoring.

---

## 2. Layer responsibility summary

### 2.1 Domain layer

The domain layer owns:

* Entity types
* Aggregate state
* Value objects
* Branded IDs
* Domain primitives
* Domain invariants
* Domain lifecycle transitions
* Domain services
* Domain errors for business-rule violations
* Reconstitution validation
* Canonical public domain shapes
* Pure calculations that depend only on domain data

The domain layer must not own:

* HTTP validation
* OpenAPI schemas
* Zod request/response schemas
* Kysely/SQL/DB logic
* Repository implementations
* S3/storage logic
* Files service logic
* Workbook engine logic
* Question compiler/runtime logic
* Identity provider details
* Keycloak details
* Current-user authorization flow
* Not-found errors
* Forbidden errors
* Worker failures
* Network failures
* Storage failures
* Repository failures
* Application orchestration
* Presentation/DTO mapping
* Generated code

---

### 2.2 Application layer

The application layer owns:

* Use cases
* Orchestration
* Transactions
* Application policies
* Application ports
* Calling domain functions
* Calling repositories
* Calling external ports
* Authorization decisions based on `CurrentUser`
* Not-found errors
* Forbidden errors
* External/port failure errors
* Coordination between bounded contexts

Application services must not manually implement domain decisions.

Application services should look like this:

```ts
const question = requireQuestionFound(
  await questionsRepository.findQuestionById(id),
);

requireQuestionAccess(
  canViewQuestion(currentUser, question),
);

const updated = archiveQuestion(question, now);

await questionsRepository.saveQuestion(updated);
````

Application services should not look like this:

```ts
if (!question) {
  throw new QuestionNotFoundError();
}

if (question.status === "deleted") {
  throw new InvalidQuestionStateTransitionError();
}

question.status = "archived";
```

The first not-found check is application flow and can throw an application error. The status transition is domain logic and must be delegated to the domain.

---

### 2.3 Infrastructure layer

The infrastructure layer owns:

* DB implementations
* Kysely repositories
* External adapters
* Runtime adapters
* Storage adapters
* Worker clients
* File service adapters
* Mapping DB rows to domain through domain constructors/reconstitution functions
* Translating external errors into application/infrastructure errors

Infrastructure may call domain constructors, value-object functions, and reconstitution functions.

Infrastructure must not manually enforce domain rules.

Infrastructure must not instantiate domain errors directly except through domain constructors/reconstitution functions.

---

### 2.4 HTTP layer

The HTTP layer owns:

* Hono routes
* Request validation
* Generated route wiring
* Presenters
* HTTP error mapping
* Request/response formatting
* OpenAPI-driven validation
* Authentication middleware integration

HTTP may import domain error classes only for mapping them to HTTP responses.

HTTP must not instantiate domain entities manually if an application service exists.

HTTP must not implement domain decisions.

---

## 3. Allowed and forbidden imports

### 3.1 Domain package allowed imports

Domain code may import:

```txt
@lemma/domain
@lemma/error
local domain files
```

Domain code may import shared cross-domain primitives only if they are stable and infrastructure-free.

Examples:

```ts
import type { Brand, JsonValue } from "@lemma/domain";
import { DomainError } from "@lemma/error";
```

---

### 3.2 Domain package forbidden imports

Domain code must not import:

```txt
@lemma/db
@lemma/http
@lemma/identity/application
@lemma/files
@lemma/workbook/application
@lemma/workbook/infrastructure
kysely
hono
zod generated API files
OpenAPI files
storage clients
worker clients
repository implementations
HTTP env/context types
application services
infrastructure adapters
```

Forbidden examples:

```ts
import type { CurrentUser } from "@lemma/identity/application";
import type { DatabaseExecutor } from "@lemma/db";
import { z } from "zod";
```

A domain package should not know those things exist.

---

### 4. Domain model rules

#### 4.1 Domain names must use business language

Use names that describe business concepts, not technical implementation details.

Good:

```txt
Question
QuestionBlueprint
QuestionGenerationRun
Workbook
WorkbookCalculation
WorkbookSnapshot
QuestionBody
QuestionSolution
QuestionSourcePlan
QuestionProducer
```

Bad:

```txt
QuestionRow
QuestionDto
QuestionRecord
QuestionJson
RuntimeQuestionDefinition
TableQuestionPayload
DbQuestion
GeneratedQuestionResponse
```

A domain type should not be named after how it is stored, transported, or generated.

---

#### 4.2 Domain entities must not expose mutable state transitions

Entity state should be changed through domain functions.

Good:

```ts
const updated = archiveQuestion(question, now);
```

Bad:

```ts
question.status = "archived";
question.updatedAt = now;
```

Domain functions must return a new object unless the package explicitly uses controlled mutation. Prefer immutable return values.

---

#### 4.3 Lifecycle transitions belong in domain

All state transitions must be implemented in domain functions.

Examples:

```ts
archiveQuestion(question, at)
deleteQuestion(question, at)
markGenerationRunRunning(run, at)
markGenerationRunFailed(run, message, at)
markWorkbookValid(workbook, inspection, engineVersion, at)
markWorkbookInvalid(workbook, reason, inspection, at)
cancelWorkbookCalculation(calculation, at)
```

Application services must not check lifecycle rules manually.

Bad:

```ts
if (run.status === "succeeded") {
  throw new InvalidQuestionGenerationRunStateError();
}

return {
  ...run,
  status: "cancelled",
};
```

Good:

```ts
const cancelled = cancelQuestionGenerationRun(run, at);
```

---

### 5. ID rules

#### 5.1 Domain may own branded ID types

Domain packages may define branded IDs:

```ts
export type QuestionId = Brand<string, "QuestionId">;
export type QuestionBlueprintId = Brand<string, "QuestionBlueprintId">;
export type UserId = Brand<string, "UserId">;
```

This is allowed because IDs are part of the domain language.

---

#### 5.2 Domain must not hand-roll UUID regexes

A domain package must not define its own local UUID regex.

Bad:

```ts
function assertUuid(value: string): string {
  if (!/some-local-regex/.test(value)) {
    throw new InvalidQuestionFieldError("Invalid UUID");
  }
  return value;
}
```

Preferred:

```ts
import { assertUuid } from "@lemma/domain";

export function questionId(value: string): QuestionId {
  return assertUuid(value, "questionId") as QuestionId;
}
```

UUID shape is a cross-cutting technical convention. It should be centralized in `@lemma/domain` or another shared pure package.

---

#### 5.3 Alternative: opaque domain IDs

If the architecture chooses to treat IDs as opaque strings, the domain may validate only that an ID is non-empty.

In that model:

* HTTP validates UUID format.
* DB validates UUID columns.
* Domain validates only stable identity presence.

Example:

```ts
export function questionId(value: string): QuestionId {
  return nonEmptyString(value, "questionId") as QuestionId;
}
```

Pick one approach consistently across packages.

Recommended for this codebase: **centralize UUID validation in `@lemma/domain`** because OpenAPI and DB schemas already use UUIDs.

---

### 6. Primitive and value-object rules

#### 6.1 Primitive validation must be centralized inside domain or shared primitives

Good:

```ts
export function questionName(value: string): QuestionName {
  return maxLength(nonEmptyString(value, "questionName"), 160, "questionName") as QuestionName;
}
```

Bad:

```ts
if (name.length > 160) {
  throw new Error("too long");
}
```

---

#### 6.2 Value objects must normalize at the boundary

If a value object normalizes input, it must do so once at construction.

Examples:

```ts
questionName("  My Question  ") // returns "My Question"
workbookCellRef("'Sheet 1'!$A$1") // returns structured canonical ref
```

Downstream code should not repeatedly trim, lowercase, parse, or normalize the same value.

---

#### 6.3 Domain validation must reject invalid canonical shapes

For canonical JSON-like domain models, domain constructors must validate:

* `schemaVersion`
* required properties
* object-ness
* arrays vs objects
* null where not allowed
* duplicate IDs
* broken references
* unsupported discriminated-union variants
* non-finite numbers
* invalid enum values
* invalid state transitions

Identity functions are not acceptable.

Bad:

```ts
export function questionBody(input: QuestionBody): QuestionBody {
  return input;
}
```

Good:

```ts
export function questionBody(input: unknown): QuestionBody {
  const value = assertPlainObject(input, "questionBody");
  assertSchemaVersion(value.schemaVersion, 1, "questionBody.schemaVersion");
  // validate blocks, responseFields, IDs, references
  return normalizedBody;
}
```

---

### 7. Domain service rules

#### 7.1 Domain services are allowed

A domain service is appropriate when a business rule:

* does not naturally belong to one entity
* spans several domain objects
* validates a canonical domain graph
* creates or transforms domain objects using only domain data

Examples:

```ts
materializeQuestionFromBlueprint(...)
validateQuestionBlueprintDocument(...)
validateQuestionSolutionAgainstBody(...)
resolveQuestionAnswerAgainstFields(...)
```

---

#### 7.2 Domain services must be pure

Domain services must not:

* query repositories
* call external services
* call HTTP
* use storage
* use random IDs
* read current time directly
* inspect current user
* call workers
* call runtime plugins

If they need time or IDs, those values must be passed in.

Good:

```ts
createQuestion(input, at)
```

Bad:

```ts
createQuestion(input) {
  return { createdAt: new Date() };
}
```

---

### 8. Error rules

#### 8.1 Domain errors must represent business-rule violations only

Domain errors are for invalid domain state, invalid domain input, or invalid domain transitions.

Examples of valid domain errors:

```txt
InvalidQuestionFieldError
InvalidQuestionBodyError
InvalidQuestionBlueprintError
InvalidQuestionSourcePlanError
InvalidQuestionAnswerError
InvalidQuestionSolutionError
InvalidQuestionProducerError
InvalidQuestionStateTransitionError

InvalidWorkbookFieldError
InvalidWorkbookSparseValuesError
InvalidWorkbookSnapshotReferenceError
InvalidWorkbookStateTransitionError
```

---

#### 8.2 Domain errors must be specific

Avoid generic errors.

Bad:

```txt
InvalidDomainValueError
DomainValidationError
DomainError
BadValueError
```

Good:

```txt
InvalidQuestionBodyError
InvalidWorkbookSnapshotReferenceError
InvalidQuestionGenerationRunStateTransitionError
```

The error name should say which domain concept failed.

---

#### 8.3 Not-found errors are not domain errors

These must be application errors:

```txt
QuestionNotFoundError
QuestionBlueprintNotFoundError
QuestionGenerationRunNotFoundError
WorkbookNotFoundError
WorkbookSnapshotNotFoundError
```

Reason: “not found” happens when a repository returns `null`. A missing DB row is not a domain invariant.

---

#### 8.4 Forbidden/access errors are not domain errors

These must be application errors:

```txt
ForbiddenQuestionActionError
ForbiddenWorkbookActionError
AccessDeniedError
```

Reason: authorization depends on `CurrentUser`, ownership, roles, request context, or application policy. The domain should not know the current user.

---

#### 8.5 Infrastructure/port failures are not domain errors

These must be application or infrastructure errors:

```txt
WorkbookEngineFailureError
WorkbookFileProviderFailureError
WorkbookStorageFailureError
QuestionCompilerFailureError
WorkbookQuestionSourceError
QuestionRepositoryFailureError
```

Reason: workers, storage, DBs, compilers, and external services are not domain concepts.

---

#### 8.6 Application and infrastructure must not manually throw domain errors

Application and infrastructure must not do this:

```ts
throw new InvalidQuestionBodyError(...);
```

They may call a domain function that throws a domain error:

```ts
const body = questionBody(input.body);
```

The difference matters.

Application/infrastructure may throw application errors:

```ts
throw new QuestionNotFoundError(...);
throw new ForbiddenQuestionActionError(...);
throw new QuestionCompilerFailureError(...);
```

---

### 9. Reconstitution rules

#### 9.1 Reconstitution must go through domain constructors

Repositories must not cast raw DB rows directly into domain objects.

Bad:

```ts
return row as Question;
```

Good:

```ts
return reconstituteQuestion({
  id: row.id,
  ownerUserId: row.ownerUserId,
  body: row.body,
  solution: row.solution,
  status: row.status,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
```

---

#### 9.2 Invalid persisted domain state must fail fast

If a DB row contains an invalid domain status, malformed canonical body, invalid source plan, invalid answer shape, or broken invariant, reconstitution must fail.

Do not silently repair corrupt persisted domain data unless the function is explicitly a migration utility.

---

### 10. Canonical public shape rules

#### 10.1 Domain should own canonical shapes

If the application exposes a stable business shape, the domain should own it.

Examples:

```txt
QuestionBody
QuestionBlueprintDocument
QuestionSolution
QuestionSourcePlan
QuestionAnswer
QuestionProducer
WorkbookSparseValues
WorkbookInspection
```

These shapes should not be imported from runtime/plugin packages.

---

#### 10.2 Implementation-specific authoring schemas must not define the domain

Workbook engines and generation adapters may define their own internal schemas, but those schemas must compile into canonical domain shapes.

Bad:

```ts
type Question = {
  bodyPayload: TableQuestionPayload;
};
```

Good:

```ts
type Question = {
  body: QuestionBody;
  solution: QuestionSolution | null;
  sourcePlan: QuestionSourcePlan | null;
  producer: QuestionProducer | null;
};
```

---

#### 10.3 Public question responses must not expose private solutions

Normal question responses must not include:

```txt
solution
correctResponses
private grading rules
answer keys
```

Public response shape should expose:

```txt
body
producer
source summary or sourcePlan if safe
status
timestamps
```

If teachers/admins need solutions, expose them through explicit privileged endpoints.

---

### 11. Compiler/runtime boundary rules

#### 11.1 Runtime code is adapter code, not domain dependency

Runtime code must be treated as compiler/adapter implementation detail.

Allowed:

```txt
questions/infrastructure/QuestionCompilerAdapter.ts imports adapter-specific libraries
```

Forbidden:

```txt
questions/domain/question.ts imports adapter runtime libraries
questions/openapi/openapi.ts derives public schemas from adapter runtime registries
```

---

#### 11.2 Compilers output canonical domain models

Question compilers should output:

```txt
QuestionBlueprintDocument
QuestionBody
QuestionSolution
QuestionSourcePlan
QuestionProducer
```

They should not become the persisted domain shape.

---

### 12. Application service rules

#### 12.1 Services orchestrate only

Application services may:

* parse command IDs using domain ID constructors
* load entities
* check application policies
* call domain functions
* call ports
* coordinate transactions
* save entities
* throw application errors

They must not:

* mutate domain objects manually
* implement lifecycle rules manually
* throw domain errors manually
* validate canonical domain JSON manually if a domain validator exists
* call infrastructure directly
* know HTTP request/response details

---

#### 12.2 No private domain-rule helpers in services

Bad:

```ts
private assertQuestionCanBeArchived(question: Question): void {
  if (question.status === "deleted") {
    throw new InvalidQuestionStateTransitionError();
  }
}
```

Good:

```ts
const archived = archiveQuestion(question, now);
```

Private helpers in services are allowed only for application flow, not domain rules.

---

### 13. Infrastructure rules

#### 13.1 Repositories map, they do not decide

Repositories may:

* convert DB rows to domain objects
* convert domain objects to DB rows
* call reconstitution functions
* handle transactions

Repositories must not:

* decide lifecycle transitions
* enforce authorization
* manually validate domain JSON
* manually throw domain errors
* silently coerce invalid state

---

#### 13.2 External adapters translate external failures

Adapters should translate external failures to application/infrastructure errors.

Example:

```ts
try {
  return await worker.calculate(...);
} catch (error) {
  throw new WorkbookEngineFailureError("Workbook engine failed.", { cause: error });
}
```

This is application/infrastructure error handling, not domain error handling.

---

### 14. HTTP and OpenAPI rules

#### 14.1 OpenAPI must describe canonical public contracts

OpenAPI must not expose runtime implementation schemas as core domain responses.

Bad schema names:

```txt
TableQuestionTemplate
RuntimeQuestionDefinition
QuestionTemplateDefinition
TableQuestionAnswer
```

Good schema names:

```txt
QuestionBody
QuestionBlueprintDocument
QuestionSourcePlan
QuestionAnswer
GradeResult
QuestionProducer
```

---

#### 14.2 Generated files must not be edited manually

Generated files must be changed by editing source OpenAPI/generator code and regenerating.

Required command:

```bash
pnpm --filter <package> generate:openapi
```

---

#### 14.3 HTTP maps errors, it does not create domain decisions

HTTP error handlers may map:

```txt
DomainError -> 400/409
ApplicationError -> 403/404/502/etc.
```

HTTP must not decide lifecycle rules or create domain errors directly.

---

### 15. Time, randomness, and side effects

#### 15.1 Domain must not read current time

Bad:

```ts
updatedAt: new Date()
```

Good:

```ts
archiveQuestion(question, at)
```

Application supplies `at`.

---

#### 15.2 Domain must not generate IDs

Bad:

```ts
id: crypto.randomUUID()
```

Good:

```ts
createQuestion({ id, ... }, at)
```

Application supplies IDs through an `IdGenerator`.

---

#### 15.3 Domain must not perform I/O

Domain must not:

* read files
* write files
* call HTTP
* call workers
* call DB
* call storage
* call external services
* inspect environment variables

---

### 16. Testing requirements

#### 16.1 Domain tests must be pure unit tests

Domain tests should not require:

* DB
* HTTP server
* generated OpenAPI
* storage
* files service
* workbook engine
* question compiler runtime
* network

---

#### 16.2 Domain tests must cover invariants

Every domain package should test:

* valid construction
* invalid primitive values
* invalid canonical shapes
* lifecycle transitions
* invalid transitions
* reconstitution validation
* source/reference parsing
* answer/solution validation
* privacy-sensitive shapes where applicable

---

#### 16.3 Application tests must verify orchestration

Application tests should verify:

* not-found behavior
* forbidden behavior
* ports called correctly
* transactions used correctly
* domain functions invoked
* external failures mapped correctly
* no private solution leakage through presenters

---

### 17. Static quality checks

Every domain package should pass these checks.

#### 17.1 No forbidden imports in domain

```bash
rg "@lemma/db|@lemma/http|@lemma/files|hono|kysely|zod" packages/*/src/domain
```

Expected: no matches, except explicitly approved shared pure packages.

---

#### 17.2 No generic domain errors

```bash
rg "InvalidDomainValueError|DomainValidationError|BadValueError" packages/*/src/domain
```

Expected: no matches.

---

#### 17.3 No domain errors thrown outside domain

```bash
rg "new Invalid.*Error|new .*StateTransition.*Error|new .*Domain.*Error" packages/*/src/application packages/*/src/infrastructure
```

Expected: no domain-error construction outside `src/domain`.

Application errors are allowed outside domain.

---

#### 17.4 No runtime schemas in public Questions API

```bash
rg "RuntimeQuestionDefinition|QuestionTemplateDefinition" packages/questions/openapi.json packages/questions/src/gen
```

Expected: no matches.

---

#### 17.5 No manual UUID regexes in bounded-context domains

```bash
rg "\\[0-9a-f\\].*\\{8\\}.*\\{4\\}" packages/*/src/domain
```

Expected: no local UUID regexes. Use shared `@lemma/domain` primitive.

---

### 18. Code review checklist

A domain package change is compliant only if all answers below are “yes.”

#### Boundary checklist

* [ ] Does `src/domain` avoid infrastructure imports?
* [ ] Does `src/domain` avoid application imports?
* [ ] Does `src/domain` avoid HTTP/OpenAPI/generated imports?
* [ ] Does `src/domain` avoid runtime/plugin implementation imports?
* [ ] Are external services represented only through application ports?

#### Domain model checklist

* [ ] Are entities named in business language?
* [ ] Are lifecycle transitions implemented in domain functions?
* [ ] Are canonical shapes owned by domain?
* [ ] Are canonical shapes validated?
* [ ] Are private/solution fields separated from public/renderable fields?
* [ ] Are branded IDs constructed through shared primitives?

#### Error checklist

* [ ] Are domain errors specific?
* [ ] Are not-found errors application errors?
* [ ] Are forbidden errors application errors?
* [ ] Are infrastructure failures application/infrastructure errors?
* [ ] Are domain errors only instantiated in domain code?
* [ ] Does HTTP map both application and domain errors separately?

#### Application checklist

* [ ] Do services orchestrate instead of deciding domain rules?
* [ ] Do services call domain transition functions?
* [ ] Do services avoid manually mutating domain state?
* [ ] Do services avoid private domain-rule helpers?
* [ ] Do services use application errors for not-found/forbidden/external failures?

#### Infrastructure checklist

* [ ] Do repositories use reconstitution functions?
* [ ] Do repositories avoid casting rows directly to domain types?
* [ ] Do adapters avoid throwing domain errors directly?
* [ ] Are external errors translated to application/infrastructure errors?

#### API checklist

* [ ] Does OpenAPI expose canonical public shapes?
* [ ] Are generated files regenerated, not manually edited?
* [ ] Are implementation-specific schemas hidden behind compiler/descriptor endpoints?
* [ ] Are private solutions not returned by default?

---

### 19. Definition of done

A domain package is compliant when:

1. Domain imports are pure.
2. Domain owns only business concepts.
3. Domain errors represent only business invariant failures.
4. Application services orchestrate and do not manually implement domain rules.
5. Infrastructure maps external systems and does not own domain decisions.
6. HTTP maps errors and presents output only.
7. Canonical public shapes are stable and not runtime/plugin-specific.
8. Reconstitution validates persisted domain state.
9. Generated API output has no stale implementation-specific schemas.
10. Static checks and package builds pass.

Required commands:

```bash
pnpm --filter <package> generate:openapi
pnpm --filter <package> check-types
pnpm --filter <package> build
```

Recommended boundary checks:

```bash
rg "@lemma/db|@lemma/http|@lemma/files|hono|kysely|zod" packages/<package>/src/domain
rg "InvalidDomainValueError|DomainValidationError|BadValueError" packages/<package>/src/domain
rg "new Invalid.*Error|new .*StateTransition.*Error|new .*Domain.*Error" packages/<package>/src/application packages/<package>/src/infrastructure
```
