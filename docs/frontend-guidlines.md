# Code Quality and Planning Standard

## 1. Purpose

This document defines how code should be designed, reviewed, refactored, and implemented in this project. The highest priority is **code simplicity and readability**. Performance, clever abstractions, flexibility, and reuse are valuable only when they do not make the code harder to understand.

The target reader is a developer or coding agent working on the project. Every implementation plan should follow this document before writing code.

The goal is not to produce “impressive” code. The goal is to produce code that another developer can open six months later and understand quickly.

---

# 2. Core Principles

## 2.1 Readability is the primary optimization

Readable code is code that makes the business behavior obvious.

Prefer this:

```ts
function canGenerateQuestions(input: GenerationReadinessInput): boolean {
  return (
    hasAtLeastOneAnswer(input.model) &&
    hasValidReferences(input.model) &&
    hasRequiredWorkbookSource(input)
  );
}
```

Over this:

```ts
const canGenerate = checks.every((check) => check(ctx));
```

The second version is shorter, but the first version explains the product rule.

Readable code should:

* use clear names
* avoid hidden side effects
* avoid clever generic abstractions
* keep files small
* keep functions focused
* make invalid states hard to represent
* keep domain logic separate from UI rendering
* avoid magic strings scattered across the codebase

## 2.2 Simplicity beats generality

Do not build generalized systems before the product needs them.

Bad:

```ts
type UniversalBlockPlugin<TContext, TState, TEvent> = {
  id: string;
  lifecycle: PluginLifecycle<TContext, TState, TEvent>;
  renderer: RendererFactory<TContext, TState>;
};
```

Better:

```ts
type QuestionBlock =
  | TextBlock
  | RichTextBlock
  | ResponseBlock
  | TableBlock
  | SeparatorBlock;
```

Generalize only after there are at least two or three real use cases.

## 2.3 Explicit is better than implicit

Prefer explicit domain functions over hidden conventions.

Bad:

```ts
save(data);
```

Better:

```ts
saveGeneratorRevision({
  generatorId,
  blueprint,
  references,
});
```

Bad:

```ts
if (mode === "new") {
  mutate(payload);
}
```

Better:

```ts
if (saveMode === "create_new_generator") {
  createGenerator(payload);
}
```

## 2.4 One source of truth

Every concept should have one canonical model and one canonical mapper.

Avoid:

```txt
ComposedEditorModel in features
ComposedEditorModel in domains
QuestionEditorModel in routes
TemplateModel in API layer
```

Prefer:

```txt
domains/questions/authoring/composed-model.ts
```

Then React components import the pure model from there.

## 2.5 Delete old code

Do not leave unused compatibility layers, old adapters, abandoned components, or dead tests.

Temporary code must be clearly marked:

```ts
// TODO(remove-after-generator-migration): remove once old question sets are deleted.
```

But temporary code should be rare.

When a new design replaces an old design, remove the old design as part of the same plan unless there is a specific migration reason not to.

---

# 3. Architecture Rules

## 3.1 Dependency direction

Use this dependency direction:

```txt
routes
  → features
    → domains
      → api generated clients / infrastructure adapters
```

Allowed:

```ts
// Feature importing domain model
import type { ComposedEditorModel } from "#/domains/questions/authoring";
```

Not allowed:

```ts
// Domain importing feature component/model
import type { ComposedEditorModel } from "#/features/questions/composed-editor";
```

## 3.2 Generated API code should stay isolated

Generated API types and clients should not spread through the UI.

Allowed places:

```txt
src/domains/*/api.ts
src/domains/*/mappers.ts
src/domains/*/request-mappers.ts
src/domains/questions/authoring/canonical-mappers.ts
```

Avoid in:

```txt
src/features
src/routes
src/components
```

Bad:

```ts
import type { QuestionBlueprintDocument } from "#/api/generated/model";
```

inside a React feature component.

Better:

```ts
import type { ComposedEditorModel } from "#/domains/questions/authoring";
```

The domain layer converts between generated DTOs and app models.

## 3.3 Features own UI; domains own business rules

Feature code should answer:

```txt
How does the user interact with this?
```

Domain code should answer:

```txt
What is valid?
What does this mean?
How does this convert to canonical data?
```

