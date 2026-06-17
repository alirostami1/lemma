import { sql } from "kysely";
import { documentDestructiveChange, type MigrationDb } from "./helpers.js";

export async function up(db: MigrationDb): Promise<void> {
  await db.schema
    .alterTable("outbox_events")
    .addColumn("request_id", "uuid")
    .addColumn("correlation_id", "uuid")
    .addColumn("causation_id", "uuid")
    .execute();

  await sql`
    update outbox_events
    set
      request_id = id,
      correlation_id = id,
      causation_id = null
    where request_id is null
  `.execute(db);

  await sql`
    alter table outbox_events
    alter column request_id set not null,
    alter column correlation_id set not null
  `.execute(db);

  await db.schema
    .createIndex("outbox_events_request_id_created_at_index")
    .on("outbox_events")
    .columns(["request_id", "created_at"])
    .execute();

  await db.schema
    .createIndex("outbox_events_correlation_id_created_at_index")
    .on("outbox_events")
    .columns(["correlation_id", "created_at"])
    .execute();
}

export async function down(db: MigrationDb): Promise<void> {
  documentDestructiveChange({
    migration: "0012_add_outbox_lineage",
    operation: "drop outbox lineage columns on rollback",
    reason: "down migration restores the previous outbox schema",
    rollbackPlan:
      "rollback only before application versions that require lineage fields are running",
  });

  await db.schema
    .dropIndex("outbox_events_correlation_id_created_at_index")
    .ifExists()
    .execute();
  await db.schema
    .dropIndex("outbox_events_request_id_created_at_index")
    .ifExists()
    .execute();
  await db.schema
    .alterTable("outbox_events")
    .dropColumn("causation_id")
    .dropColumn("correlation_id")
    .dropColumn("request_id")
    .execute();
}
