import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("question_blueprint_version_assets")
    .addColumn("question_blueprint_version_id", "uuid", (c) => c.notNull())
    .addColumn("workbook_id", "uuid", (c) => c.notNull())
    .addColumn("kind", "text", (c) => c.notNull().defaultTo("workbook"))
    .addColumn("position", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addPrimaryKeyConstraint("question_blueprint_version_assets_primary", [
      "question_blueprint_version_id",
      "workbook_id",
    ])
    .addCheckConstraint(
      "question_blueprint_version_assets_kind_check",
      sql`kind = 'workbook'`,
    )
    .addCheckConstraint(
      "question_blueprint_version_assets_position_check",
      sql`position >= 0`,
    )
    .addForeignKeyConstraint(
      "question_blueprint_version_assets_version_id_foreign",
      ["question_blueprint_version_id"],
      "question_blueprint_versions",
      ["id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "question_blueprint_version_assets_workbook_id_foreign",
      ["workbook_id"],
      "workbooks",
      ["id"],
      (cb) => cb.onDelete("restrict"),
    )
    .execute();

  await db.schema
    .createIndex("question_blueprint_version_assets_workbook_id_index")
    .on("question_blueprint_version_assets")
    .column("workbook_id")
    .execute();

  await db.schema
    .createIndex("question_blueprint_version_assets_version_position_index")
    .on("question_blueprint_version_assets")
    .columns(["question_blueprint_version_id", "position"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("question_blueprint_version_assets").execute();
}