Example structure:

```txt
src/domains/questions/authoring/
  composed-model.ts
  table-model.ts
  inline-content.ts
  rich-content.ts
  validation.ts
  canonical-mappers.ts
  preview-mappers.ts

src/features/questions/composed-editor/
  composed-question-editor.tsx
  block-shell.tsx
  block-preview.tsx
  inspector-panel.tsx
  reference-chip.tsx
```

## 3.4 Routes should be thin

Route files should only:

* validate route params/search
* call the page component
* pass typed inputs

Good:

```tsx
export const Route = createFileRoute("/_layout/studio")({
  validateSearch: readStudioSearch,
  component: RouteComponent,
});

function RouteComponent() {
  return <QuestionPage {...Route.useSearch()} />;
}
```

Bad:

```tsx
function RouteComponent() {
  const query = useQuestionSetsQuery();
  const mutation = useCreateQuestionBlueprint();
  const [editorState, setEditorState] = useState(...);

  return <HugeStudio />;
}
```

---

# 4. File and Function Size

## 4.1 Preferred file size

A file should usually be below **250 lines**.

Files above **400 lines** should be split unless there is a strong reason.

Files above **700 lines** are almost always a readability problem.

## 4.2 Component size

A React component should usually be below **150 lines**.

If a component contains:

* several effects
* several mutation handlers
* nested rendering branches
* many helper functions
* several sections of JSX

split it.

## 4.3 Function size

A function should usually fit on one screen.

If a function has more than one responsibility, split it.

Bad:

```ts
async function handleSaveAndGenerateAndPollAndNavigate() {
  // validates form
  // saves blueprint
  // starts generation
  // polls run
  // updates cache
  // navigates
}
```

Better:

```ts
async function saveGeneratorDraft() {}
async function startGenerationRun() {}
function updateGenerationStatus() {}
function navigateToGeneratedQuestions() {}
```

---

# 5. Naming Standards

## 5.1 Use product language, not implementation language

Prefer:

```txt
Generator
Question
Exercise
Source
Reference
Answer
```

Avoid exposing internal terms to users:

```txt
Template ID
Run ID
Question kind
Kind version
Cell source plan
```

Internal code may use precise technical terms, but UI copy should use product terms.

## 5.2 Function names should describe intent

Bad:

```ts
processData()
handleClick()
update()
convert()
```

Better:

```ts
createGeneratorRevision()
resolveWorkbookReferencePreview()
validateResponseFieldReferences()
saveCurrentGenerator()
```

## 5.3 Boolean names

Use names that read clearly in conditions.

Good:

```ts
if (hasUnsavedChanges) {}
if (canGenerateQuestions) {}
if (requiresWorkbookSource) {}
if (isWorkbookReady) {}
```

Bad:

```ts
if (valid) {}
if (source) {}
if (state) {}
```

## 5.4 Avoid abbreviations

Prefer:

```ts
questionSetId
workbookPreview
generationRun
```

Avoid:

```ts
qsId
wbPrev
genRun
```

---

# 6. Type Safety Practices

## 6.1 Avoid `any`

Do not use `any` unless integrating with an untyped third-party library and there is no reasonable alternative.

If unknown data is received, use `unknown` and narrow it.

Bad:

```ts
function readValue(value: any) {
  return value.id;
}
```

Good:

```ts
function readValue(value: unknown): string | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }

  return value.id;
}
```

## 6.2 Prefer discriminated unions

For domain variants, use explicit discriminated unions.

Good:

```ts
type QuestionBlock =
  | { type: "text"; id: string; content: InlineContent[] }
  | { type: "response"; id: string; responseFieldId: string }
  | { type: "table"; id: string; cells: TableCell[] };
```

Then switch on `type`.

```ts
function renderBlock(block: QuestionBlock) {
  switch (block.type) {
    case "text":
      return renderTextBlock(block);
    case "response":
      return renderResponseBlock(block);
    case "table":
      return renderTableBlock(block);
  }
}
```

## 6.3 Exhaustive checks

When switching over a union, use an exhaustive helper.

```ts
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
```

Example:

