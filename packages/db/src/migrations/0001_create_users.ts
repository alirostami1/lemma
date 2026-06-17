import { sql } from "kysely";
import type { MigrationDb } from "./helpers.js";

export async function up(db: MigrationDb): Promise<void> {
  await sql`create extension if not exists citext`.execute(db);

  await sql`
    create or replace function set_updated_at()
    returns trigger as $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$ language plpgsql
  `.execute(db);

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
    .addCheckConstraint("users_email_non_empty", sql`(length(trim(email)) > 0)`)
    .addCheckConstraint(
      "users_display_name__non_empty",
      sql`(length(trim(display_name)) > 0)`,
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
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`drop trigger if exists users_set_updated_at on users`.execute(db);
  await db.schema.dropTable("users").execute();
  await sql`drop function if exists set_updated_at()`.execute(db);
  // Intentionally does not drop the citext extension. It may be shared by other schemas.
}
