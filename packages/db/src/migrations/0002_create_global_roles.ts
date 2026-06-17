import { sql } from "kysely";
import type { MigrationDb } from "./helpers.js";

export async function up(db: MigrationDb): Promise<void> {
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
    .execute();

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

  await sql`
    create trigger roles_set_updated_at
    before update on roles
    for each row
    execute function set_updated_at()
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`drop trigger if exists roles_set_updated_at on roles`.execute(db);
  await db.schema.dropTable("user_roles").execute();
  await db.schema.dropTable("roles").execute();
}
