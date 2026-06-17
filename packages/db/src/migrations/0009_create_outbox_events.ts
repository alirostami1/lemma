import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  await db.schema
    .createTable("outbox_events")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("event_type", "text", (c) => c.notNull())
    .addColumn("schema_version", "integer", (c) => c.notNull())
    .addColumn("aggregate_type", "text", (c) => c.notNull())
    .addColumn("aggregate_id", "text", (c) => c.notNull())
    .addColumn("owner_user_id", "uuid")
    .addColumn("payload", "jsonb", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull().defaultTo("pending"))
    .addColumn("available_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("attempts", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("locked_by", "text")
    .addColumn("locked_at", "timestamptz")
    .addColumn("published_at", "timestamptz")
    .addColumn("last_error", "text")
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      "outbox_events_event_type_non_empty_check",
      sql`length(trim(event_type)) > 0`,
    )
    .addCheckConstraint(
      "outbox_events_schema_version_positive_check",
      sql`schema_version > 0`,
    )
    .addCheckConstraint(
      "outbox_events_aggregate_type_non_empty_check",
      sql`length(trim(aggregate_type)) > 0`,
    )
    .addCheckConstraint(
      "outbox_events_aggregate_id_non_empty_check",
      sql`length(trim(aggregate_id)) > 0`,
    )
    .addCheckConstraint(
      "outbox_events_payload_object_check",
      sql`jsonb_typeof(payload) = 'object'`,
    )
    .addCheckConstraint(
      "outbox_events_status_check",
      sql`status in ('pending', 'publishing', 'published', 'failed')`,
    )
    .addCheckConstraint(
      "outbox_events_attempts_nonnegative_check",
      sql`attempts >= 0`,
    )
    .addForeignKeyConstraint(
      "outbox_events_owner_user_id_foreign",
      ["owner_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("set null"),
    )
    .execute();

  await db.schema
    .createIndex("outbox_events_status_available_at_created_at_index")
    .on("outbox_events")
    .columns(["status", "available_at", "created_at"])
    .execute();

  await db.schema
    .createIndex("outbox_events_aggregate_type_aggregate_id_created_at_index")
    .on("outbox_events")
    .columns(["aggregate_type", "aggregate_id", "created_at"])
    .execute();

  await db.schema
    .createIndex("outbox_events_owner_user_id_created_at_index")
    .on("outbox_events")
    .columns(["owner_user_id", "created_at"])
    .execute();

  await sql`
    create index outbox_events_failed_created_at_index
    on outbox_events (created_at)
    where status = 'failed'
  `.execute(db);

  await db.schema
    .createTable("processed_events")
    .addColumn("event_id", "uuid", (c) => c.notNull())
    .addColumn("consumer", "text", (c) => c.notNull())
    .addColumn("processed_at", "timestamptz", (c) => c.notNull())
    .addPrimaryKeyConstraint("processed_events_primary", [
      "event_id",
      "consumer",
    ])
    .addCheckConstraint(
      "processed_events_consumer_non_empty_check",
      sql`length(trim(consumer)) > 0`,
    )
    .addForeignKeyConstraint(
      "processed_events_event_id_foreign",
      ["event_id"],
      "outbox_events",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  await sql`
    create trigger outbox_events_set_updated_at
    before update on outbox_events
    for each row
    execute function set_updated_at()
  `.execute(db);
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`drop trigger if exists outbox_events_set_updated_at on outbox_events`.execute(
    db,
  );
  await db.schema.dropTable("processed_events").execute();
  await sql`drop index if exists outbox_events_failed_created_at_index`.execute(
    db,
  );
  await db.schema.dropTable("outbox_events").execute();
}
