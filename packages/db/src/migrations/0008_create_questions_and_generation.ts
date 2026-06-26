import { sql } from "kysely";
import type { MigrationDb } from "./helpers.js";

export async function up(db: MigrationDb): Promise<void> {
  await db.schema
    .createTable("question_generation_runs")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("owner_user_id", "uuid", (c) => c.notNull())
    .addColumn("created_by_user_id", "uuid", (c) => c.notNull())
    .addColumn("blueprint_id", "uuid", (c) => c.notNull())
    .addColumn("target_question_set_id", "uuid", (c) => c.notNull())
    .addColumn("requested_count", "integer", (c) => c.notNull())
    .addColumn("blueprint_snapshot", "jsonb", (c) => c.notNull())
    .addColumn("workbook_calculation_id", "uuid")
    .addColumn("retry_of_run_id", "uuid")
    .addColumn("attempt_number", "integer", (c) => c.notNull().defaultTo(1))
    .addColumn("status", "text", (c) => c.notNull().defaultTo("queued"))
    .addColumn("result", "jsonb")
    .addColumn("error_message", "text")
    .addColumn("attempts", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("started_at", "timestamptz")
    .addColumn("finished_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      "question_generation_runs_requested_count_check",
      sql`requested_count between 1 and 100`,
    )
    .addCheckConstraint(
      "question_generation_runs_status_check",
      sql`status in (
        'queued',
        'waiting_for_workbook_calculation',
        'materializing',
        'succeeded',
        'failed',
        'cancelled'
      )`,
    )
    .addCheckConstraint(
      "question_generation_runs_attempts_nonnegative_check",
      sql`attempts >= 0`,
    )
    .addCheckConstraint(
      "question_generation_runs_attempt_number_positive_check",
      sql`attempt_number >= 1`,
    )
    .addCheckConstraint(
      "question_generation_runs_blueprint_snapshot_object_check",
      sql`jsonb_typeof(blueprint_snapshot) = 'object'`,
    )
    .addCheckConstraint(
      "question_generation_runs_blueprint_snapshot_schema_check",
      sql`blueprint_snapshot @> '{"schemaVersion":1}'::jsonb`,
    )
    .addCheckConstraint(
      "question_generation_runs_blueprint_snapshot_required_check",
      sql`blueprint_snapshot ? 'blueprintId'
        and blueprint_snapshot ? 'name'
        and blueprint_snapshot ? 'document'
        and blueprint_snapshot ? 'sources'
        and blueprint_snapshot ? 'documentHash'
        and blueprint_snapshot ? 'capturedAt'`,
    )
    .addCheckConstraint(
      "question_generation_runs_blueprint_snapshot_document_check",
      sql`jsonb_typeof(blueprint_snapshot->'document') = 'object'`,
    )
    .addCheckConstraint(
      "question_generation_runs_blueprint_snapshot_sources_check",
      sql`jsonb_typeof(blueprint_snapshot->'sources') = 'array'`,
    )
    .addCheckConstraint(
      "question_generation_runs_result_object_check",
      sql`result is null or jsonb_typeof(result) = 'object'`,
    )
    .addForeignKeyConstraint(
      "question_generation_runs_owner_user_id_foreign",
      ["owner_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_generation_runs_created_by_user_id_foreign",
      ["created_by_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_generation_runs_blueprint_id_foreign",
      ["blueprint_id"],
      "question_blueprints",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_generation_runs_target_question_set_id_foreign",
      ["target_question_set_id"],
      "question_sets",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_generation_runs_workbook_calculation_id_foreign",
      ["workbook_calculation_id"],
      "workbook_calculations",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "question_generation_runs_retry_of_run_id_foreign",
      ["retry_of_run_id"],
      "question_generation_runs",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await db.schema
    .createIndex("question_generation_runs_owner_user_id_created_at_index")
    .on("question_generation_runs")
    .columns(["owner_user_id", "created_at"])
    .execute();
  await db.schema
    .createIndex("question_generation_runs_status_created_at_index")
    .on("question_generation_runs")
    .columns(["status", "created_at"])
    .execute();
  await db.schema
    .createIndex("question_generation_runs_blueprint_id_created_at_index")
    .on("question_generation_runs")
    .columns(["blueprint_id", "created_at"])
    .execute();
  await db.schema
    .createIndex("question_generation_runs_target_question_set_id_index")
    .on("question_generation_runs")
    .column("target_question_set_id")
    .execute();
  await db.schema
    .createIndex("question_generation_runs_workbook_calculation_id_index")
    .on("question_generation_runs")
    .column("workbook_calculation_id")
    .execute();
  await db.schema
    .createIndex("question_generation_runs_retry_of_run_id_index")
    .on("question_generation_runs")
    .column("retry_of_run_id")
    .execute();

  await sql`
    create trigger question_generation_runs_set_updated_at
    before update on question_generation_runs
    for each row
    execute function set_updated_at()
  `.execute(db);

  await db.schema
    .createTable("questions")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("owner_user_id", "uuid", (c) => c.notNull())
    .addColumn("created_by_user_id", "uuid", (c) => c.notNull())
    .addColumn("blueprint_id", "uuid", (c) => c.notNull())
    .addColumn("generation_run_id", "uuid", (c) => c.notNull())
    .addColumn("body", "jsonb", (c) => c.notNull())
    .addColumn("solution", "jsonb", (c) => c.notNull())
    .addColumn("source_plan", "jsonb", (c) => c.notNull())
    .addColumn("source_evidence", "jsonb", (c) => c.notNull())
    .addColumn("producer", "jsonb", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull().defaultTo("active"))
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      "questions_body_object_check",
      sql`jsonb_typeof(body) = 'object'`,
    )
    .addCheckConstraint(
      "questions_body_schema_check",
      sql`body @> '{"schemaVersion":1}'::jsonb`,
    )
    .addCheckConstraint(
      "questions_body_blocks_check",
      sql`body ? 'blocks' and jsonb_typeof(body->'blocks') = 'array'`,
    )
    .addCheckConstraint(
      "questions_body_response_fields_check",
      sql`body ? 'responseFields' and jsonb_typeof(body->'responseFields') = 'array'`,
    )
    .addCheckConstraint(
      "questions_solution_object_check",
      sql`jsonb_typeof(solution) = 'object' and solution @> '{"schemaVersion":1}'::jsonb`,
    )
    .addCheckConstraint(
      "questions_source_plan_object_check",
      sql`jsonb_typeof(source_plan) = 'object' and source_plan @> '{"schemaVersion":1}'::jsonb`,
    )
    .addCheckConstraint(
      "questions_source_evidence_object_check",
      sql`jsonb_typeof(source_evidence) = 'object' and source_evidence @> '{"schemaVersion":1}'::jsonb`,
    )
    .addCheckConstraint(
      "questions_source_evidence_sources_check",
      sql`jsonb_typeof(source_evidence->'sources') = 'array' and source_evidence ? 'sources'`,
    )
    .addCheckConstraint(
      "questions_producer_object_check",
      sql`jsonb_typeof(producer) = 'object' and producer @> '{"schemaVersion":1}'::jsonb`,
    )
    .addCheckConstraint(
      "questions_status_check",
      sql`status in ('active', 'archived', 'deleted')`,
    )
    .addForeignKeyConstraint(
      "questions_owner_user_id_foreign",
      ["owner_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "questions_created_by_user_id_foreign",
      ["created_by_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "questions_blueprint_id_foreign",
      ["blueprint_id"],
      "question_blueprints",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "questions_generation_run_id_foreign",
      ["generation_run_id"],
      "question_generation_runs",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await db.schema
    .createIndex("questions_owner_user_id_status_created_at_index")
    .on("questions")
    .columns(["owner_user_id", "status", "created_at"])
    .execute();
  await db.schema
    .createIndex("questions_blueprint_id_index")
    .on("questions")
    .column("blueprint_id")
    .execute();
  await db.schema
    .createIndex("questions_generation_run_id_index")
    .on("questions")
    .column("generation_run_id")
    .execute();
  await db.schema
    .createIndex("questions_status_created_at_index")
    .on("questions")
    .columns(["status", "created_at"])
    .execute();

  await sql`
    create trigger questions_set_updated_at
    before update on questions
    for each row
    execute function set_updated_at()
  `.execute(db);

  await db.schema
    .createTable("question_set_questions")
    .addColumn("question_set_id", "uuid", (c) => c.notNull())
    .addColumn("question_id", "uuid", (c) => c.notNull())
    .addColumn("added_by_user_id", "uuid", (c) => c.notNull())
    .addColumn("position", "integer")
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addPrimaryKeyConstraint("question_set_questions_primary", [
      "question_set_id",
      "question_id",
    ])
    .addCheckConstraint(
      "question_set_questions_position_nonnegative_check",
      sql`position is null or position >= 0`,
    )
    .addForeignKeyConstraint(
      "question_set_questions_question_set_id_foreign",
      ["question_set_id"],
      "question_sets",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "question_set_questions_question_id_foreign",
      ["question_id"],
      "questions",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "question_set_questions_added_by_user_id_foreign",
      ["added_by_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await db.schema
    .createIndex("question_set_questions_question_id_index")
    .on("question_set_questions")
    .column("question_id")
    .execute();
  await db.schema
    .createIndex("question_set_questions_question_set_id_position_index")
    .on("question_set_questions")
    .columns(["question_set_id", "position"])
    .execute();
  await sql`
    create unique index question_set_questions_question_set_id_position_unique
    on question_set_questions (question_set_id, position)
    where position is not null
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`drop index if exists question_set_questions_question_set_id_position_unique`.execute(
    db,
  );
  await db.schema.dropTable("question_set_questions").execute();
  await sql`drop trigger if exists questions_set_updated_at on questions`.execute(
    db,
  );
  await db.schema.dropTable("questions").execute();
  await sql`drop trigger if exists question_generation_runs_set_updated_at on question_generation_runs`.execute(
    db,
  );
  await db.schema.dropTable("question_generation_runs").execute();
}
