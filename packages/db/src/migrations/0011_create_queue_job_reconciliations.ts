import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
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
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("ops_queue_job_reconciliations").execute();
}