```ts
function getBlockLabel(block: QuestionBlock): string {
  switch (block.type) {
    case "text":
      return "Text";
    case "response":
      return "Answer";
    case "table":
      return "Table";
    case "separator":
      return "Separator";
    default:
      return assertNever(block);
  }
}
```

## 6.4 Make invalid states hard to represent

Bad:

```ts
type SaveState = {
  mode?: "update" | "create";
  blueprintId?: string;
};
```

This allows invalid combinations.

Better:

```ts
type SaveState =
  | {
      mode: "create";
    }
  | {
      mode: "update";
      blueprintId: string;
    };
```

## 6.5 Use branded IDs where useful

For domain boundaries, prefer branded IDs to avoid mixing unrelated strings.

```ts
type Brand<T, Name extends string> = T & { readonly __brand: Name };

type GeneratorId = Brand<string, "GeneratorId">;
type QuestionId = Brand<string, "QuestionId">;
type WorkbookId = Brand<string, "WorkbookId">;
```

Do not overuse brands inside UI-only components where they create noise without safety.

## 6.6 Prefer precise input and output types

Bad:

```ts
function buildRequest(input: object): object
```

Good:

```ts
function toCreateQuestionGenerationRunRequest(
  input: CreateQuestionGenerationRunInput,
): CreateQuestionGenerationRunRequest
```

## 6.7 Do not trust generated API types as domain truth

Generated DTO types describe HTTP shape. They are not necessarily ideal app/domain models.

Use mappers:

```ts
function mapQuestionBlueprint(dto: QuestionBlueprintDto): QuestionBlueprint {
  return {
    id: dto.id,
    name: dto.name,
    document: mapBlueprintDocument(dto.document),
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}
```

## 6.8 Validate external data

Anything from these sources should be treated as external:

* API response
* uploaded file
* route search params
* local storage
* user input
* generated JSON
* workbook cells

Use schema validation or explicit narrowing.

---

# 7. React Code Standards

## 7.1 Components should be mostly declarative

A component should read like:

```tsx
return (
  <Card>
    <Header />
    <Editor />
    <Inspector />
  </Card>
);
```

Not like:

```tsx
return (
  <div>
    {mode === "a" ? ... : mode === "b" ? ... : ...}
    {state.x && state.y && !state.z ? ... : ...}
  </div>
);
```

Move complex branches into named components.

## 7.2 Separate state logic from rendering

If a page has many states and effects, create a hook.

```ts
function useStudioController(input: StudioInput): StudioController {
  // queries, mutations, effects, event handlers
}
```

Then the page is simple:

```tsx
function StudioPage(input: StudioInput) {
  const studio = useStudioController(input);

  return (
    <StudioLayout
      actionBar={<StudioActionBar {...studio.actions} />}
      canvas={<ComposedQuestionEditor {...studio.editor} />}
      inspector={<InspectorPanel {...studio.inspector} />}
    />
  );
}
```

## 7.3 Avoid prop drilling through many layers

If a value is needed deeply by many editor components, use a small context.

Good candidates:

```txt
workbook picker controller
editor selection
tooltip provider
```

Bad candidates:

```txt
everything in one giant EditorContext
```

Keep contexts focused.

## 7.4 Prefer controlled components for editor state

The editor should receive:

```ts
model
onModelChange
selection
onSelectionChange
```

This makes behavior easier to test.

## 7.5 Effects should be minimal and obvious

Bad:

```ts
useEffect(() => {
  // load blueprint
  // set name
  // set source
  // reset generation
  // update form
  // mark clean
}, [...manyDeps]);
```

Better:

```ts
useEffect(() => {
  loadSelectedTemplate();
}, [loadSelectedTemplate]);
```

And move the logic into a named callback/hook.

## 7.6 Do not hide business rules inside JSX

Bad:

```tsx
<Button
  disabled={
    !selectedQuestionSetId ||
    blueprintName.trim().length === 0 ||
    (workbookRefs.length > 0 && selectedWorkbook?.status !== "valid") ||
    isSaving ||
    isGenerating
  }
/>
```

Good:

```tsx
const readiness = getStudioReadiness(...);

<Button disabled={!readiness.canSave} />
```

---

# 8. State Management

## 8.1 Keep state close to where it is used

Use local state for:

* selected block
* dialog open state
* temporary input draft
* hover state

Use server state for:

