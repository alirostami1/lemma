# ADR 0003: Product-Simple Studio Authoring UX

## Status

Proposed.

## Context

Lemma now uses a draft-only authoring architecture with immutable published blueprint versions and server-owned source materialization.

Internally, this architecture has important implementation concepts:

* drafts;
* draft revisions;
* expected revisions;
* source bindings;
* source IDs;
* file IDs;
* workbook IDs;
* source materialization;
* reference IDs;
* canonical reference syntax such as `{{ .reference }}`;
* published blueprint versions;
* source artifacts and future source revisions.

These concepts are necessary for correctness, concurrency, immutability, and reproducibility. They should remain in the internal domain, API, persistence, generated contracts, tests, and developer documentation.

However, they should not be normal user-facing concepts in Studio.

A user should experience Studio as a simple blueprint authoring workspace. The product language should be about creating, continuing, editing, saving, publishing, and inserting values. Users should not need to understand that they are editing a draft, attaching source bindings, managing internal IDs, or writing reference syntax.

The current and planned architecture gives Lemma enough internal structure to hide these concepts safely. Studio can expose a simpler model while the server continues to enforce draft-only editing, optimistic locking, immutable versions, and source/reference integrity.

## Decision

Studio will use product-simple user-facing language and workflows.

Normal users edit blueprints, not drafts.

Internally, Studio may still load, save, publish, and route through drafts. The UI should not present drafts as the main product object.

Normal Studio UI must hide implementation concepts such as:

```text
draft
draftId
revision
expectedRevision
sourceId
fileId
workbookId
source binding
source artifact
reference ID
route intent
server draft
{{ .
```

Exceptions are allowed only in developer-facing diagnostics, tests, generated code, API code, ADRs, engineering docs, and explicit advanced/debug surfaces.

## Product Language

Use product/task language:

```text
Continue where you left off
Start a new blueprint
Save
Save changes
Changes saved
Publish
Blueprint published
Add reference
Workbook
Python
Literal
Inserted value
Unpublished changes
This changed in another tab
This work was already published
This work is no longer available
Some inserted values need attention
Review highlighted values before publishing
```

Avoid normal user-facing copy such as:

```text
Save draft
Publish draft
Draft saved
Draft published
expectedRevision
source binding
sourceId
fileId
workbookId
reference ID
{{ .reference }}
```

## Studio Routing

Studio has one real editor route:

```text
/studio?draftId=<draft-id>
```

This remains an internal routing mechanism.

User-facing navigation should not teach the user about `draftId`.

### `/studio`

`/studio` is a workspace landing page.

It must not implicitly create work.

It shows two primary actions:

```text
Continue where you left off
Start a new blueprint
```

The continue card shows the latest unfinished work when available:

```text
title
last edited time
unpublished changes state
```

The continue card may also include a secondary action for older work or published blueprints.

### `/studio?new=1`

This is an intent route.

It creates a new unpublished blueprint working copy and replaces the URL with:

```text
/studio?draftId=<draft-id>
```

The user-facing action is:

```text
Start a new blueprint
```

### `/studio?blueprintId=<blueprint-id>`

This is an intent route.

It creates or resumes editable work for a published blueprint and replaces the URL with:

```text
/studio?draftId=<draft-id>
```

The user-facing action is:

```text
Edit blueprint
```

or:

```text
Continue editing
```

### `/studio?draftId=<draft-id>`

This loads the editor.

This is the only true editor route.

### `/studio?blueprintId=<blueprint-id>&draftId=<draft-id>`

`draftId` wins.

The route loads the draft and normalizes the URL to:

```text
/studio?draftId=<draft-id>
```

### Terminal states

If a loaded working copy is already published, discarded, or unavailable, Studio shows product language:

```text
This work was already published.
Open blueprint
Start a new blueprint
```

or:

```text
This work is no longer available.
Go back to Studio
Start a new blueprint
```

Do not expose raw IDs, revisions, or internal statuses in normal UI.

## Save and Publish UX

Saving stores current unpublished work.

Publishing creates or updates the published blueprint version.

Normal copy:

```text
Save
Save changes
Changes saved
Publish
Blueprint published
Publish before generating questions
```

Avoid:

```text
Save draft
Draft saved
Publish draft
Draft published
Publish this draft before generating questions
```

Conflict copy should be user-facing:

```text
This changed in another tab.
Reload latest changes or keep working separately.
```

Avoid:

```text
DRAFT_REVISION_CONFLICT
expectedRevision mismatch
```

The API may still return those error codes. The UI maps them to product language.

## Add Reference Flow

Dynamic values are inserted through an Add reference flow.

