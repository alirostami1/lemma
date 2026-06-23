import { sql } from "kysely";
import type { MigrationDb } from "./helpers.js";

export async function up(db: MigrationDb): Promise<void> {
  await db.schema
    .createTable("question_sets")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("owner_user_id", "uuid", (c) => c.notNull())
    .addColumn("created_by_user_id", "uuid", (c) => c.notNull())
    .addColumn("name", "varchar(160)", (c) => c.notNull())
    .addColumn("description", "text")
    .addColumn("status", "text", (c) => c.notNull().defaultTo("active"))
    .addColumn("archived_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint("question_sets_owner_user_id_name_unique", [
      "owner_user_id",
      "name",
    ])
    .addCheckConstraint(
      "question_sets_status_check",
      sql`status in ('active', 'archived', 'deleted')`,
    )
    .addCheckConstraint(
      "question_sets_name_nonempty_check",
      sql`length(trim(name)) > 0`,
    )
    .addForeignKeyConstraint(
      "question_sets_owner_user_id_foreign",
      ["owner_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_sets_created_by_user_id_foreign",
      ["created_by_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await db.schema
    .createIndex("question_sets_owner_user_id_status_created_at_index")
    .on("question_sets")
    .columns(["owner_user_id", "status", "created_at"])
    .execute();
  await db.schema
    .createIndex("question_sets_created_by_user_id_created_at_index")
    .on("question_sets")
    .columns(["created_by_user_id", "created_at"])
    .execute();

  await sql`
    create trigger question_sets_set_updated_at
    before update on question_sets
    for each row
    execute function set_updated_at()
  `.execute(db);

  await db.schema
    .createTable("question_set_members")
    .addColumn("question_set_id", "uuid", (c) => c.notNull())
    .addColumn("user_id", "uuid", (c) => c.notNull())
    .addColumn("role", "text", (c) => c.notNull())
    .addColumn("granted_by_user_id", "uuid")
    .addColumn("expires_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addPrimaryKeyConstraint("question_set_members_primary", [
      "question_set_id",
      "user_id",
    ])
    .addCheckConstraint(
      "question_set_members_role_check",
      sql`role in ('viewer', 'editor', 'manager')`,
    )
    .addForeignKeyConstraint(
      "question_set_members_question_set_id_foreign",
      ["question_set_id"],
      "question_sets",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "question_set_members_user_id_foreign",
      ["user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "question_set_members_granted_by_user_id_foreign",
      ["granted_by_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("set null"),
    )
    .execute();

  await db.schema
    .createIndex("question_set_members_user_id_question_set_id_index")
    .on("question_set_members")
    .columns(["user_id", "question_set_id"])
    .execute();
  await db.schema
    .createIndex("question_set_members_role_index")
    .on("question_set_members")
    .column("role")
    .execute();
  await db.schema
    .createIndex("question_set_members_expires_at_index")
    .on("question_set_members")
    .column("expires_at")
    .execute();
}

export async function down(db: MigrationDb): Promise<void> {
  await db.schema.dropTable("question_set_members").execute();
  await sql`drop trigger if exists question_sets_set_updated_at on question_sets`.execute(
    db,
  );
  await db.schema.dropTable("question_sets").execute();
}
