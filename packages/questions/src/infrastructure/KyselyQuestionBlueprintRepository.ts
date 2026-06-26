import type { DatabaseExecutor } from "@lemma/db";
import type { QuestionBlueprintVersionSources } from "@lemma/db/tables";
import type { Insertable, Selectable } from "kysely";
import type {
  QuestionBlueprint,
  QuestionBlueprintId,
  QuestionBlueprintStatus,
  QuestionBlueprintVersion,
  QuestionBlueprintVersionId,
  QuestionBlueprintVersionSource,
  UserId,
} from "../domain/index.js";
import {
  createQuestionBlueprintVersion,
  questionBlueprintVersionNumber,
  workbookId,
} from "../domain/index.js";
import {
  mapQuestionBlueprintRowToDomain,
  mapQuestionBlueprintToUpdate,
  mapQuestionBlueprintVersionRowToDomain,
  mapQuestionBlueprintVersionToInsert,
} from "./KyselyQuestionMappers.js";

export class KyselyQuestionBlueprintRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async findQuestionBlueprintById(
    id: QuestionBlueprintId,
  ): Promise<QuestionBlueprint | null> {
    const row = await this.baseBlueprintQuery()
      .where("questionBlueprints.id", "=", id)
      .executeTakeFirst();
    return row
      ? mapQuestionBlueprintRowToDomain({
          ...row,
          sources: await currentVersionSources(this.db, row.currentVersionId),
        })
      : null;
  }

  async findQuestionBlueprintVersionById(
    id: QuestionBlueprintVersionId,
  ): Promise<QuestionBlueprintVersion | null> {
    const row = await this.db
      .selectFrom("questionBlueprintVersions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row
      ? mapQuestionBlueprintVersionRowToDomain({
          ...row,
          sources: await currentVersionSources(this.db, row.id),
        })
      : null;
  }

  async listQuestionBlueprintsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionBlueprintStatus[];
    limit: number;
    cursor?: Date;
    includeSystem?: boolean;
  }): Promise<QuestionBlueprint[]> {
    let query = this.baseBlueprintQuery();
    query = input.includeSystem
      ? query.where((eb) =>
          eb.or([
            eb("questionBlueprints.ownerUserId", "=", input.ownerUserId),
            eb("questionBlueprints.visibility", "=", "system"),
          ]),
        )
      : query.where("questionBlueprints.ownerUserId", "=", input.ownerUserId);

    if (input.statuses?.length) {
      query = query.where("questionBlueprints.status", "in", input.statuses);
    }
    if (input.cursor) {
      query = query.where("questionBlueprints.createdAt", "<", input.cursor);
    }

    const rows = await query
      .orderBy("questionBlueprints.createdAt", "desc")
      .limit(input.limit)
      .execute();
    const sourceRows = await listVersionSources(
      this.db,
      rows.map((row) => row.currentVersionId),
    );
    return rows.map((row) =>
      mapQuestionBlueprintRowToDomain({
        ...row,
        sources: sourceRows.get(row.currentVersionId) ?? [],
      }),
    );
  }

  async saveQuestionBlueprintLifecycleState(
    blueprint: QuestionBlueprint,
  ): Promise<QuestionBlueprint | null> {
    const row = await this.db
      .updateTable("questionBlueprints")
      .set(mapQuestionBlueprintToUpdate(blueprint))
      .where("id", "=", blueprint.id)
      .returningAll()
      .executeTakeFirst();
    return row
      ? mapQuestionBlueprintRowToDomain({ ...row, sources: blueprint.sources })
      : null;
  }

  private baseBlueprintQuery() {
    return this.db.selectFrom("questionBlueprints").selectAll();
  }
}

export async function insertQuestionBlueprintVersion(
  db: DatabaseExecutor,
  input: {
    blueprint: QuestionBlueprint;
    id: QuestionBlueprintVersionId;
    parentVersionId: QuestionBlueprintVersionId | null;
    publishedAt: Date;
    sourceSnapshot?: readonly QuestionBlueprintVersionSource[];
    versionNumber: number;
  },
): Promise<QuestionBlueprintVersionId> {
  const version = createQuestionBlueprintVersion(
    {
      blueprintId: input.blueprint.id,
      createdByUserId: input.blueprint.createdByUserId,
      description: input.blueprint.description,
      document: input.blueprint.document,
      id: input.id,
      name: input.blueprint.name,
      ownerUserId: input.blueprint.ownerUserId,
      parentVersionId: input.parentVersionId,
      sources: input.sourceSnapshot ?? input.blueprint.sources,
      versionNumber: questionBlueprintVersionNumber(input.versionNumber),
    },
    input.publishedAt,
  );
  const row = await db
    .insertInto("questionBlueprintVersions")
    .values(mapQuestionBlueprintVersionToInsert(version))
    .returning(["id"])
    .executeTakeFirstOrThrow();
  await insertVersionSources(
    db,
    row.id as QuestionBlueprintVersionId,
    [...version.sources],
    version.createdAt,
  );
  return row.id as QuestionBlueprintVersionId;
}

async function currentVersionSources(
  db: DatabaseExecutor,
  versionId: QuestionBlueprintVersionId | string,
): Promise<QuestionBlueprintVersionSource[]> {
  const sourceRows = await listVersionSources(db, [versionId]);
  return sourceRows.get(versionId) ?? [];
}

export async function listVersionSources(
  db: DatabaseExecutor,
  versionIds: readonly string[],
): Promise<Map<string, QuestionBlueprintVersionSource[]>> {
  const result = new Map<string, QuestionBlueprintVersionSource[]>();
  if (versionIds.length === 0) return result;
  const rows = await db
    .selectFrom("questionBlueprintVersionSources")
    .selectAll()
    .where("blueprintVersionId", "in", [...versionIds])
    .orderBy("createdAt", "asc")
    .execute();
  for (const row of rows) {
    const source = mapVersionSourceRow(row);
    const sources = result.get(row.blueprintVersionId) ?? [];
    sources.push(source);
    result.set(row.blueprintVersionId, sources);
  }
  return result;
}

export async function insertVersionSources(
  db: DatabaseExecutor,
  versionId: QuestionBlueprintVersionId,
  sources: readonly QuestionBlueprintVersionSource[],
  createdAt: Date,
): Promise<void> {
  if (sources.length === 0) return;
  const values: Insertable<QuestionBlueprintVersionSources>[] = sources.map(
    (source) => ({
      blueprintVersionId: versionId,
      byteSize: source.byteSize === null ? null : String(source.byteSize),
      checksumSha256: source.checksumSha256,
      createdAt,
      fileId: source.fileId,
      name: source.name,
      originalName: source.originalName,
      sourceId: source.sourceId,
      type: source.type,
      workbookId: source.workbookId,
    }),
  );
  await db
    .insertInto("questionBlueprintVersionSources")
    .values(values)
    .execute();
}

function mapVersionSourceRow(
  row: Selectable<QuestionBlueprintVersionSources>,
): QuestionBlueprintVersionSource {
  return {
    byteSize: row.byteSize === null ? null : Number(row.byteSize),
    checksumSha256: row.checksumSha256,
    fileId: row.fileId,
    name: row.name,
    originalName: row.originalName,
    sourceId: row.sourceId,
    type: "workbook",
    workbookId: workbookId(row.workbookId),
  };
}
