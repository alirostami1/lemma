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
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("description", "text")
    .addColumn("document", "jsonb", (c) => c.notNull())
    .addColumn("sources", "jsonb", (c) =>
      c.notNull().defaultTo(sql`'[]'::jsonb`),
    )
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
      "question_blueprint_drafts_document_object_check",
      sql`jsonb_typeof(document) = 'object'`,
    )
    .addCheckConstraint(
      "question_blueprint_drafts_sources_array_check",
      sql`jsonb_typeof(sources) = 'array'`,
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
    .execute();

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

  await db.schema
    .createTable("question_blueprint_draft_source_files")
    .addColumn("draft_id", "uuid", (c) => c.notNull())
    .addColumn("source_id", "text", (c) => c.notNull())
    .addColumn("file_id", "uuid", (c) => c.notNull())
    .addColumn("original_name", "text", (c) => c.notNull())
    .addColumn("byte_size", "bigint", (c) => c.notNull())
    .addColumn("checksum_sha256", "char(64)", (c) => c.notNull())
    .addColumn("content_type", "text", (c) => c.notNull())
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addPrimaryKeyConstraint("question_blueprint_draft_source_files_primary", [
      "draft_id",
      "source_id",
    ])
    .addCheckConstraint(
      "question_blueprint_draft_source_files_source_id_check",
      sql`source_id ~ '^[A-Za-z][A-Za-z0-9_-]*$'`,
    )
    .addCheckConstraint(
      "question_blueprint_draft_source_files_byte_size_check",
      sql`byte_size > 0`,
    )
    .addCheckConstraint(
      "question_blueprint_draft_source_files_checksum_check",
      sql`checksum_sha256 ~ '^[a-f0-9]{64}$'`,
    )
    .addCheckConstraint(
      "question_blueprint_draft_source_files_content_type_check",
      sql`content_type in ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')`,
    )
    .addForeignKeyConstraint(
      "question_blueprint_draft_source_files_draft_id_foreign",
      ["draft_id"],
      "question_blueprint_drafts",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "question_blueprint_draft_source_files_file_id_foreign",
      ["file_id"],
      "files",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await sql`
    create trigger question_blueprint_drafts_set_updated_at
    before update on question_blueprint_drafts
    for each row
    execute function set_updated_at()
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await db.schema.dropTable("question_blueprint_draft_source_files").execute();
  await db.schema.dropTable("question_blueprint_drafts").execute();
  await db.schema
    .alterTable("workbooks")
    .dropConstraint("workbooks_owner_user_id_file_id_unique")
    .execute();
}
