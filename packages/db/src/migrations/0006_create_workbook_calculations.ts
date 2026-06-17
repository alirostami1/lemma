import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  await db.schema
    .createTable("workbook_calculations")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("owner_user_id", "uuid", (c) => c.notNull())
    .addColumn("created_by_user_id", "uuid", (c) => c.notNull())
    .addColumn("workbook_id", "uuid", (c) => c.notNull())
    .addColumn("requested_count", "integer", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull().defaultTo("queued"))
    .addColumn("correlation_id", "text")
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
      "workbook_calculations_requested_count_range_check",
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
      "workbook_calculations_workbook_id_foreign",
      ["workbook_id"],
      "workbooks",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  await db.schema
    .createIndex("workbook_calculations_owner_user_id_created_at_index")
    .on("workbook_calculations")
    .columns(["owner_user_id", "created_at"])
    .execute();

  await db.schema
    .createIndex("workbook_calculations_workbook_id_created_at_index")
    .on("workbook_calculations")
    .columns(["workbook_id", "created_at"])
    .execute();

  await db.schema
    .createIndex("workbook_calculations_correlation_id_index")
    .on("workbook_calculations")
    .column("correlation_id")
    .execute();

  await db.schema
    .createTable("workbook_snapshots")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("workbook_id", "uuid", (c) => c.notNull())
    .addColumn("calculation_id", "uuid", (c) => c.notNull())
    .addColumn("snapshot_index", "integer", (c) => c.notNull())
    .addColumn("values", "jsonb", (c) => c.notNull())
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint(
      "workbook_snapshots_calculation_id_snapshot_index_unique",
      ["calculation_id", "snapshot_index"],
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
      "workbook_snapshots_workbook_id_foreign",
      ["workbook_id"],
      "workbooks",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "workbook_snapshots_calculation_id_foreign",
      ["calculation_id"],
      "workbook_calculations",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .execute();

  await db.schema
    .createIndex("workbook_snapshots_calculation_id_snapshot_index_index")
    .on("workbook_snapshots")
    .columns(["calculation_id", "snapshot_index"])
    .execute();

  await db.schema
    .createIndex("workbook_snapshots_workbook_id_index")
    .on("workbook_snapshots")
    .column("workbook_id")
    .execute();

  await sql`
    create trigger workbook_calculations_set_updated_at
    before update on workbook_calculations
    for each row
    execute function set_updated_at()
  `.execute(db);
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`drop trigger if exists workbook_calculations_set_updated_at on workbook_calculations`.execute(
    db,
  );
  await db.schema.dropTable("workbook_snapshots").execute();
  await db.schema.dropTable("workbook_calculations").execute();
}
