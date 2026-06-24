import { sql } from "kysely";
import type { MigrationDb } from "./helpers.js";

export async function up(db: MigrationDb): Promise<void> {
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

  await db.schema
    .createTable("ops_queue_job_reconciliations")
    .addColumn("job_id", "text", (c) => c.primaryKey())
    .addColumn("job_name", "text", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull().defaultTo("processing"))
    .addColumn("locked_by", "text", (c) => c.notNull())
    .addColumn("locked_at", "timestamptz", (c) => c.notNull())
    .addColumn("result", "text")
    .addColumn("question_generation_run_id", "uuid")
    .addColumn("error_message", "text")
    .addColumn("last_error", "text")
    .addColumn("completed_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      "ops_queue_job_reconciliations_job_id_non_empty_check",
      sql`length(trim(job_id)) > 0`,
    )
    .addCheckConstraint(
      "ops_queue_job_reconciliations_job_name_non_empty_check",
      sql`length(trim(job_name)) > 0`,
    )
    .addCheckConstraint(
      "ops_queue_job_reconciliations_locked_by_non_empty_check",
      sql`length(trim(locked_by)) > 0`,
    )
    .addCheckConstraint(
      "ops_queue_job_reconciliations_status_check",
      sql`status in ('processing', 'completed')`,
    )
    .addCheckConstraint(
      "ops_queue_job_reconciliations_result_check",
      sql`result is null or result in (
        'run_failed',
        'run_not_found',
        'run_terminal',
        'invalid_payload'
      )`,
    )
    .addForeignKeyConstraint(
      "ops_queue_job_reconciliations_run_id_foreign",
      ["question_generation_run_id"],
      "question_generation_runs",
      ["id"],
      (cb) => cb.onDelete("set null"),
    )
    .execute();

  await db.schema
    .createIndex("ops_queue_job_reconciliations_status_locked_at_index")
    .on("ops_queue_job_reconciliations")
    .columns(["status", "locked_at"])
    .execute();
  await db.schema
    .createIndex("ops_queue_job_reconciliations_run_id_index")
    .on("ops_queue_job_reconciliations")
    .column("question_generation_run_id")
    .execute();

  await sql`
    create trigger ops_queue_job_reconciliations_set_updated_at
    before update on ops_queue_job_reconciliations
    for each row
    execute function set_updated_at()
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`drop trigger if exists ops_queue_job_reconciliations_set_updated_at on ops_queue_job_reconciliations`.execute(
    db,
  );
  await db.schema.dropTable("ops_queue_job_reconciliations").execute();
  await db.schema.dropTable("ops_outbox_event_reviews").execute();
}
