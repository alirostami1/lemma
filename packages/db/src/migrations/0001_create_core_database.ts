import { sql } from "kysely";
import type { MigrationDb } from "./helpers.js";

export async function up(db: MigrationDb): Promise<void> {
  await sql`create extension if not exists citext`.execute(db);

  // The schema uses uuidv7() defaults. The Postgres image must provide uuidv7().
  await sql`
    create or replace function set_updated_at()
    returns trigger as $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$ language plpgsql
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`drop function if exists set_updated_at()`.execute(db);
}
