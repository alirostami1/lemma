import type { Kysely } from "kysely";
import { sql } from "kysely";
import { documentDestructiveChange } from "./helpers.js";

export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  documentDestructiveChange({
    migration: "0013_remove_question_blueprint_workbook_columns",
    operation: "drop legacy workbook_id/workbook_sources columns from question blueprint tables",
    reason:
      "Question blueprints now persist plural sources directly and the old workbook fields are no longer part of the contract.",
    rollbackPlan:
      "Restore the dropped columns from a database backup, then rehydrate sources from the archived legacy workbook columns.",
  });

  await db.schema
    .alterTable("question_blueprints")
    .addColumn("sources", "jsonb", (c) =>
      c.notNull().defaultTo(sql`'[]'::jsonb`),
    )
    .execute();

  await db.schema
    .alterTable("question_blueprint_versions")
    .addColumn("sources", "jsonb", (c) =>
      c.notNull().defaultTo(sql`'[]'::jsonb`),
    )
    .execute();

  await sql`
    update question_blueprints
    set sources = case
      when coalesce(jsonb_array_length(coalesce(workbook_sources, '[]'::jsonb)), 0) = 0
        and workbook_id is not null
      then jsonb_build_array(
        jsonb_build_object(
          'type', 'workbook',
          'sourceId', 'source_1',
          'name', 'Source 1',
          'workbookId', workbook_id::text
        )
      )
      else coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'type', 'workbook',
              'sourceId', source ->> 'sourceId',
              'name', source ->> 'name',
              'workbookId', source ->> 'workbookId'
            )
            order by ord
          )
          from jsonb_array_elements(coalesce(workbook_sources, '[]'::jsonb))
            with ordinality as elements(source, ord)
        ),
        '[]'::jsonb
      )
    end
  `.execute(db);

  await sql`
    update question_blueprint_versions
    set sources = case
      when coalesce(jsonb_array_length(coalesce(workbook_sources, '[]'::jsonb)), 0) = 0
        and workbook_id is not null
      then jsonb_build_array(
        jsonb_build_object(
          'type', 'workbook',
          'sourceId', 'source_1',
          'name', 'Source 1',
          'workbookId', workbook_id::text
        )
      )
      else coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'type', 'workbook',
              'sourceId', source ->> 'sourceId',
              'name', source ->> 'name',
              'workbookId', source ->> 'workbookId'
            )
            order by ord
          )
          from jsonb_array_elements(coalesce(workbook_sources, '[]'::jsonb))
            with ordinality as elements(source, ord)
        ),
        '[]'::jsonb
      )
    end
  `.execute(db);

  await sql`alter table question_blueprints drop column workbook_id cascade`.execute(
    db,
  );
  await sql`alter table question_blueprints drop column workbook_sources cascade`.execute(
    db,
  );

  await sql`alter table question_blueprint_versions drop column workbook_id cascade`.execute(
    db,
  );
  await sql`alter table question_blueprint_versions drop column workbook_sources cascade`.execute(
    db,
  );
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  await db.schema
    .alterTable("question_blueprints")
    .addColumn("workbook_id", "uuid")
    .addColumn("workbook_sources", "jsonb", (c) =>
      c.notNull().defaultTo(sql`'[]'::jsonb`),
    )
    .execute();

  await db.schema
    .alterTable("question_blueprint_versions")
    .addColumn("workbook_id", "uuid")
    .addColumn("workbook_sources", "jsonb", (c) =>
      c.notNull().defaultTo(sql`'[]'::jsonb`),
    )
    .execute();
}