Studio should not show persistent source upload panels, source status panels, or visible reference-management lists as the normal editing model.

The normal entry point is:

```text
Add reference
```

The first choice is source/value type:

```text
Workbook
Python
Literal
```

### Workbook

The workbook path lets the user:

1. choose an existing workbook source for this blueprint;
2. add a source when needed;
3. choose from library or upload a new file;
4. select a cell or range;
5. insert the selected value.

The user should not see source IDs, file IDs, workbook IDs, or source binding language.

### Python

Python may appear only as a disabled or placeholder option until sandboxed execution is implemented.

The UI must not imply Python execution is available before the backend sandbox model exists.

### Literal

Literal lets the user insert a static value.

The UI should present this as a normal value insertion, not as a “reference object.”

## Reference Rendering

References are internal.

Normal users should not see:

```text
{{ .reference }}
reference_1
workbook:source_1:cell:Sheet1:A1
sourceId
reference ID
```

Text, rich text, headings, and table cells should render inserted references as:

* preview values when resolvable;
* subtle edit-mode chips or inline inserted-value styling when editing;
* user-facing unresolved states when broken.

Example unresolved copy:

```text
This inserted value needs attention.
```

or:

```text
Review this inserted value before publishing.
```

Do not show raw internal reference IDs in normal UI.

## Broken and Unused References

Studio should prevent or repair broken reference states.

Rules:

1. Unused references should be stripped automatically when safe.
2. Removing a used source should be blocked or should require removing/replacing affected inserted values.
3. Source edits must not silently invalidate referenced sheets, cells, ranges, or outputs.
4. Broken references should be surfaced as targeted user-facing repair states.
5. Published blueprint versions and generated question sets must remain stable.

The UI should say:

```text
Some inserted values need attention.
Review highlighted values before publishing.
```

It should not say:

```text
Reference source sourceA missing.
reference_3 is invalid.
```

## Terminology Guard

Add regression coverage that scans normal Studio UI copy for implementation terms.

The guard should check normal user-facing UI copy for terms such as:

```text
draft
draftId
revision
expectedRevision
sourceId
fileId
workbookId
source binding
source artifact
reference ID
route intent
server draft
{{ .
```

The guard must exclude:

* tests;
* generated files;
* API/domain/application/infrastructure internals;
* ADRs and developer docs;
* explicit debug/advanced diagnostics if intentionally allowed.

Exceptions must be documented and narrow.

## Non-Goals

This ADR does not implement:

* source documents, source revisions, or source artifacts;
* full Python execution;
* Python sandbox worker runtime;
* full workbook editor;
* full reference dependency graph;
* full spreadsheet-like table editing;
* global file/source library redesign;
* marketing copy or external documentation;
* collaboration or multi-user editing.

This ADR only defines the product boundary for normal Studio authoring UX.

## Consequences

### Benefits

* Users interact with a simpler blueprint-authoring product.
* Internal architecture remains correct without leaking complexity.
* Future source revisions, artifacts, Python, and workbook editing can fit behind the same Add reference model.
* Draft-only authoring remains enforceable without teaching users draft mechanics.
* Reference and source integrity problems can be handled through repair UX instead of internal IDs.

### Costs

* UI needs mappers from internal API/domain terminology to product language.
* Tests must distinguish user-facing copy from internal implementation files.
* Some developer/debug information may require advanced surfaces instead of appearing in normal Studio.
* Add reference becomes a central interaction and must be designed carefully.

## Implementation Phases

### Phase 1: Product language and routing

* Make `/studio` a landing page.
* Add Continue where you left off and Start a new blueprint cards.
* Hide normal draft terminology.
* Keep draft-only route mechanics internally.

### Phase 2: Remove source/reference panels

* Remove persistent source upload/status panels.
* Remove visible reference-management list from normal Studio.
* Introduce Add reference as the normal entry point.

### Phase 3: Reference rendering

* Render inserted references as preview values or edit-mode chips.
* Hide `{{ . }}` syntax and reference IDs from normal UI.
* Add unresolved-value repair states.

### Phase 4: Integrity protection

* Strip unused references when safe.
* Block removal of used sources.
* Add used-where checks.
* Add repair UX for broken references.

### Phase 5: Regression guard

* Add terminology guard tests.
* Document narrow exceptions.

## Final Decision

Studio will present blueprint authoring as a product-simple workflow.

Users create, continue, save, publish, and add references. They do not manage drafts, source bindings, materialized files, workbook IDs, reference IDs, or canonical reference syntax.

The implementation may continue to use those concepts internally, but normal Studio UI must hide them behind clear product language and safe workflows.
