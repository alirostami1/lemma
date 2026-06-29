import { sql } from "kysely";
import type { MigrationDb } from "./helpers.js";

export async function up(db: MigrationDb): Promise<void> {
  await db.schema
    .alterTable("files")
    .addColumn("gc_claimed_at", "timestamptz")
    .addColumn("gc_claim_token", "text")
    .execute();
  // Kysely's AlterTableBuilder cannot add check constraints.
  await sql`
    alter table files
    add constraint files_gc_claim_pair_check
    check ((gc_claimed_at is null) = (gc_claim_token is null))
  `.execute(db);
  await sql`
    alter table files
    add constraint files_gc_claim_token_non_empty_check
    check (gc_claim_token is null or length(trim(gc_claim_token)) > 0)
  `.execute(db);
  // Pre-release file deletes may have left partial tombstone state. Normalize
  // those rows before the lifecycle check makes the invariant mandatory.
  await sql`
    update files
    set status = 'deleted'
    where status = 'uploaded'
      and deleted_at is not null
  `.execute(db);
  await sql`
    update files
    set retention_expires_at = deleted_at + interval '30 days'
    where status in ('deleting', 'deleted')
      and deleted_at is not null
      and retention_expires_at is null
  `.execute(db);
  await sql`
    update files
    set
      deleted_at = updated_at,
      retention_expires_at = updated_at + interval '30 days'
    where status in ('deleting', 'deleted')
      and deleted_at is null
  `.execute(db);
  await sql`
    alter table files
    add constraint files_tombstone_state_check
    check (
      (
        status = 'uploaded'
        and deleted_at is null
        and retention_expires_at is null
      )
      or
      (
        status in ('deleting', 'deleted')
        and deleted_at is not null
        and retention_expires_at is not null
      )
    )
  `.execute(db);
  await sql`
    alter table files
    add constraint files_gc_claim_status_check
    check (gc_claimed_at is null or status = 'deleting')
  `.execute(db);

  await db.schema
    .alterTable("workbooks")
    .addColumn("origin", "text", (column) =>
      column.notNull().defaultTo("standalone"),
    )
    .execute();
  // Existing workbook rows predate explicit provenance. Treat them as
  // standalone because source ownership cannot be proven without risking
  // retirement of user-visible workbook roots.
  await sql`
    alter table workbooks
    add constraint workbooks_origin_check
    check (origin in ('standalone', 'source_artifact'))
  `.execute(db);

  await db.schema
    .alterTable("source_documents")
    .addColumn("retention_expires_at", "timestamptz")
    .execute();
  // Existing pre-release rows may already be tombstoned via deleted_at. Backfill
  // their new retention deadline before installing the pair constraint.
  await sql`
    update source_documents
    set retention_expires_at = deleted_at + interval '90 days'
    where deleted_at is not null
      and retention_expires_at is null
  `.execute(db);
  // Kysely's AlterTableBuilder cannot add check constraints.
  await sql`
    alter table source_documents
    add constraint source_documents_delete_retention_pair_check
    check ((deleted_at is null) = (retention_expires_at is null))
  `.execute(db);
  await db.schema
    .alterTable("source_revisions")
    .addColumn("deleted_at", "timestamptz")
    .addColumn("retention_expires_at", "timestamptz")
    .execute();
  await sql`
    alter table source_revisions
    add constraint source_revisions_delete_retention_pair_check
    check ((deleted_at is null) = (retention_expires_at is null))
  `.execute(db);
  await db.schema
    .alterTable("source_artifacts")
    .addColumn("deleted_at", "timestamptz")
    .addColumn("retention_expires_at", "timestamptz")
    .addColumn("collected_at", "timestamptz")
    .execute();
  await sql`
    alter table source_artifacts
    add constraint source_artifacts_delete_retention_pair_check
    check ((deleted_at is null) = (retention_expires_at is null))
  `.execute(db);
  await sql`
    alter table source_artifacts
    add constraint source_artifacts_collected_requires_deleted_check
    check (collected_at is null or deleted_at is not null)
  `.execute(db);
  await sql`
    alter table source_artifacts
    add constraint source_artifacts_collected_status_check
    check (collected_at is null or status = 'deleted')
  `.execute(db);

  await db.schema
    .createIndex("files_gc_candidates_index")
    .on("files")
    .columns(["status", "retention_expires_at", "gc_claimed_at"])
    .execute();
  await db.schema
    .createIndex("source_artifacts_gc_candidates_index")
    .on("source_artifacts")
    .columns(["deleted_at", "retention_expires_at", "collected_at"])
    .execute();
  await db.schema
    .createIndex("source_revisions_gc_candidates_index")
    .on("source_revisions")
    .columns(["deleted_at", "retention_expires_at"])
    .execute();
}

export async function down(db: MigrationDb): Promise<void> {
  await db.schema.dropIndex("source_revisions_gc_candidates_index").execute();
  await db.schema.dropIndex("source_artifacts_gc_candidates_index").execute();
  await db.schema.dropIndex("files_gc_candidates_index").execute();
  await db.schema
    .alterTable("source_artifacts")
    .dropConstraint("source_artifacts_collected_status_check")
    .execute();
  await db.schema
    .alterTable("source_artifacts")
    .dropConstraint("source_artifacts_collected_requires_deleted_check")
    .execute();
  await db.schema
    .alterTable("source_artifacts")
    .dropConstraint("source_artifacts_delete_retention_pair_check")
    .execute();
  await db.schema
    .alterTable("source_artifacts")
    .dropColumn("collected_at")
    .dropColumn("retention_expires_at")
    .dropColumn("deleted_at")
    .execute();
  await db.schema
    .alterTable("source_revisions")
    .dropConstraint("source_revisions_delete_retention_pair_check")
    .execute();
  await db.schema
    .alterTable("source_revisions")
    .dropColumn("retention_expires_at")
    .dropColumn("deleted_at")
    .execute();
  await db.schema
    .alterTable("source_documents")
    .dropConstraint("source_documents_delete_retention_pair_check")
    .execute();
  await db.schema
    .alterTable("source_documents")
    .dropColumn("retention_expires_at")
    .execute();
  await db.schema
    .alterTable("workbooks")
    .dropConstraint("workbooks_origin_check")
    .execute();
  await db.schema.alterTable("workbooks").dropColumn("origin").execute();
  await db.schema
    .alterTable("files")
    .dropConstraint("files_gc_claim_status_check")
    .execute();
  await db.schema
    .alterTable("files")
    .dropConstraint("files_tombstone_state_check")
    .execute();
  await db.schema
    .alterTable("files")
    .dropConstraint("files_gc_claim_token_non_empty_check")
    .execute();
  await db.schema
    .alterTable("files")
    .dropConstraint("files_gc_claim_pair_check")
    .execute();
  await db.schema
    .alterTable("files")
    .dropColumn("gc_claim_token")
    .dropColumn("gc_claimed_at")
    .execute();
}