* API data
* generated questions
* workbooks
* generators
* generation runs

Use pure domain models for editor state.

## 8.2 Do not duplicate derived state

Bad:

```ts
const [workbookRefs, setWorkbookRefs] = useState([]);
```

when it can be derived:

```ts
const workbookRefs = useMemo(
  () => extractWorkbookRefsFromComposedEditorModel(model),
  [model],
);
```

## 8.3 Track dirty state explicitly

For editors, dirty state should compare loaded/saved model to current model or be updated by controlled events.

```ts
type DraftState = {
  savedSnapshot: ComposedEditorModel | null;
  current: ComposedEditorModel;
};

function hasUnsavedChanges(state: DraftState): boolean {
  return !deepEqual(state.savedSnapshot, state.current);
}
```

If deep equality is too heavy, maintain a deliberate dirty flag, but keep the rules clear.

---

# 9. Domain Modeling

## 9.1 Model user concepts first

Before implementing, identify the user-facing concepts.

Example:

```txt
Generator
Question document
Block
Reference
Answer
Source
Preview
Exercise
Exam
```

Do not start from database tables or HTTP payloads.

## 9.2 Use canonical models

There should be one canonical shape for authored question documents.

Example:

```ts
type ComposedEditorModel = {
  schemaVersion: 1;
  blocks: ComposedEditorBlock[];
  responseFields: ComposedResponseField[];
  references: ComposedReferenceDraft[];
};
```

Every UI component and mapper should work with this, unless there is a clear reason not to.

## 9.3 Keep editor model and rendered model separate

Authoring model can contain references:

```ts
{ type: "reference"; referenceId: "revenue" }
```

Rendered model should contain display values:

```ts
{ type: "value"; referenceId: "revenue"; displayValue: "1200" }
```

Do not mix them.

## 9.4 Use explicit mappers

Good:

```ts
composedEditorModelToCanonicalBlueprint()
canonicalBlueprintToComposedEditorModel()
questionBodyToComposedPreviewModel()
```

Bad:

```ts
normalize()
convert()
parse()
```

without clear source and target.

---

# 10. Error Handling

## 10.1 Errors should be useful to users

Bad:

```txt
Request failed.
```

Better:

```txt
Generator could not be saved. Check the missing source reference.
```

## 10.2 Errors should be useful to developers

Include internal details in logs or developer panels, not primary UI.

User-facing:

```txt
Generation failed.
```

Developer details:

```txt
Run ID: 019...
Request ID: abc...
Error: workbook snapshot not found
```

## 10.3 Do not swallow errors silently

Bad:

```ts
try {
  await save();
} catch {}
```

Better:

```ts
try {
  await save();
} catch (error) {
  setError(getErrorMessage(error, "Generator could not be saved."));
}
```

## 10.4 Normalize API errors

Use a single app error type:

```ts
class AppApiError extends Error {
  status: number;
  payload: ApiErrorPayload;
}
```

Then UI can read:

```ts
getApiErrorMessage(error)
```

---

# 11. UX-Aware Code Quality

## 11.1 Do not expose internal modes as permanent UI

Bad:

```txt
Save
Save as new
Generate saved
Generate draft
Retry
```

Better:

```txt
Save blueprint
Generate questions
```

Then ask for details in dialogs.

## 11.2 Show only settable options

If the user cannot set an option in the current context, hide it or explain what is missing.

Bad:

```txt
Workbook cell input disabled
Workbook range input disabled
```

Better:

```txt
No source selected.
[Select source]
```

## 11.3 Inspector should be selection-aware

For visual editors, the side panel should show settings for the selected object only.

```txt
Selected table cell → cell settings
Selected answer block → answer settings
Selected reference → reference settings
Nothing selected → document readiness
```

## 11.4 Preview-first editing

The editor canvas should look like the final result whenever possible.

Bad:

```txt
Cell | Mode | Source | Points
```

Better:

```txt
Actual table grid
```

Then configuration lives in inspector/context menus.

## 11.5 Tooltips for icon-only actions

Every icon-only button must have:

* accessible label
* tooltip
* clear disabled reason if disabled

---

# 12. Testing Standards

## 12.1 Test pure logic first

Pure functions are easiest to test and most valuable.

Test:

