import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("question_generation_runs")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("owner_user_id", "uuid", (c) => c.notNull())
    .addColumn("created_by_user_id", "uuid", (c) => c.notNull())
    .addColumn("blueprint_id", "uuid", (c) => c.notNull())
    .addColumn("blueprint_version_id", "uuid", (c) => c.notNull())
    .addColumn("target_question_set_id", "uuid", (c) => c.notNull())
    .addColumn("requested_count", "integer", (c) => c.notNull())
    .addColumn("source", "jsonb")
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
      "question_generation_runs_requested_count_range_check",
      sql`requested_count between 1 and 100`,
    )
    .addCheckConstraint(
      "question_generation_runs_status_check",
      sql`status in ('queued', 'waiting_for_workbook_calculation', 'materializing', 'succeeded', 'failed', 'cancelled')`,
    )
    .addCheckConstraint(
      "question_generation_runs_source_object_check",
      sql`source is null or jsonb_typeof(source) = 'object'`,
    )
    .addCheckConstraint(
      "question_generation_runs_result_object_check",
      sql`result is null or jsonb_typeof(result) = 'object'`,
    )
    .addCheckConstraint(
      "question_generation_runs_attempts_nonnegative_check",
      sql`attempts >= 0`,
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
      "question_generation_runs_blueprint_version_id_foreign",
      ["blueprint_version_id"],
      "question_blueprint_versions",
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
    .createIndex("question_generation_runs_blueprint_version_id_index")
    .on("question_generation_runs")
    .column("blueprint_version_id")
    .execute();

  await db.schema
    .createIndex("question_generation_runs_target_question_set_id_index")
    .on("question_generation_runs")
    .column("target_question_set_id")
    .execute();

  await db.schema
    .createTable("questions")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("owner_user_id", "uuid", (c) => c.notNull())
    .addColumn("created_by_user_id", "uuid", (c) => c.notNull())
    .addColumn("blueprint_id", "uuid", (c) => c.notNull())
    .addColumn("blueprint_version_id", "uuid", (c) => c.notNull())
    .addColumn("generation_run_id", "uuid", (c) => c.notNull())
    .addColumn("body", "jsonb", (c) => c.notNull())
    .addColumn("solution", "jsonb", (c) => c.notNull())
    .addColumn("source_plan", "jsonb", (c) => c.notNull())
    .addColumn("producer", "jsonb", (c) => c.notNull())
    .addColumn("source", "jsonb")
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
      "questions_solution_object_check",
      sql`solution is null or jsonb_typeof(solution) = 'object'`,
    )
    .addCheckConstraint(
      "questions_source_plan_object_check",
      sql`source_plan is null or jsonb_typeof(source_plan) = 'object'`,
    )
    .addCheckConstraint(
      "questions_producer_object_check",
      sql`producer is null or jsonb_typeof(producer) = 'object'`,
    )
    .addCheckConstraint(
      "questions_source_object_check",
      sql`source is null or jsonb_typeof(source) = 'object'`,
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
      "questions_blueprint_version_id_foreign",
      ["blueprint_version_id"],
      "question_blueprint_versions",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "questions_generation_run_id_foreign",
      ["generation_run_id"],
      "question_generation_runs",
      ["id"],
      (cb) => cb.onDelete("set null"),
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
    .createIndex("questions_blueprint_version_id_index")
    .on("questions")
    .column("blueprint_version_id")
    .execute();

  await db.schema
    .createIndex("questions_generation_run_id_index")
    .on("questions")
    .column("generation_run_id")
    .execute();

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
    create trigger question_generation_runs_set_updated_at
    before update on question_generation_runs
    for each row
    execute function set_updated_at()
  `.execute(db);

  await sql`
    create trigger questions_set_updated_at
    before update on questions
    for each row
    execute function set_updated_at()
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`drop trigger if exists questions_set_updated_at on questions`.execute(
    db,
  );
  await sql`drop trigger if exists question_generation_runs_set_updated_at on question_generation_runs`.execute(
    db,
  );
  await db.schema.dropTable("question_set_questions").execute();
  await db.schema.dropTable("questions").execute();
  await db.schema.dropTable("question_generation_runs").execute();
}
