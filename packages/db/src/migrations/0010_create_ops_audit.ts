import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  await db.schema
    .createTable("ops_outbox_event_reviews")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("outbox_event_id", "uuid", (c) => c.notNull())
    .addColumn("action", "text", (c) => c.notNull())
    .addColumn("actor_user_id", "uuid")
    .addColumn("note", "text")
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      "ops_outbox_event_reviews_action_check",
      sql`action in ('reviewed', 'ignored', 'replayed')`,
    )
    .addForeignKeyConstraint(
      "ops_outbox_event_reviews_outbox_event_id_foreign",
      ["outbox_event_id"],
      "outbox_events",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "ops_outbox_event_reviews_actor_user_id_foreign",
      ["actor_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("set null"),
    )
    .execute();

  await db.schema
    .createIndex("ops_outbox_event_reviews_event_created_at_index")
    .on("ops_outbox_event_reviews")
    .columns(["outbox_event_id", "created_at"])
    .execute();
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  await db.schema.dropTable("ops_outbox_event_reviews").execute();
}