```txt
validation
mappers
readiness logic
value coercion
reference extraction
workbook ref parsing
table conversion
```

## 12.2 Component tests only where useful

Do not write brittle component tests for every detail.

Use component tests for:

* critical flows
* dialogs
* disabled/enabled action behavior
* editor selection behavior
* form validation

## 12.3 Architecture tests are valuable

Use tests to prevent old architecture from returning.

Examples:

```txt
features must not import api/generated
domains must not import features
old question-kind strings must not appear
collectionId must only exist in route compatibility code
```

## 12.4 Test names should describe behavior

Bad:

```ts
it("works", () => {});
```

Good:

```ts
it("keeps literal references out of workbook source detection", () => {});
```

## 12.5 Regression tests for bugs

Every fixed bug should usually get a test.

Example:

```txt
UUIDv7 rejected by old validators
JSON answer stringified incorrectly
table preview passed editor model instead of preview model
unknown reference not reported
```

---

# 13. Refactoring Standards

## 13.1 Refactor in safe steps

A good refactor plan:

```txt
1. Add new pure helper
2. Add tests
3. Switch one caller
4. Switch remaining callers
5. Delete old helper
6. Run grep to confirm removal
```

## 13.2 Do not mix unrelated refactors

Avoid combining:

```txt
UI redesign
API model change
naming cleanup
dependency cleanup
```

unless they are tightly coupled.

## 13.3 Keep compatibility wrappers short-lived

If adding a wrapper:

```ts
export { createTextBlock } from "#/domains/questions/authoring";
```

mark it for deletion or delete it in the same patch after imports are updated.

## 13.4 Prefer moving code over rewriting code

If logic already works, move it first. Rewrite only after tests pass.

---

# 14. Planning Rules for Agents

## 14.1 Before writing code, identify the scope

Every plan should state:

```txt
What is changing?
What is not changing?
What files/modules are affected?
What tests/checks will verify it?
What old code will be removed?
```

## 14.2 Prefer small complete phases

Good phase:

```txt
Replace header save/generate buttons with dialogs.
```

Bad phase:

```txt
Improve Studio UX.
```

## 14.3 Define acceptance criteria

Every plan must include concrete acceptance criteria.

Example:

```txt
- Header shows only Save blueprint and Generate questions.
- Save dialog supports update existing and save as new.
- Generate dialog asks for count.
- No permanent Save as new button remains.
- check-types passes.
```

## 14.4 Include grep checks

Every cleanup plan should include search commands.

Example:

```bash
rg "Save as new" apps/web/src
rg "#/api/generated" apps/web/src/features apps/web/src/routes apps/web/src/components
rg "question-kind|kindVersion|QuestionKind" apps/web/src
```

## 14.5 Avoid “future-proofing”

Agents should not add:

* plugin registries
* generic engines
* event buses
* factories
* over-abstracted hooks
* dynamic schemas

unless the current task clearly needs them.

## 14.6 Prefer deterministic behavior

Do not introduce AI, suggestions, or heuristic automation when the task is to improve deterministic UI.

---

# 15. TypeScript Practices

## 15.1 Use strict TypeScript as design feedback

Do not bypass errors with:

```ts
as any
// @ts-ignore
// @ts-expect-error
```

unless there is a documented third-party limitation.

## 15.2 Prefer type narrowing over assertions

Bad:

```ts
const response = block as ResponseBlock;
```

Good:

```ts
if (block.type !== "response") {
  throw new Error("Expected response block.");
}

return block.responseFieldId;
```

## 15.3 Use helper predicates

```ts
function isResponseBlock(block: ComposedEditorBlock): block is ComposedResponseEditorBlock {
  return block.type === "response";
}
```

## 15.4 Avoid huge generic signatures

Bad:

```ts
function createHandler<TModel, TKey extends keyof TModel, TValue extends TModel[TKey]>(...)
```

Better:

```ts
function updateResponseFieldLabel(
  model: ComposedEditorModel,
  fieldId: string,
  label: string,
): ComposedEditorModel
```

## 15.5 Avoid stringly typed commands

Bad:

```ts
onAction("duplicate-block", id);
```

Better:

```ts
onDuplicateBlock(id);
```

Or:

