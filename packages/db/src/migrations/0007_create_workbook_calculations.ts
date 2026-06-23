import { sql } from "kysely";
import type { MigrationDb } from "./helpers.js";

export async function up(db: MigrationDb): Promise<void> {
  await db.schema
    .createTable("workbook_calculations")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("owner_user_id", "uuid", (c) => c.notNull())
    .addColumn("created_by_user_id", "uuid", (c) => c.notNull())
    .addColumn("requested_count", "integer", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull().defaultTo("queued"))
    .addColumn("correlation_id", "text")
    .addColumn("retry_of_calculation_id", "uuid")
    .addColumn("attempt_number", "integer", (c) => c.notNull().defaultTo(1))
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
      "workbook_calculations_requested_count_check",
      sql`requested_count between 1 and 1000`,
    )
    .addCheckConstraint(
      "workbook_calculations_status_check",
      sql`status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')`,
    )
    .addCheckConstraint(
      "workbook_calculations_attempts_nonnegative_check",
      sql`attempts >= 0`,
    )
    .addCheckConstraint(
      "workbook_calculations_attempt_number_positive_check",
      sql`attempt_number >= 1`,
    )
    .addCheckConstraint(
      "workbook_calculations_correlation_id_nonempty_check",
      sql`correlation_id is null or length(trim(correlation_id)) > 0`,
    )
    .addForeignKeyConstraint(
      "workbook_calculations_owner_user_id_foreign",
      ["owner_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "workbook_calculations_created_by_user_id_foreign",
      ["created_by_user_id"],
      "users",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .addForeignKeyConstraint(
      "workbook_calculations_retry_of_calculation_id_foreign",
      ["retry_of_calculation_id"],
      "workbook_calculations",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await db.schema
    .createIndex("workbook_calculations_owner_user_id_created_at_index")
    .on("workbook_calculations")
    .columns(["owner_user_id", "created_at"])
    .execute();
  await db.schema
    .createIndex("workbook_calculations_status_created_at_index")
    .on("workbook_calculations")
    .columns(["status", "created_at"])
    .execute();
  await sql`
    create unique index workbook_calculations_correlation_id_unique
    on workbook_calculations (correlation_id)
    where correlation_id is not null
  `.execute(db);
  await db.schema
    .createIndex("workbook_calculations_retry_of_calculation_id_index")
    .on("workbook_calculations")
    .column("retry_of_calculation_id")
    .execute();

  await sql`
    create trigger workbook_calculations_set_updated_at
    before update on workbook_calculations
    for each row
    execute function set_updated_at()
  `.execute(db);

  await db.schema
    .createTable("workbook_calculation_sources")
    .addColumn("calculation_id", "uuid", (c) => c.notNull())
    .addColumn("source_id", "text", (c) => c.notNull())
    .addColumn("workbook_id", "uuid", (c) => c.notNull())
    .addColumn("position", "integer", (c) => c.notNull())
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addPrimaryKeyConstraint("workbook_calculation_sources_primary", [
      "calculation_id",
      "source_id",
    ])
    .addUniqueConstraint(
      "workbook_calculation_sources_calculation_id_position_unique",
      ["calculation_id", "position"],
    )
    .addUniqueConstraint(
      "workbook_calculation_sources_calculation_source_workbook_unique",
      ["calculation_id", "source_id", "workbook_id"],
    )
    .addCheckConstraint(
      "workbook_calculation_sources_source_id_pattern_check",
      sql`source_id ~ '^[A-Za-z][A-Za-z0-9_-]*$'`,
    )
    .addCheckConstraint(
      "workbook_calculation_sources_position_nonnegative_check",
      sql`position >= 0`,
    )
    .addForeignKeyConstraint(
      "workbook_calculation_sources_calculation_id_foreign",
      ["calculation_id"],
      "workbook_calculations",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "workbook_calculation_sources_workbook_id_foreign",
      ["workbook_id"],
      "workbooks",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await db.schema
    .createIndex("workbook_calculation_sources_workbook_id_index")
    .on("workbook_calculation_sources")
    .column("workbook_id")
    .execute();
  await db.schema
    .createIndex("workbook_calculation_sources_workbook_id_created_at_index")
    .on("workbook_calculation_sources")
    .columns(["workbook_id", "created_at"])
    .execute();

  await db.schema
    .createTable("workbook_snapshots")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("calculation_id", "uuid", (c) => c.notNull())
    .addColumn("source_id", "text", (c) => c.notNull())
    .addColumn("workbook_id", "uuid", (c) => c.notNull())
    .addColumn("question_index", "integer", (c) => c.notNull())
    .addColumn("snapshot_index", "integer", (c) => c.notNull())
    .addColumn("values", "jsonb", (c) => c.notNull())
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint(
      "workbook_snapshots_calculation_source_question_unique",
      ["calculation_id", "source_id", "question_index"],
    )
    .addUniqueConstraint("workbook_snapshots_calculation_snapshot_unique", [
      "calculation_id",
      "snapshot_index",
    ])
    .addCheckConstraint(
      "workbook_snapshots_source_id_pattern_check",
      sql`source_id ~ '^[A-Za-z][A-Za-z0-9_-]*$'`,
    )
    .addCheckConstraint(
      "workbook_snapshots_question_index_nonnegative_check",
      sql`question_index >= 0`,
    )
    .addCheckConstraint(
      "workbook_snapshots_snapshot_index_nonnegative_check",
      sql`snapshot_index >= 0`,
    )
    .addCheckConstraint(
      "workbook_snapshots_values_object_check",
      sql`jsonb_typeof(values) = 'object'`,
    )
    .addForeignKeyConstraint(
      "workbook_snapshots_calculation_id_foreign",
      ["calculation_id"],
      "workbook_calculations",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "workbook_snapshots_calculation_source_foreign",
      ["calculation_id", "source_id", "workbook_id"],
      "workbook_calculation_sources",
      ["calculation_id", "source_id", "workbook_id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await db.schema
    .createIndex("workbook_snapshots_calculation_id_question_index_index")
    .on("workbook_snapshots")
    .columns(["calculation_id", "question_index"])
    .execute();
  await db.schema
    .createIndex("workbook_snapshots_calculation_id_source_id_index")
    .on("workbook_snapshots")
    .columns(["calculation_id", "source_id"])
    .execute();
  await db.schema
    .createIndex("workbook_snapshots_workbook_id_created_at_index")
    .on("workbook_snapshots")
    .columns(["workbook_id", "created_at"])
    .execute();
}

export async function down(db: MigrationDb): Promise<void> {
  await db.schema.dropTable("workbook_snapshots").execute();
  await db.schema.dropTable("workbook_calculation_sources").execute();
  await sql`drop trigger if exists workbook_calculations_set_updated_at on workbook_calculations`.execute(
    db,
  );
  await db.schema.dropTable("workbook_calculations").execute();
}
