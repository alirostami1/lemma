# ADR 0002: Draft-Only Authoring, Immutable Blueprint Versions, and Source Artifact Lifecycle

## Status

Accepted.

References: #97, #98, #95

## Context

Lemma is pre-production, so breaking changes are acceptable when they improve long-term security, maintainability, and product clarity. Current authoring mixes direct blueprint save paths, server drafts, local browser draft state, and workbook upload state. That makes later Excel editing, Python sources, source deletion, and reproducible generated questions fragile.

Future roadmap requirements include:

- editing Excel/workbook sources directly in Studio
- adding editable source types such as Python
- publishing new blueprint versions that depend on updated source revisions
- keeping old blueprint versions and generated question sets stable when source files are edited, deleted, or reused elsewhere

## Decision

Adopt a Git-inspired but product-simple lifecycle model:

- `Draft` is a mutable working copy.
- `Blueprint` is the stable user-visible object.
- `BlueprintVersion` is an immutable published snapshot.
- `SourceDocument` is a mutable user-visible source identity.
- `SourceRevision` is an immutable content revision.
- `SourceArtifact` is a validated or processed artifact derived from a source revision.
- `File` is an upload/import/export alias, not durable source ownership.
- Garbage Collector is the only component allowed to physically delete unreachable content.

Studio edits drafts only. Published blueprints are immutable. Publishing a draft creates a new immutable blueprint version and moves the blueprint current-version pointer only when the draft is based on the current version.

## Product Rules

- Published blueprints are immutable.
- Editing a published blueprint creates or resumes an active draft based on the blueprint current version.
- Studio edits drafts only.
- `/studio?draftId=D` is the only true editor route in the target architecture.
- `/studio` becomes a landing page in a later phase and must not silently create a draft.
- `/studio?blueprintId=B` becomes an intent route in a later phase. It creates or resumes an edit draft, then normalizes to `/studio?draftId=D`.
- When both `blueprintId` and `draftId` are present, `draftId` wins.
- History is linear for v1. Branching is represented by duplicate-as-new-blueprint.
- Publish is fast-forward-only: `draft.baseVersionId == blueprint.currentVersionId`.
- One active edit draft exists per user per blueprint.
- Published blueprint names are unique per owner among non-deleted blueprints.
- Default names are `Untitled blueprint`, `Untitled blueprint 2`, `Untitled blueprint 3`, and so on.
- Targeted edit drafts may display `<Blueprint name> - unpublished draft`; uniqueness is enforced at publish time.
- v1 is single-user editing. Keep schema extensible for team ownership later.

## Source Model

`SourceDocument` is the user-visible editable source identity, such as a workbook or Python script. It is mutable only by moving its head pointer to a new revision.

`SourceRevision` is immutable source content. Uploaded XLSX content, web-edited workbook content, and Python source code all create source revisions. Revisions may point to a parent revision for linear history.

`SourceArtifact` is a validated, processed, or executable representation derived from a source revision. Workbook artifacts record inspection and validation. Python artifacts record runtime metadata, static analysis, validation state, and execution policy.

Draft source bindings are mutable and belong to drafts. The client may send authoring intent such as:

```text
sourceId
sourceName
kind
```

The server owns source materialization fields:

```text
sourceDocumentId
sourceRevisionId
sourceArtifactId
fileId
workbookId
checksum
byteSize
validation state
processor metadata
```

Published blueprint versions snapshot source bindings immutably. Published versions never point to floating "latest source" references; they pin exact source revisions and artifacts.

Excel/Python editors create new source revisions. They never mutate artifacts used by published versions.

## Routing Target

- `/studio`: Studio landing page with recent drafts and create/open actions.
- `/studio?new=1`: create a new untargeted draft, then replace URL with `/studio?draftId=D`.
- `/studio?blueprintId=B`: create or resume an edit draft for blueprint `B`, then replace URL with `/studio?draftId=D`.
- `/studio?draftId=D`: load and edit draft `D`.
- `/studio?blueprintId=B&draftId=D`: `draftId` wins; load draft `D` and normalize to `/studio?draftId=D`.
- After publish: redirect to the blueprint detail page. The old draft route should show a non-editable published-draft state.

## API Target Shape

Create new draft:

```text
POST /api/v1/question-blueprint-drafts
```

Create or resume edit draft:

