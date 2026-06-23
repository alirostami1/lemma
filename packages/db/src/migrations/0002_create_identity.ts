import { sql } from "kysely";
import type { MigrationDb } from "./helpers.js";

export async function up(db: MigrationDb): Promise<void> {
  await db.schema
    .createTable("users")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("identity_id", "text", (c) => c.notNull().unique())
    .addColumn("email", sql`citext`, (c) => c.notNull().unique())
    .addColumn("display_name", "varchar(150)", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull().defaultTo("active"))
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      "users_status_check",
      sql`status in ('active', 'disabled', 'deleted')`,
    )
    .addCheckConstraint(
      "users_identity_id_non_empty_check",
      sql`length(trim(identity_id)) > 0`,
    )
    .addCheckConstraint(
      "users_email_non_empty_check",
      sql`length(trim(email::text)) > 0`,
    )
    .addCheckConstraint(
      "users_display_name_non_empty_check",
      sql`length(trim(display_name)) > 0`,
    )
    .execute();

  await db.schema
    .createIndex("users_status_index")
    .on("users")
    .column("status")
    .execute();

  await sql`
    create trigger users_set_updated_at
    before update on users
    for each row
    execute function set_updated_at()
  `.execute(db);

  await db.schema
    .createTable("roles")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("key", "varchar(100)", (c) => c.notNull().unique())
    .addColumn("name", "varchar(150)", (c) => c.notNull())
    .addColumn("description", "text", (c) => c.notNull())
    .addColumn("is_system", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint("roles_key_non_empty_check", sql`length(trim(key)) > 0`)
    .addCheckConstraint(
      "roles_name_non_empty_check",
      sql`length(trim(name)) > 0`,
    )
    .addCheckConstraint(
      "roles_description_non_empty_check",
      sql`length(trim(description)) > 0`,
    )
    .execute();

  await sql`
    create trigger roles_set_updated_at
    before update on roles
    for each row
    execute function set_updated_at()
  `.execute(db);

  await db.schema
    .createTable("user_roles")
    .addColumn("user_id", "uuid", (c) => c.notNull())
    .addColumn("role_id", "uuid", (c) => c.notNull())
    .addColumn("granted_by_user_id", "uuid", (c) => c.notNull())
    .addColumn("expires_at", "timestamptz", (c) => c.notNull())
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addPrimaryKeyConstraint("user_roles_primary", ["user_id", "role_id"])
    .addForeignKeyConstraint(
      "user_roles_user_id_foreign",
      ["user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "user_roles_role_id_foreign",
      ["role_id"],
      "roles",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "user_roles_granted_by_user_id_foreign",
      ["granted_by_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await db.schema
    .createIndex("user_roles_role_id_user_id_index")
    .on("user_roles")
    .columns(["role_id", "user_id"])
    .execute();

  await db.schema
    .createIndex("user_roles_expires_at_index")
    .on("user_roles")
    .column("expires_at")
    .execute();
}

export async function down(db: MigrationDb): Promise<void> {
  await db.schema.dropTable("user_roles").execute();
  await sql`drop trigger if exists roles_set_updated_at on roles`.execute(db);
  await db.schema.dropTable("roles").execute();
  await sql`drop trigger if exists users_set_updated_at on users`.execute(db);
  await db.schema.dropTable("users").execute();
}
