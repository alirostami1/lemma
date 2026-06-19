import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  await db.schema
    .createTable("workbooks")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("owner_user_id", "uuid", (c) => c.notNull())
    .addColumn("created_by_user_id", "uuid", (c) => c.notNull())
    .addColumn("name", "varchar(160)", (c) => c.notNull())
    .addColumn("file_id", "uuid", (c) => c.notNull())
    .addColumn("checksum_sha256", "char(64)", (c) => c.notNull())
    .addColumn("original_name", "text", (c) => c.notNull())
    .addColumn("engine", "text", (c) => c.notNull())
    .addColumn("engine_version", "text")
    .addColumn("status", "text", (c) =>
      c.notNull().defaultTo("pending_validation"),
    )
    .addColumn("inspection", "jsonb")
    .addColumn("validation_error", "text")
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      "workbooks_name_nonempty_check",
      sql`length(trim(name)) > 0`,
    )
    .addCheckConstraint(
      "workbooks_checksum_sha256_check",
      sql`checksum_sha256 ~ '^[a-f0-9]{64}$'`,
    )
    .addCheckConstraint(
      "workbooks_engine_check",
      sql`engine in ('cached', 'libreoffice')`,
    )
    .addCheckConstraint(
      "workbooks_status_check",
      sql`status in ('pending_validation', 'valid', 'invalid', 'archived', 'deleted')`,
    )
    .addCheckConstraint(
      "workbooks_inspection_object_check",
      sql`inspection is null or jsonb_typeof(inspection) = 'object'`,
    )
    .addForeignKeyConstraint(
      "workbooks_owner_user_id_foreign",
      ["owner_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "workbooks_created_by_user_id_foreign",
      ["created_by_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "workbooks_file_id_foreign",
      ["file_id"],
      "files",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await db.schema
    .createIndex("workbooks_owner_user_id_created_at_index")
    .on("workbooks")
    .columns(["owner_user_id", "created_at"])
    .execute();

  await sql`
    create trigger workbooks_set_updated_at
    before update on workbooks
    for each row
    execute function set_updated_at()
  `.execute(db);

  await db.schema
    .createTable("question_blueprints")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("owner_user_id", "uuid", (c) => c.notNull())
    .addColumn("created_by_user_id", "uuid", (c) => c.notNull())
    .addColumn("name", "varchar(160)", (c) => c.notNull())
    .addColumn("description", "text")
    .addColumn("visibility", "text", (c) => c.notNull().defaultTo("private"))
    .addColumn("workbook_id", "uuid")
    .addColumn("workbook_sources", "jsonb", (c) =>
      c.notNull().defaultTo(sql`'[]'::jsonb`),
    )
    .addColumn("current_version_id", "uuid")
    .addColumn("status", "text", (c) => c.notNull().defaultTo("active"))
    .addColumn("archived_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint("question_blueprints_owner_user_id_name_unique", [
      "owner_user_id",
      "name",
    ])
    .addCheckConstraint(
      "question_blueprints_status_check",
      sql`status in ('active', 'archived', 'deleted')`,
    )
    .addCheckConstraint(
      "question_blueprints_visibility_check",
      sql`visibility in ('private', 'shared', 'system')`,
    )
    .addCheckConstraint(
      "question_blueprints_name_nonempty_check",
      sql`length(trim(name)) > 0`,
    )
    .addCheckConstraint(
      "question_blueprints_workbook_sources_array_check",
      sql`jsonb_typeof(workbook_sources) = 'array'`,
    )
    .addForeignKeyConstraint(
      "question_blueprints_owner_user_id_foreign",
      ["owner_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_blueprints_created_by_user_id_foreign",
      ["created_by_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_blueprints_workbook_id_foreign",
      ["workbook_id"],
      "workbooks",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await db.schema
    .createIndex("question_blueprints_owner_user_id_status_created_at_index")
    .on("question_blueprints")
    .columns(["owner_user_id", "status", "created_at"])
    .execute();

  await db.schema
    .createIndex("question_blueprints_created_by_user_id_created_at_index")
    .on("question_blueprints")
    .columns(["created_by_user_id", "created_at"])
    .execute();

  await db.schema
    .createIndex("question_blueprints_workbook_id_index")
    .on("question_blueprints")
    .column("workbook_id")
    .execute();

  await db.schema
    .createIndex("question_blueprints_current_version_id_index")
    .on("question_blueprints")
    .column("current_version_id")
    .execute();

  await db.schema
    .createTable("question_blueprint_versions")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("question_blueprint_id", "uuid", (c) => c.notNull())
    .addColumn("version_number", "integer", (c) => c.notNull())
    .addColumn("document", "jsonb", (c) => c.notNull())
    .addColumn("workbook_id", "uuid")
    .addColumn("workbook_sources", "jsonb", (c) =>
      c.notNull().defaultTo(sql`'[]'::jsonb`),
    )
    .addColumn("created_by_user_id", "uuid", (c) => c.notNull())
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint(
      "question_blueprint_versions_blueprint_id_version_number_unique",
      ["question_blueprint_id", "version_number"],
    )
    .addCheckConstraint(
      "question_blueprint_versions_version_number_check",
      sql`version_number > 0`,
    )
    .addCheckConstraint(
      "question_blueprint_versions_document_object_check",
      sql`jsonb_typeof(document) = 'object'`,
    )
    .addCheckConstraint(
      "question_blueprint_versions_document_schema_version_check",
      sql`document ? 'schemaVersion'`,
    )
    .addCheckConstraint(
      "question_blueprint_versions_document_blocks_check",
      sql`document ? 'blocks'`,
    )
    .addCheckConstraint(
      "question_blueprint_versions_document_response_fields_check",
      sql`document ? 'responseFields'`,
    )
    .addCheckConstraint(
      "question_blueprint_versions_document_references_check",
      sql`document ? 'references'`,
    )
    .addCheckConstraint(
      "question_blueprint_versions_document_blocks_array_check",
      sql`jsonb_typeof(document->'blocks') = 'array'`,
    )
    .addCheckConstraint(
      "question_blueprint_versions_document_response_fields_array_check",
      sql`jsonb_typeof(document->'responseFields') = 'array'`,
    )
    .addCheckConstraint(
      "question_blueprint_versions_document_references_array_check",
      sql`jsonb_typeof(document->'references') = 'array'`,
    )
    .addCheckConstraint(
      "question_blueprint_versions_workbook_sources_array_check",
      sql`jsonb_typeof(workbook_sources) = 'array'`,
    )
    .addForeignKeyConstraint(
      "question_blueprint_versions_question_blueprint_id_foreign",
      ["question_blueprint_id"],
      "question_blueprints",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "question_blueprint_versions_workbook_id_foreign",
      ["workbook_id"],
      "workbooks",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_blueprint_versions_created_by_user_id_foreign",
      ["created_by_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await db.schema
    .createIndex(
      "question_blueprint_versions_blueprint_id_version_number_index",
    )
    .on("question_blueprint_versions")
    .columns(["question_blueprint_id", "version_number"])
    .execute();

  await db.schema
    .createIndex("question_blueprint_versions_workbook_id_index")
    .on("question_blueprint_versions")
    .column("workbook_id")
    .execute();

  await db.schema
    .createIndex(
      "question_blueprint_versions_created_by_user_id_created_at_index",
    )
    .on("question_blueprint_versions")
    .columns(["created_by_user_id", "created_at"])
    .execute();

  await db.schema
    .alterTable("question_blueprints")
    .addForeignKeyConstraint(
      "question_blueprints_current_version_id_foreign",
      ["current_version_id"],
      "question_blueprint_versions",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await db.schema
    .createTable("question_blueprint_members")
    .addColumn("blueprint_id", "uuid", (c) => c.notNull())
    .addColumn("user_id", "uuid", (c) => c.notNull())
    .addColumn("role", "text", (c) => c.notNull())
    .addColumn("granted_by_user_id", "uuid")
    .addColumn("expires_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addPrimaryKeyConstraint("question_blueprint_members_primary", [
      "blueprint_id",
      "user_id",
    ])
    .addCheckConstraint(
      "question_blueprint_members_role_check",
      sql`role in ('viewer', 'runner', 'editor', 'manager')`,
    )
    .addForeignKeyConstraint(
      "question_blueprint_members_blueprint_id_foreign",
      ["blueprint_id"],
      "question_blueprints",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "question_blueprint_members_user_id_foreign",
      ["user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "question_blueprint_members_granted_by_user_id_foreign",
      ["granted_by_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("set null"),
    )
    .execute();

  await db.schema
    .createIndex("question_blueprint_members_user_id_blueprint_id_index")
    .on("question_blueprint_members")
    .columns(["user_id", "blueprint_id"])
    .execute();

  await db.schema
    .createIndex("question_blueprint_members_role_index")
    .on("question_blueprint_members")
    .column("role")
    .execute();

  await db.schema
    .createIndex("question_blueprint_members_expires_at_index")
    .on("question_blueprint_members")
    .column("expires_at")
    .execute();

  await sql`
    create or replace function prevent_question_blueprint_version_update()
    returns trigger as $$
    begin
      raise exception 'question_blueprint_versions are immutable';
    end;
    $$ language plpgsql
  `.execute(db);

  await sql`
    create trigger question_blueprint_versions_prevent_update
    before update on question_blueprint_versions
    for each row
    execute function prevent_question_blueprint_version_update()
  `.execute(db);

  await sql`
    create trigger question_blueprints_set_updated_at
    before update on question_blueprints
    for each row
    execute function set_updated_at()
  `.execute(db);
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`drop trigger if exists question_blueprints_set_updated_at on question_blueprints`.execute(
    db,
  );
  await sql`drop trigger if exists question_blueprint_versions_prevent_update on question_blueprint_versions`.execute(
    db,
  );
  await sql`drop function if exists prevent_question_blueprint_version_update()`.execute(
    db,
  );
  await sql`alter table if exists question_blueprints drop constraint if exists question_blueprints_current_version_id_foreign`.execute(
    db,
  );
  await db.schema.dropTable("question_blueprint_members").execute();
  await db.schema.dropTable("question_blueprint_versions").execute();
  await db.schema.dropTable("question_blueprints").execute();
  await sql`drop trigger if exists workbooks_set_updated_at on workbooks`.execute(
    db,
  );
  await db.schema.dropTable("workbooks").execute();
}