```ts
type EditorAction =
  | { type: "duplicate_block"; blockId: string }
  | { type: "delete_block"; blockId: string };
```

Use action unions only when they simplify, not by default.

---

# 16. Data Mapping Practices

## 16.1 Always name source and target

Good:

```ts
tableEditorModelToCanonicalBlueprint()
canonicalBlueprintToComposedEditorModel()
questionAnswerToTableAnswerState()
```

Bad:

```ts
map()
convert()
hydrate()
serialize()
```

## 16.2 Do not mutate DTOs

Bad:

```ts
dto.createdAt = new Date(dto.createdAt);
return dto;
```

Good:

```ts
return {
  ...dto,
  createdAt: new Date(dto.createdAt),
};
```

## 16.3 Keep mappers boring

Mapper functions should not:

* fetch data
* mutate cache
* update UI state
* show errors
* depend on React

They should convert shapes.

---

# 17. Editor-Specific Standards

## 17.1 Editor model must be pure JSON-compatible

Editor state should be serializable.

Avoid storing:

* React nodes
* functions
* class instances
* DOM refs
* File objects

inside canonical editor model.

File objects and workbook previews belong in UI state, not canonical model.

## 17.2 Selection is UI state

Selection should not be saved in the question model.

```ts
type EditorSelection =
  | { type: "document" }
  | { type: "block"; blockId: string }
  | { type: "table_cell"; blockId: string; cellId: string }
  | { type: "reference"; referenceId: string };
```

## 17.3 Preview values are cache, not canonical data

Reference preview cache:

```ts
type ReferencePreviewValue = {
  referenceId: string;
  status: "resolved" | "missing_source" | "error";
  displayValue: string;
};
```

This must not be persisted as the source of truth.

## 17.4 Do not make users edit implementation tables

A table block should be visually edited as a table.

Configuration tables are acceptable for internal debugging, not primary UX.

---

# 18. Performance Rules

Performance matters, but not more than readability unless there is a measured issue.

## 18.1 Do not prematurely optimize

Avoid:

* complex memoization everywhere
* manual caching without need
* generic diffing systems
* virtualized grids before real size requires it

## 18.2 Use memoization only when it clarifies or fixes real issues

Good:

```ts
const workbookRefs = useMemo(
  () => extractWorkbookRefsFromComposedEditorModel(model),
  [model],
);
```

This is readable and avoids repeated extraction.

Bad:

```ts
const label = useMemo(() => `${a}-${b}`, [a, b]);
```

## 18.3 Prefer simple data structures

Use arrays and maps plainly.

Do not introduce custom collection classes.

---

# 19. Security and Safety Practices

## 19.1 Do not render untrusted HTML

Rich text should be structured content, not raw HTML.

Good:

```ts
type RichContent = {
  type: "doc";
  content: RichContentNode[];
};
```

Bad:

```ts
dangerouslySetInnerHTML={{ __html: userContent }}
```

## 19.2 Treat uploaded files as untrusted

Workbook parsing should:

* validate file type
* handle parse errors
* avoid exposing raw formulas unexpectedly
* avoid large memory assumptions
* report unsupported features clearly

## 19.3 Do not leak tokens or IDs in UI

Avoid showing:

* access tokens
* raw user IDs
* internal run IDs
* file IDs
* request IDs

unless in debug details.

---

# 20. Accessibility Practices

## 20.1 Buttons need names

Icon buttons must have:

```tsx
aria-label="Delete block"
```

## 20.2 Tooltips are not labels

A tooltip is helpful, but `aria-label` is still required.

## 20.3 Dialogs should be clear

Dialogs should have:

* title
* description
* clear primary action
* cancel action
* disabled reason if primary action is disabled

## 20.4 Keyboard support

Menus, dialogs, popovers, and context menus should use accessible primitives from the UI library.

---

# 21. UI Copy Standards

## 21.1 Use user language

Prefer:

```txt
Save blueprint
Generate questions
Select source
Answer
Reference
```

Avoid:

```txt
Persist blueprint
Create generation run
Workbook snapshot source
Response field ID
```

## 21.2 Disabled states need reasons

Bad:

```txt
[Generate disabled]
```

Better:

```txt
Generate disabled because this question has no answer block.
```

