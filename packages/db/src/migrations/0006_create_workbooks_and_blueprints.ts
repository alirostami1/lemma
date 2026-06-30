import { sql } from "kysely";
import type { MigrationDb } from "./helpers.js";

export async function up(db: MigrationDb): Promise<void> {
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
    .addUniqueConstraint("workbooks_id_owner_user_id_unique", [
      "id",
      "owner_user_id",
    ])
    .addCheckConstraint(
      "workbooks_name_nonempty_check",
      sql`length(trim(name)) > 0`,
    )
    .addCheckConstraint(
      "workbooks_original_name_nonempty_check",
      sql`length(trim(original_name)) > 0`,
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
  await db.schema
    .createIndex("workbooks_owner_user_id_status_created_at_index")
    .on("workbooks")
    .columns(["owner_user_id", "status", "created_at"])
    .execute();
  await db.schema
    .createIndex("workbooks_file_id_index")
    .on("workbooks")
    .column("file_id")
    .execute();
  await db.schema
    .createIndex("workbooks_checksum_sha256_index")
    .on("workbooks")
    .column("checksum_sha256")
    .execute();

  await sql`
    create trigger workbooks_set_updated_at
    before update on workbooks
    for each row
    execute function set_updated_at()
  `.execute(db);

  await db.schema
    .createTable("source_documents")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("owner_user_id", "uuid", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("kind", "text", (c) => c.notNull())
    .addColumn("current_revision_id", "uuid")
    .addColumn("status", "text", (c) => c.notNull().defaultTo("active"))
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")
    .addUniqueConstraint("source_documents_id_owner_kind_unique", [
      "id",
      "owner_user_id",
      "kind",
    ])
    .addCheckConstraint(
      "source_documents_name_nonempty_check",
      sql`length(trim(name)) > 0`,
    )
    .addCheckConstraint(
      "source_documents_kind_check",
      sql`kind in ('workbook', 'python')`,
    )
    .addCheckConstraint(
      "source_documents_status_check",
      sql`status in ('active', 'archived', 'deleted')`,
    )
    .addForeignKeyConstraint(
      "source_documents_owner_user_id_foreign",
      ["owner_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await db.schema
    .createTable("source_revisions")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("source_document_id", "uuid", (c) => c.notNull())
    .addColumn("owner_user_id", "uuid", (c) => c.notNull())
    .addColumn("kind", "text", (c) => c.notNull())
    .addColumn("file_id", "uuid")
    .addColumn("checksum_sha256", "char(64)", (c) => c.notNull())
    .addColumn("byte_size", "bigint", (c) => c.notNull())
    .addColumn("content_type", "text", (c) => c.notNull())
    .addColumn("created_by_user_id", "uuid", (c) => c.notNull())
    .addColumn("parent_revision_id", "uuid")
    .addColumn("editor_metadata", "jsonb", (c) =>
      c.notNull().defaultTo(sql`'{}'::jsonb`),
    )
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint("source_revisions_id_document_owner_kind_unique", [
      "id",
      "source_document_id",
      "owner_user_id",
      "kind",
    ])
    .addUniqueConstraint("source_revisions_id_owner_kind_unique", [
      "id",
      "owner_user_id",
      "kind",
    ])
    .addUniqueConstraint("source_revisions_id_document_unique", [
      "id",
      "source_document_id",
    ])
    .addCheckConstraint(
      "source_revisions_kind_check",
      sql`kind in ('workbook', 'python')`,
    )
    .addCheckConstraint("source_revisions_byte_size_check", sql`byte_size > 0`)
    .addCheckConstraint(
      "source_revisions_checksum_check",
      sql`checksum_sha256 ~ '^[a-f0-9]{64}$'`,
    )
    .addCheckConstraint(
      "source_revisions_content_type_nonempty_check",
      sql`length(trim(content_type)) > 0`,
    )
    .addCheckConstraint(
      "source_revisions_editor_metadata_object_check",
      sql`jsonb_typeof(editor_metadata) = 'object'`,
    )
    .addForeignKeyConstraint(
      "source_revisions_document_owner_kind_foreign",
      ["source_document_id", "owner_user_id", "kind"],
      "source_documents",
      ["id", "owner_user_id", "kind"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "source_revisions_owner_user_id_foreign",
      ["owner_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "source_revisions_file_id_foreign",
      ["file_id"],
      "files",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "source_revisions_created_by_user_id_foreign",
      ["created_by_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "source_revisions_parent_same_document_foreign",
      ["parent_revision_id", "source_document_id"],
      "source_revisions",
      ["id", "source_document_id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await sql`
    alter table source_documents
    add constraint source_documents_current_revision_id_foreign
    foreign key (current_revision_id, id, owner_user_id, kind)
    references source_revisions(id, source_document_id, owner_user_id, kind)
    on delete restrict
  `.execute(db);

  await db.schema
    .createTable("source_artifacts")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("source_revision_id", "uuid", (c) => c.notNull())
    .addColumn("owner_user_id", "uuid", (c) => c.notNull())
    .addColumn("kind", "text", (c) => c.notNull())
    .addColumn("processor", "text", (c) => c.notNull())
    .addColumn("processor_version", "text", (c) => c.notNull())
    .addColumn("status", "text", (c) =>
      c.notNull().defaultTo("pending_validation"),
    )
    .addColumn("workbook_id", "uuid")
    .addColumn("artifact_metadata", "jsonb", (c) =>
      c.notNull().defaultTo(sql`'{}'::jsonb`),
    )
    .addColumn("validation_error", "jsonb")
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint("source_artifacts_id_revision_owner_kind_unique", [
      "id",
      "source_revision_id",
      "owner_user_id",
      "kind",
    ])
    .addUniqueConstraint("source_artifacts_id_revision_unique", [
      "id",
      "source_revision_id",
    ])
    .addCheckConstraint(
      "source_artifacts_kind_check",
      sql`kind in ('workbook', 'python')`,
    )
    .addCheckConstraint(
      "source_artifacts_status_check",
      sql`status in ('pending_validation', 'valid', 'invalid', 'archived', 'deleted')`,
    )
    .addCheckConstraint(
      "source_artifacts_processor_nonempty_check",
      sql`length(trim(processor)) > 0`,
    )
    .addCheckConstraint(
      "source_artifacts_processor_version_nonempty_check",
      sql`length(trim(processor_version)) > 0`,
    )
    .addCheckConstraint(
      "source_artifacts_artifact_metadata_object_check",
      sql`jsonb_typeof(artifact_metadata) = 'object'`,
    )
    .addCheckConstraint(
      "source_artifacts_validation_error_object_check",
      sql`validation_error is null or jsonb_typeof(validation_error) = 'object'`,
    )
    .addCheckConstraint(
      "source_artifacts_valid_workbook_id_check",
      sql`status <> 'valid' or kind <> 'workbook' or workbook_id is not null`,
    )
    .addCheckConstraint(
      "source_artifacts_workbook_kind_check",
      sql`workbook_id is null or kind = 'workbook'`,
    )
    .addForeignKeyConstraint(
      "source_artifacts_revision_owner_kind_foreign",
      ["source_revision_id", "owner_user_id", "kind"],
      "source_revisions",
      ["id", "owner_user_id", "kind"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "source_artifacts_owner_user_id_foreign",
      ["owner_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "source_artifacts_workbook_id_foreign",
      ["workbook_id", "owner_user_id"],
      "workbooks",
      ["id", "owner_user_id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await db.schema
    .createIndex("source_documents_owner_status_kind_updated_index")
    .on("source_documents")
    .columns(["owner_user_id", "status", "kind", "updated_at"])
    .execute();
  await db.schema
    .createIndex("source_revisions_owner_kind_created_index")
    .on("source_revisions")
    .columns(["owner_user_id", "kind", "created_at"])
    .execute();
  await db.schema
    .createIndex("source_revisions_owner_workbook_content_index")
    .on("source_revisions")
    .columns([
      "owner_user_id",
      "kind",
      "checksum_sha256",
      "byte_size",
      "content_type",
    ])
    .execute();
  await db.schema
    .createIndex("source_artifacts_owner_status_kind_updated_index")
    .on("source_artifacts")
    .columns(["owner_user_id", "status", "kind", "updated_at"])
    .execute();
  await db.schema
    .createIndex("source_artifacts_owner_valid_processor_revision_index")
    .on("source_artifacts")
    .columns([
      "owner_user_id",
      "kind",
      "status",
      "processor",
      "processor_version",
      "source_revision_id",
    ])
    .execute();
  await sql`
    create trigger source_documents_set_updated_at
    before update on source_documents
    for each row
    execute function set_updated_at()
  `.execute(db);
  await sql`
    create trigger source_artifacts_set_updated_at
    before update on source_artifacts
    for each row
    execute function set_updated_at()
  `.execute(db);

  await db.schema
    .createTable("question_blueprints")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("owner_user_id", "uuid", (c) => c.notNull())
    .addColumn("created_by_user_id", "uuid", (c) => c.notNull())
    .addColumn("current_version_id", "uuid", (c) => c.notNull())
    .addColumn("name", "varchar(160)", (c) => c.notNull())
    .addColumn("description", "text")
    .addColumn("visibility", "text", (c) => c.notNull().defaultTo("private"))
    .addColumn("document", "jsonb", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull().defaultTo("active"))
    .addColumn("archived_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint("question_blueprints_id_owner_user_id_unique", [
      "id",
      "owner_user_id",
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
      "question_blueprints_document_object_check",
      sql`jsonb_typeof(document) = 'object'`,
    )
    .addCheckConstraint(
      "question_blueprints_document_schema_version_check",
      sql`document @> '{"schemaVersion":2}'::jsonb`,
    )
    .addCheckConstraint(
      "question_blueprints_document_blocks_check",
      sql`document ? 'blocks' and jsonb_typeof(document->'blocks') = 'array'`,
    )
    .addCheckConstraint(
      "question_blueprints_document_response_fields_check",
      sql`document ? 'responseFields' and jsonb_typeof(document->'responseFields') = 'array'`,
    )
    .addCheckConstraint(
      "question_blueprints_document_references_check",
      sql`document ? 'references' and jsonb_typeof(document->'references') = 'array'`,
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
    .execute();

  await db.schema
    .createTable("question_blueprint_versions")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("blueprint_id", "uuid", (c) => c.notNull())
    .addColumn("owner_user_id", "uuid", (c) => c.notNull())
    .addColumn("created_by_user_id", "uuid", (c) => c.notNull())
    .addColumn("version_number", "integer", (c) => c.notNull())
    .addColumn("parent_version_id", "uuid")
    .addColumn("name", "varchar(160)", (c) => c.notNull())
    .addColumn("description", "text")
    .addColumn("document", "jsonb", (c) => c.notNull())
    .addColumn("published_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint(
      "question_blueprint_versions_blueprint_id_version_number_unique",
      ["blueprint_id", "version_number"],
    )
    .addUniqueConstraint("question_blueprint_versions_id_blueprint_id_unique", [
      "id",
      "blueprint_id",
    ])
    .addCheckConstraint(
      "question_blueprint_versions_version_number_check",
      sql`version_number > 0`,
    )
    .addCheckConstraint(
      "question_blueprint_versions_name_nonempty_check",
      sql`length(trim(name)) > 0`,
    )
    .addCheckConstraint(
      "question_blueprint_versions_document_object_check",
      sql`jsonb_typeof(document) = 'object'`,
    )
    .addCheckConstraint(
      "question_blueprint_versions_document_schema_version_check",
      sql`document @> '{"schemaVersion":2}'::jsonb`,
    )
    .addCheckConstraint(
      "question_blueprint_versions_document_blocks_check",
      sql`document ? 'blocks' and jsonb_typeof(document->'blocks') = 'array'`,
    )
    .addCheckConstraint(
      "question_blueprint_versions_document_response_fields_check",
      sql`document ? 'responseFields' and jsonb_typeof(document->'responseFields') = 'array'`,
    )
    .addCheckConstraint(
      "question_blueprint_versions_document_references_check",
      sql`document ? 'references' and jsonb_typeof(document->'references') = 'array'`,
    )
    .addForeignKeyConstraint(
      "question_blueprint_versions_owner_user_id_foreign",
      ["owner_user_id"],
      "users",
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
    .addForeignKeyConstraint(
      "question_blueprint_versions_parent_version_id_foreign",
      ["parent_version_id"],
      "question_blueprint_versions",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await db.schema
    .createTable("question_blueprint_version_sources")
    .addColumn("blueprint_version_id", "uuid", (c) => c.notNull())
    .addColumn("source_id", "text", (c) => c.notNull())
    .addColumn("type", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("file_id", "uuid", (c) => c.notNull())
    .addColumn("source_document_id", "uuid", (c) => c.notNull())
    .addColumn("source_revision_id", "uuid", (c) => c.notNull())
    .addColumn("source_artifact_id", "uuid", (c) => c.notNull())
    .addColumn("workbook_id", "uuid", (c) => c.notNull())
    .addColumn("original_name", "text", (c) => c.notNull())
    .addColumn("byte_size", "bigint", (c) => c.notNull())
    .addColumn("checksum_sha256", "char(64)", (c) => c.notNull())
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addPrimaryKeyConstraint("question_blueprint_version_sources_primary", [
      "blueprint_version_id",
      "source_id",
    ])
    .addCheckConstraint(
      "question_blueprint_version_sources_source_id_check",
      sql`source_id ~ '^[A-Za-z][A-Za-z0-9_-]*$'`,
    )
    .addCheckConstraint(
      "question_blueprint_version_sources_type_check",
      sql`type in ('workbook')`,
    )
    .addCheckConstraint(
      "question_blueprint_version_sources_name_nonempty_check",
      sql`length(trim(name)) > 0`,
    )
    .addCheckConstraint(
      "question_blueprint_version_sources_original_name_nonempty_check",
      sql`length(trim(original_name)) > 0`,
    )
    .addCheckConstraint(
      "question_blueprint_version_sources_byte_size_check",
      sql`byte_size > 0`,
    )
    .addCheckConstraint(
      "question_blueprint_version_sources_checksum_check",
      sql`checksum_sha256 ~ '^[a-f0-9]{64}$'`,
    )
    .addForeignKeyConstraint(
      "question_blueprint_version_sources_blueprint_version_id_foreign",
      ["blueprint_version_id"],
      "question_blueprint_versions",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "question_blueprint_version_sources_file_id_foreign",
      ["file_id"],
      "files",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_blueprint_version_sources_source_document_id_foreign",
      ["source_document_id"],
      "source_documents",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_blueprint_version_sources_source_revision_document_foreign",
      ["source_revision_id", "source_document_id"],
      "source_revisions",
      ["id", "source_document_id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_blueprint_version_sources_source_artifact_revision_foreign",
      ["source_artifact_id", "source_revision_id"],
      "source_artifacts",
      ["id", "source_revision_id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_blueprint_version_sources_workbook_id_foreign",
      ["workbook_id"],
      "workbooks",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await sql`
    alter table question_blueprints
    add constraint question_blueprints_current_version_same_blueprint_foreign
    foreign key (current_version_id, id)
    references question_blueprint_versions(id, blueprint_id)
    on delete restrict
    deferrable initially deferred
  `.execute(db);
  await sql`
    alter table question_blueprint_versions
    add constraint question_blueprint_versions_blueprint_id_foreign
    foreign key (blueprint_id)
    references question_blueprints(id)
    on delete restrict
    deferrable initially deferred
  `.execute(db);
  await sql`
    alter table question_blueprint_versions
    add constraint question_blueprint_versions_parent_same_blueprint_foreign
    foreign key (parent_version_id, blueprint_id)
    references question_blueprint_versions(id, blueprint_id)
    on delete restrict
  `.execute(db);
  await sql`
    alter table question_blueprint_versions
    add constraint question_blueprint_versions_blueprint_owner_match_foreign
    foreign key (blueprint_id, owner_user_id)
    references question_blueprints(id, owner_user_id)
    on delete restrict
    deferrable initially deferred
  `.execute(db);

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
    .createIndex("question_blueprints_status_updated_at_index")
    .on("question_blueprints")
    .columns(["status", "updated_at"])
    .execute();
  await sql`
    create unique index question_blueprints_owner_user_id_name_active_unique
    on question_blueprints (owner_user_id, name)
    where status <> 'deleted'
  `.execute(db);
  await sql`
    create index question_blueprint_versions_blueprint_id_version_number_index
    on question_blueprint_versions (blueprint_id, version_number desc)
  `.execute(db);
  await sql`
    create index question_blueprint_versions_owner_user_id_published_at_index
    on question_blueprint_versions (owner_user_id, published_at desc)
  `.execute(db);

  await sql`
    create trigger question_blueprints_set_updated_at
    before update on question_blueprints
    for each row
    execute function set_updated_at()
  `.execute(db);

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
}

export async function down(db: MigrationDb): Promise<void> {
  await db.schema.dropTable("question_blueprint_members").execute();
  await sql`drop trigger if exists question_blueprints_set_updated_at on question_blueprints`.execute(
    db,
  );
  await sql`drop index if exists question_blueprint_versions_owner_user_id_published_at_index`.execute(
    db,
  );
  await sql`drop index if exists question_blueprint_versions_blueprint_id_version_number_index`.execute(
    db,
  );
  await sql`drop index if exists question_blueprints_owner_user_id_name_active_unique`.execute(
    db,
  );
  await sql`
    alter table question_blueprints
    drop constraint if exists question_blueprints_current_version_same_blueprint_foreign
  `.execute(db);
  await sql`
    alter table question_blueprint_versions
    drop constraint if exists question_blueprint_versions_blueprint_owner_match_foreign
  `.execute(db);
  await sql`
    alter table question_blueprint_versions
    drop constraint if exists question_blueprint_versions_parent_same_blueprint_foreign
  `.execute(db);
  await sql`
    alter table question_blueprint_versions
    drop constraint if exists question_blueprint_versions_blueprint_id_foreign
  `.execute(db);
  await db.schema.dropTable("question_blueprint_version_sources").execute();
  await db.schema.dropTable("question_blueprint_versions").execute();
  await db.schema.dropTable("question_blueprints").execute();
  await sql`drop trigger if exists source_artifacts_set_updated_at on source_artifacts`.execute(
    db,
  );
  await sql`drop trigger if exists source_documents_set_updated_at on source_documents`.execute(
    db,
  );
  await db.schema.dropTable("source_artifacts").execute();
  await sql`
    alter table source_documents
    drop constraint if exists source_documents_current_revision_id_foreign
  `.execute(db);
  await db.schema.dropTable("source_revisions").execute();
  await db.schema.dropTable("source_documents").execute();
  await sql`drop trigger if exists workbooks_set_updated_at on workbooks`.execute(
    db,
  );
  await db.schema.dropTable("workbooks").execute();
}
