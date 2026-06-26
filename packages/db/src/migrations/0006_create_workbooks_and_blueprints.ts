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
      sql`document @> '{"schemaVersion":1}'::jsonb`,
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
      sql`document @> '{"schemaVersion":1}'::jsonb`,
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
    .addColumn("file_id", "uuid")
    .addColumn("workbook_id", "uuid", (c) => c.notNull())
    .addColumn("original_name", "text")
    .addColumn("byte_size", "bigint")
    .addColumn("checksum_sha256", "char(64)")
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
      "question_blueprint_version_sources_byte_size_check",
      sql`byte_size is null or byte_size > 0`,
    )
    .addCheckConstraint(
      "question_blueprint_version_sources_checksum_check",
      sql`checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$'`,
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
  await sql`drop trigger if exists workbooks_set_updated_at on workbooks`.execute(
    db,
  );
  await db.schema.dropTable("workbooks").execute();
}
