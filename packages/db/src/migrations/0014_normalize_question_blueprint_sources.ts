import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`
    update question_blueprints
    set sources = '[]'::jsonb
    where sources is null
  `.execute(db);

  await sql`
    update question_blueprint_versions
    set sources = '[]'::jsonb
    where sources is null
  `.execute(db);
}

export async function down(_db: Kysely<Record<string, never>>): Promise<void> {
  // Forward-only normalization.
}