## 21.3 Avoid vague success messages

Bad:

```txt
Done.
```

Better:

```txt
Created 3 questions.
```

Best:

```txt
Created 3 questions. View generated questions →
```

---

# 22. Code Review Checklist

A reviewer or agent should ask:

## Readability

```txt
Can I understand the file in one pass?
Are names clear?
Are functions small?
Is the behavior explicit?
Is there unnecessary cleverness?
```

## Architecture

```txt
Do dependencies point the right direction?
Are generated API types isolated?
Is domain logic outside React components?
Are routes thin?
```

## Type safety

```txt
Is there any `any`?
Are unions discriminated?
Are invalid states representable?
Are external values validated?
Are casts justified?
```

## UX

```txt
Does the UI expose internal concepts?
Are only relevant options shown?
Are disabled actions explained?
Does the editor look like the final result?
```

## Cleanup

```txt
Was old code removed?
Are stale imports gone?
Are compatibility wrappers still needed?
Did grep checks pass?
```

## Tests

```txt
Are pure functions tested?
Was a regression test added?
Do architecture tests prevent backsliding?
```

---

# 23. Planning Template for Agents

Every implementation plan should use this format.

```txt
Goal
Describe the user/product/code-quality outcome in one paragraph.

Non-goals
List what will not be changed.

Current problems
List the specific issues in the current code.

Target design
Describe the final structure and behavior.

Files to change
List files and what changes in each.

Implementation steps
Break into small ordered steps.

Deletion plan
List old files/functions/imports to remove.

Type-safety plan
List types/unions/validators/mappers to update.

UX behavior
Describe user-visible behavior.

Tests
List tests to add/update.

Verification
List commands and grep checks.

Acceptance criteria
List concrete pass/fail outcomes.
```

---

# 24. Example: Good Plan

```txt
Goal
Replace the Studio header action overload with one Save button and one Generate button.

Non-goals
Do not change backend APIs.
Do not change canonical question blueprint shape.
Do not redesign the table editor in this patch.

Current problems
The header exposes Save, Save as new, Generate saved, Generate, and Retry.
Users must understand internal save/generation modes.

Target design
Save opens a SaveBlueprintDialog.
Generate opens a GenerateQuestionsDialog.
Retry appears only after a failed generation run.

Files to change
studio-command-bar.tsx
save-blueprint-dialog.tsx
generation/generate-questions-dialog.tsx
generation/generation-status-banner.tsx
generation/use-generation-status-controller.ts

Implementation steps
1. Add SaveBlueprintDialog.
2. Wire existing save blueprint flow into dialog.
3. Add GenerateQuestionsDialog.
4. Move count input into dialog.
5. Remove permanent Save as new / Generate saved buttons.
6. Move Retry into failure status panel.

Deletion plan
Remove old header buttons and count field from header.

Type-safety plan
Create SaveBlueprintDialogInput and GenerateQuestionsDialogInput unions.

Tests
Add tests for save-mode selection and generate count validation.

Verification
pnpm --filter web check-types
pnpm --filter web test
rg "Generate saved|Save as new" apps/web/src/features/questions
```

---

# 25. Non-Negotiable Rules

These rules should be enforced strictly.

```txt
1. Readability is more important than cleverness.
2. Do not use `any` to silence TypeScript.
3. Do not import feature modules from domain modules.
4. Do not import generated API types into UI components.
5. Do not leave old architecture code around after replacing it.
6. Do not expose internal IDs/modes in primary UI.
7. Do not build generic plugin systems before the product needs them.
8. Do not hide business rules inside JSX.
9. Do not silently swallow errors.
10. Do not make users configure implementation details when a visual editor is possible.
```

---

# 26. Final Standard

The best code in this project should feel boring.

A good implementation is:

```txt
small files
clear names
plain data
explicit unions
pure helpers
thin routes
focused components
isolated generated API code
simple UI copy
strong tests
old code deleted
```

A bad implementation is:

```txt
giant files
generic abstractions
hidden side effects
UI importing generated DTOs
domain importing React features
duplicated models
unclear save/generate modes
raw IDs in user-facing UI
disabled controls without explanation
old code left behind
```

When in doubt, choose the version that a junior developer can understand without asking for a tour.
