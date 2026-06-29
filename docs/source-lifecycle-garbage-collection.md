# Source lifecycle garbage collection

User-facing deletion creates tombstones. Only collector services may physically
delete file content or finalize collected source artifacts.

## Retention defaults

- discarded drafts: 30 days
- deleted file aliases: 30 days
- deleted blueprints: 90 days
- deleted source documents, revisions, and artifacts: 90 days
- generated question sets: retained until explicitly deleted
- generation runs: conservatively retained while any row exists
- workbook calculations and snapshots: conservatively retained while any row
  exists

The conservative run/calculation rules remain until product retention periods
are defined. Their nullable retention columns are intentionally not added yet;
the repository names make the permanent behavior explicit.

## File collection

`FilesService.deleteFile` atomically moves an uploaded alias to `deleting`,
records `deletedAt`, and sets `retentionExpiresAt`. Repeated deletion preserves
the original deadline and never calls object storage.

The file collector locks the candidate row, validates a non-blank claim token,
recomputes every persisted root, and records a leased claim before deleting
storage content. Draft attachment and standalone workbook creation use the
Files-owned reference guard to lock and verify the same file row before
creating a reference, so they cannot race a collector claim. Storage deletion
is idempotent; if DB finalization fails, the same claim can retry immediately
and a different collector can reclaim an expired lease.

File roots include active aliases, active source documents, active workbooks,
active drafts, uncollected artifacts, artifactless source revisions retained
conservatively, published version snapshots, active generated questions,
generated question-set memberships conservatively retained while the set is
active, every persisted generation run, and every persisted workbook
calculation and snapshot. Deleted aliases, deleted source documents, collected
artifacts, deleted workbooks, deleted generated questions, and deleted question
sets do not count as their non-conservative active roots. No audit/legal-hold
tables currently exist.

## Source collection

Deleting a source document tombstones the document and all of its persisted
revisions and artifacts with one 90-day deadline. Existing artifacts keep their
validation state so published versions and generated outputs remain usable.

The source artifact collector locks the artifact, recomputes protected roots,
and changes it to `deleted` only after retention expires and every root is gone.
Published version sources, active drafts/documents/file aliases, active
generated questions, active generated question-set memberships retained
conservatively, all runs, and all workbook calculations/snapshots block
collection. If a conditional collection update loses a race and the artifact is
still eligible, the service returns `retry` with `collection_conflict` rather
than reporting the artifact as skipped.

Workbook source artifacts create backing workbook rows with
`workbooks.origin = 'source_artifact'`. Standalone/user-visible workbooks use
`origin = 'standalone'` and are never retired by source artifact collection.
If a user explicitly creates a standalone workbook from a file that already has
a source-owned backing workbook, `WorkbookService.createWorkbook` locks the
file alias through the Files-owned reference guard and promotes that workbook
to `origin = 'standalone'` in the same transaction before returning it. Deleted
existing workbook rows are not reactivated through this path.

When an eligible source artifact is collected, the collector may also retire
the backing workbook by setting `workbooks.status = 'deleted'`, but only when
the workbook is explicitly source-artifact-owned and no other uncollected source
artifact owns that workbook. Historical published version snapshots, generated
questions, question sets, calculations, and snapshots are not mutated; if any
of those roots still exist, source artifact collection is blocked before
workbook retirement.

Rows that existed before `workbooks.origin` are backfilled as `standalone`.
That is intentionally conservative: source ownership cannot be proven safely for
old rows, so source artifact GC will only retire newly proven source-owned
workbooks. Old rows may remain active file roots until an explicit data cleanup
can prove ownership.

Source revision rows retain immutable lineage metadata. Revisions with
artifacts inherit artifact collection. Revisions without artifacts are named
and counted as conservative permanent file roots until a future source revision
collector is implemented. Follow-up: `sources: implement source revision
collection/finalization`.

## Deferred execution

Scheduled candidate discovery and batching are not implemented. Worker-owned
background GC is not active. Application collector services are implemented and
can safely be called by a later worker scheduler. Audit/legal-hold roots must be
added if those persistence tables are introduced. Follow-up: `gc: schedule
retention-aware file and source collectors`.
