import { sql } from "kysely";
import type { MigrationDb } from "./helpers.js";

export async function up(db: MigrationDb): Promise<void> {
  await db.schema
    .alterTable("workbooks")
    .addUniqueConstraint("workbooks_owner_user_id_file_id_unique", [
      "owner_user_id",
      "file_id",
    ])
    .execute();

  await db.schema
    .createTable("question_blueprint_drafts")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("owner_user_id", "uuid", (c) => c.notNull())
    .addColumn("created_by_user_id", "uuid", (c) => c.notNull())
    .addColumn("blueprint_id", "uuid")
    .addColumn("base_version_id", "uuid")
    .addColumn("published_version_id", "uuid")
    .addColumn("publish_idempotency_key", "text")
    .addColumn("revision", "integer", (c) => c.notNull().defaultTo(1))
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("description", "text")
    .addColumn("document", "jsonb", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull().defaultTo("draft"))
    .addColumn("last_saved_at", "timestamptz", (c) => c.notNull())
    .addColumn("published_at", "timestamptz")
    .addColumn("discarded_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      "question_blueprint_drafts_status_check",
      sql`status in ('draft', 'publishing', 'published', 'discarded')`,
    )
    .addCheckConstraint(
      "question_blueprint_drafts_revision_check",
      sql`revision > 0`,
    )
    .addCheckConstraint(
      "question_blueprint_drafts_target_base_pair_check",
      sql`(base_version_id is null or blueprint_id is not null)
        and (status not in ('draft', 'publishing') or blueprint_id is null or base_version_id is not null)
        and (status <> 'published' or blueprint_id is not null)
        and (status <> 'published' or published_version_id is not null)
        and (status <> 'published' or publish_idempotency_key is not null)
        and (status = 'published' or published_version_id is null)
        and (status = 'published' or publish_idempotency_key is null)`,
    )
    .addCheckConstraint(
      "question_blueprint_drafts_publish_idempotency_key_check",
      sql`publish_idempotency_key is null or length(trim(publish_idempotency_key)) between 1 and 128`,
    )
    .addCheckConstraint(
      "question_blueprint_drafts_document_object_check",
      sql`jsonb_typeof(document) = 'object'`,
    )
    .addForeignKeyConstraint(
      "question_blueprint_drafts_owner_user_id_foreign",
      ["owner_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_blueprint_drafts_created_by_user_id_foreign",
      ["created_by_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_blueprint_drafts_blueprint_id_foreign",
      ["blueprint_id"],
      "question_blueprints",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_blueprint_drafts_base_version_id_foreign",
      ["base_version_id"],
      "question_blueprint_versions",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_blueprint_drafts_published_version_id_foreign",
      ["published_version_id"],
      "question_blueprint_versions",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await sql`
    alter table question_blueprint_drafts
    add constraint question_blueprint_drafts_base_version_same_blueprint_foreign
    foreign key (base_version_id, blueprint_id)
    references question_blueprint_versions(id, blueprint_id)
    on delete restrict
  `.execute(db);

  await sql`
    alter table question_blueprint_drafts
    add constraint question_blueprint_drafts_published_version_same_blueprint_foreign
    foreign key (published_version_id, blueprint_id)
    references question_blueprint_versions(id, blueprint_id)
    on delete restrict
  `.execute(db);

  await db.schema
    .createIndex("question_blueprint_drafts_owner_status_updated_index")
    .on("question_blueprint_drafts")
    .columns(["owner_user_id", "status", "updated_at"])
    .execute();
  await db.schema
    .createIndex("question_blueprint_drafts_blueprint_id_index")
    .on("question_blueprint_drafts")
    .column("blueprint_id")
    .where("blueprint_id", "is not", null)
    .execute();
  await sql`
    create unique index question_blueprint_drafts_owner_user_id_blueprint_id_active_unique
    on question_blueprint_drafts (owner_user_id, blueprint_id)
    where status in ('draft', 'publishing') and blueprint_id is not null
  `.execute(db);

  await db.schema
    .createTable("question_blueprint_draft_sources")
    .addColumn("draft_id", "uuid", (c) => c.notNull())
    .addColumn("source_id", "text", (c) => c.notNull())
    .addColumn("type", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("file_id", "uuid")
    .addColumn("source_document_id", "uuid")
    .addColumn("source_revision_id", "uuid")
    .addColumn("source_artifact_id", "uuid")
    .addColumn("workbook_id", "uuid")
    .addColumn("original_name", "text")
    .addColumn("byte_size", "bigint")
    .addColumn("checksum_sha256", "char(64)")
    .addColumn("status", "text", (c) => c.notNull().defaultTo("local"))
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addPrimaryKeyConstraint("question_blueprint_draft_sources_primary", [
      "draft_id",
      "source_id",
    ])
    .addCheckConstraint(
      "question_blueprint_draft_sources_source_id_check",
      sql`source_id ~ '^[A-Za-z][A-Za-z0-9_-]*$'`,
    )
    .addCheckConstraint(
      "question_blueprint_draft_sources_type_check",
      sql`type in ('workbook')`,
    )
    .addCheckConstraint(
      "question_blueprint_draft_sources_name_nonempty_check",
      sql`length(trim(name)) > 0`,
    )
    .addCheckConstraint(
      "question_blueprint_draft_sources_status_check",
      sql`status in ('local', 'uploaded', 'validated', 'invalid')`,
    )
    .addCheckConstraint(
      "question_blueprint_draft_sources_byte_size_check",
      sql`byte_size is null or byte_size > 0`,
    )
    .addCheckConstraint(
      "question_blueprint_draft_sources_checksum_check",
      sql`checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$'`,
    )
    .addCheckConstraint(
      "question_blueprint_draft_sources_materialization_completeness_check",
      sql`(
          status = 'local'
          and file_id is null
          and source_document_id is null
          and source_revision_id is null
          and source_artifact_id is null
          and workbook_id is null
          and original_name is null
          and byte_size is null
          and checksum_sha256 is null
        ) or (
          status in ('uploaded', 'validated', 'invalid')
          and file_id is not null
          and source_document_id is not null
          and source_revision_id is not null
          and source_artifact_id is not null
          and workbook_id is not null
          and original_name is not null
          and byte_size is not null
          and checksum_sha256 is not null
        )`,
    )
    .addForeignKeyConstraint(
      "question_blueprint_draft_sources_draft_id_foreign",
      ["draft_id"],
      "question_blueprint_drafts",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "question_blueprint_draft_sources_file_id_foreign",
      ["file_id"],
      "files",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_blueprint_draft_sources_source_document_id_foreign",
      ["source_document_id"],
      "source_documents",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_blueprint_draft_sources_source_revision_document_foreign",
      ["source_revision_id", "source_document_id"],
      "source_revisions",
      ["id", "source_document_id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_blueprint_draft_sources_source_artifact_revision_foreign",
      ["source_artifact_id", "source_revision_id"],
      "source_artifacts",
      ["id", "source_revision_id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_blueprint_draft_sources_workbook_id_foreign",
      ["workbook_id"],
      "workbooks",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await sql`
    create trigger question_blueprint_draft_sources_set_updated_at
    before update on question_blueprint_draft_sources
    for each row
    execute function set_updated_at()
  `.execute(db);

  await sql`
    create trigger question_blueprint_drafts_set_updated_at
    before update on question_blueprint_drafts
    for each row
    execute function set_updated_at()
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`drop trigger if exists question_blueprint_draft_sources_set_updated_at on question_blueprint_draft_sources`.execute(
    db,
  );
  await db.schema.dropTable("question_blueprint_draft_sources").execute();
  await sql`
    drop index if exists question_blueprint_drafts_owner_user_id_blueprint_id_active_unique
  `.execute(db);
  await db.schema.dropTable("question_blueprint_drafts").execute();
  await db.schema
    .alterTable("workbooks")
    .dropConstraint("workbooks_owner_user_id_file_id_unique")
    .execute();
}