```text
POST /api/v1/question-blueprints/{blueprintId}/edit-draft
```

Update draft:

```text
PATCH /api/v1/question-blueprint-drafts/{draftId}
```

Save a source revision from an editor:

```text
POST /api/v1/source-documents/{sourceDocumentId}/revisions
POST /api/v1/question-blueprint-drafts/{draftId}/sources/{sourceId}/revisions
```

Attach uploaded file to a draft source:

```text
PUT /api/v1/question-blueprint-drafts/{draftId}/sources/{sourceId}/file
```

Publish draft:

```text
POST /api/v1/question-blueprint-drafts/{draftId}/publish
```

Publish must be transactional or resumable, idempotent by idempotency key, and conflict when draft revision or blueprint base version is stale.

## Security Decisions

Client must not control server-owned source materialization fields. Generic draft updates must not accept trusted values for `fileId`, `sourceRevisionId`, `sourceArtifactId`, checksum, byte size, validation status, workbook ID, Python artifact ID, or processor metadata.

Python execution must not happen in the API process. Python validation and execution require a sandboxed worker with CPU, memory, wall-clock, filesystem, network, runtime, and audit controls.

## Deletion/Retention Decisions

No user-facing delete action physically deletes file or source content.

Only retention-aware background garbage collection may physically delete content, and only when content is unreachable from all protected roots after retention.

Soft delete applies to blueprints, blueprint versions, drafts, files, source documents, source revisions, source artifacts, question sets, and related generated state.

Protected roots include active file aliases, active source documents, active drafts, published blueprint versions, generated question sets, generation runs under retention, workbook calculations or snapshots under retention, and audit/legal retention records.

Deleting one blueprint removes only that blueprint reference. Shared source artifacts remain while any protected root references them.

## Consequences

Benefits:

- Published blueprints become stable and reproducible.
- Editing published blueprints no longer risks mutating live content.
- Multiple blueprint versions can safely share source artifacts.
- Deleting blueprints/files does not break other blueprints.
- Web-edited Excel and future Python sources fit the same architecture.
- Version history remains linear and understandable.

Costs:

- More tables and more explicit lifecycle logic.
- Source validation becomes a first-class workflow.
- Publishing becomes more complex.
- Garbage collection must be implemented carefully.
- UI must distinguish draft, published version, source document, and source revision.

## Implementation Phases

Phase 0:

- Land this ADR as architecture source of truth.
- Add protective tests around current Studio/draft behavior.
- Do not implement blueprint versions, source artifacts, schema migrations, new publish semantics, or Studio routing changes.

Phase 1:

- Add `question_blueprint_versions`.
- Add draft revision and base version.
- Make Studio edit drafts only.
- Implement create/resume edit draft.
- Implement fast-forward-only publish.
- Remove direct blueprint save from Studio.

Phase 2:

- Add draft and version source binding tables.
- Stop accepting server-owned source materialization fields from generic draft update requests.
- Keep old JSON source fields temporarily only for migration or response compatibility.

Phase 3:

- Introduce source documents, source revisions, and source artifacts.
- Migrate workbook usage to artifacts derived from source revisions.

Phase 4:

- Make file deletion reference-aware.
- Add retention-aware garbage collection.
- Ensure physical object deletion happens only through GC.

Phase 5:

- Save workbook editor output as new source revisions.
- Validate revisions into workbook artifacts.
- Bind draft sources to artifacts.
- Publish versions with pinned artifact snapshots.

Phase 6:

- Add Python source kind.
- Add Python validation pipeline and sandboxed execution worker.
- Snapshot Python artifacts into blueprint versions.

## Explicit Non-Goals

Phase 0 non-goals:

- no blueprint version implementation
- no source document/revision/artifact implementation
- no schema migrations
- no new publish semantics
- no Studio routing behavior changes
- no direct browser integration test requirement beyond focused protective coverage

v1 non-goals:

- no visible branching
- no merge UI
- no force publish
- no collaborative editing semantics
- no global cross-user deduplication
- no API-process Python execution
- no user action that physically deletes source/file content

## Final Decision

Adopt a draft-only, immutable-version, source-revision architecture. Files are import/export aliases. Blueprints and drafts reference immutable source artifacts through explicit source bindings. Published versions pin exact source revisions and artifacts. User edits to Excel or Python create new source revisions and never mutate artifacts used by existing published versions.
