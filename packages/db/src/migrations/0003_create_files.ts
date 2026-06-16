import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("file_uploads")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("created_by_user_id", "uuid", (c) => c.notNull())
    .addColumn("bucket", "text", (c) => c.notNull())
    .addColumn("object_key", "text", (c) => c.notNull())
    .addColumn("original_name", "varchar(500)", (c) => c.notNull())
    .addColumn("content_type", "text", (c) => c.notNull())
    .addColumn("expected_byte_size", "bigint", (c) => c.notNull())
    .addColumn("checksum_sha256", "char(64)", (c) => c.notNull())
    .addColumn("purpose", "text", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull().defaultTo("initiated"))
    .addColumn("metadata", "jsonb", (c) =>
      c.notNull().defaultTo(sql`'{}'::jsonb`),
    )
    .addColumn("upload_expires_at", "timestamptz", (c) => c.notNull())
    .addColumn("completed_at", "timestamptz")
    .addColumn("last_error", "text")
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint("file_uploads_bucket_object_key_unique", [
      "bucket",
      "object_key",
    ])
    .addCheckConstraint(
      "file_uploads_status_check",
      sql`status in ('initiated', 'verified', 'failed', 'expired', 'cancelled')`,
    )
    .addCheckConstraint(
      "file_uploads_purpose_check",
      sql`purpose in ('workbook')`,
    )
    .addCheckConstraint(
      "file_uploads_expected_byte_size_positive_check",
      sql`expected_byte_size > 0`,
    )
    .addCheckConstraint(
      "file_uploads_checksum_sha256_check",
      sql`checksum_sha256 ~ '^[a-f0-9]{64}$'`,
    )
    .addCheckConstraint(
      "file_uploads_metadata_object_check",
      sql`jsonb_typeof(metadata) = 'object'`,
    )
    .addForeignKeyConstraint(
      "file_uploads_created_by_user_id_foreign",
      ["created_by_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await db.schema
    .createIndex("file_uploads_created_by_user_id_created_at_index")
    .on("file_uploads")
    .columns(["created_by_user_id", "created_at"])
    .execute();

  await db.schema
    .createIndex("file_uploads_status_upload_expires_at_index")
    .on("file_uploads")
    .columns(["status", "upload_expires_at"])
    .execute();

  await db.schema
    .createIndex("file_uploads_purpose_created_at_index")
    .on("file_uploads")
    .columns(["purpose", "created_at"])
    .execute();

  await db.schema
    .createTable("files")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("upload_id", "uuid", (c) => c.unique())
    .addColumn("owner_user_id", "uuid", (c) => c.notNull())
    .addColumn("created_by_user_id", "uuid", (c) => c.notNull())
    .addColumn("bucket", "text", (c) => c.notNull())
    .addColumn("object_key", "text", (c) => c.notNull())
    .addColumn("original_name", "varchar(500)", (c) => c.notNull())
    .addColumn("content_type", "text", (c) => c.notNull())
    .addColumn("byte_size", "bigint", (c) => c.notNull())
    .addColumn("checksum_sha256", "char(64)", (c) => c.notNull())
    .addColumn("purpose", "text", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull().defaultTo("uploaded"))
    .addColumn("metadata", "jsonb", (c) =>
      c.notNull().defaultTo(sql`'{}'::jsonb`),
    )
    .addColumn("retention_expires_at", "timestamptz")
    .addColumn("deleted_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint("files_bucket_object_key_unique", [
      "bucket",
      "object_key",
    ])
    .addCheckConstraint(
      "files_status_check",
      sql`status in ('uploaded', 'deleting', 'deleted')`,
    )
    .addCheckConstraint("files_byte_size_positive_check", sql`byte_size > 0`)
    .addCheckConstraint(
      "files_checksum_sha256_check",
      sql`checksum_sha256 ~ '^[a-f0-9]{64}$'`,
    )
    .addCheckConstraint(
      "files_metadata_object_check",
      sql`jsonb_typeof(metadata) = 'object'`,
    )
    .addForeignKeyConstraint(
      "files_upload_id_foreign",
      ["upload_id"],
      "file_uploads",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "files_owner_user_id_foreign",
      ["owner_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "files_created_by_user_id_foreign",
      ["created_by_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await db.schema
    .createIndex("files_owner_user_id_status_created_at_index")
    .on("files")
    .columns(["owner_user_id", "status", "created_at"])
    .execute();

  await db.schema
    .createIndex("files_created_by_user_id_purpose_created_at_index")
    .on("files")
    .columns(["created_by_user_id", "purpose", "created_at"])
    .execute();

  await db.schema
    .createIndex("files_checksum_sha256_index")
    .on("files")
    .column("checksum_sha256")
    .execute();

  await db.schema
    .createIndex("files_status_retention_expires_at_index")
    .on("files")
    .columns(["status", "retention_expires_at"])
    .execute();

  await sql`
    create trigger file_uploads_set_updated_at
    before update on file_uploads
    for each row
    execute function set_updated_at()
  `.execute(db);

  await sql`
    create trigger files_set_updated_at
    before update on files
    for each row
    execute function set_updated_at()
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`drop trigger if exists files_set_updated_at on files`.execute(db);
  await sql`drop trigger if exists file_uploads_set_updated_at on file_uploads`.execute(
    db,
  );
  await db.schema.dropTable("files").execute();
  await db.schema.dropTable("file_uploads").execute();
}
