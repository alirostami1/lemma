import type { DatabaseExecutor } from "@lemma/db";
import type {
  QuestionBlueprint,
  QuestionBlueprintId,
  QuestionBlueprintStatus,
  QuestionBlueprintVersion,
  QuestionBlueprintVersionAsset,
  QuestionBlueprintVersionId,
  UserId,
} from "../domain/index.js";
import {
  mapQuestionBlueprintRowToDomain,
  mapQuestionBlueprintToInsert,
  mapQuestionBlueprintToUpdate,
  mapQuestionBlueprintVersionAssetRowToDomain,
  mapQuestionBlueprintVersionAssetToInsert,
  mapQuestionBlueprintVersionRowToDomain,
  mapQuestionBlueprintVersionToInsert,
} from "./KyselyQuestionMappers.js";

export class KyselyQuestionBlueprintRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async findQuestionBlueprintById(
    id: QuestionBlueprintId,
  ): Promise<QuestionBlueprint | null> {
    const row = await this.db
      .selectFrom("questionBlueprints")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? mapQuestionBlueprintRowToDomain(row) : null;
  }

  async findQuestionBlueprintVersionById(
    id: QuestionBlueprintVersionId,
  ): Promise<QuestionBlueprintVersion | null> {
    const row = await this.db
      .selectFrom("questionBlueprintVersions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? mapQuestionBlueprintVersionRowToDomain(row) : null;
  }

  async findCurrentQuestionBlueprintVersion(
    blueprintId: QuestionBlueprintId,
  ): Promise<QuestionBlueprintVersion | null> {
    const row = await this.db
      .selectFrom("questionBlueprints")
      .innerJoin(
        "questionBlueprintVersions",
        "questionBlueprintVersions.id",
        "questionBlueprints.currentVersionId",
      )
      .selectAll("questionBlueprintVersions")
      .where("questionBlueprints.id", "=", blueprintId)
      .executeTakeFirst();
    return row ? mapQuestionBlueprintVersionRowToDomain(row) : null;
  }

  async listQuestionBlueprintVersions(input: {
    blueprintId: QuestionBlueprintId;
  }): Promise<QuestionBlueprintVersion[]> {
    const rows = await this.db
      .selectFrom("questionBlueprintVersions")
      .selectAll()
      .where("questionBlueprintId", "=", input.blueprintId)
      .orderBy("versionNumber", "asc")
      .execute();
    return rows.map(mapQuestionBlueprintVersionRowToDomain);
  }

  async listQuestionBlueprintVersionAssets(input: {
    blueprintVersionId: QuestionBlueprintVersion["id"];
  }): Promise<QuestionBlueprintVersionAsset[]> {
    const rows = await this.db
      .selectFrom("questionBlueprintVersionAssets")
      .selectAll()
      .where("questionBlueprintVersionId", "=", input.blueprintVersionId)
      .orderBy("position", "asc")
      .execute();
    return rows.map(mapQuestionBlueprintVersionAssetRowToDomain);
  }

  async listQuestionBlueprintVersionAssetsByVersionIds(input: {
    blueprintVersionIds: readonly QuestionBlueprintVersion["id"][];
  }): Promise<QuestionBlueprintVersionAsset[]> {
    if (input.blueprintVersionIds.length === 0) {
      return [];
    }
    const rows = await this.db
      .selectFrom("questionBlueprintVersionAssets")
      .selectAll()
      .where("questionBlueprintVersionId", "in", input.blueprintVersionIds)
      .orderBy("questionBlueprintVersionId", "asc")
      .orderBy("position", "asc")
      .execute();
    return rows.map(mapQuestionBlueprintVersionAssetRowToDomain);
  }

  async listQuestionBlueprintsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionBlueprintStatus[];
    limit: number;
    cursor?: Date;
    includeSystem?: boolean;
  }): Promise<QuestionBlueprint[]> {
    let query = this.db.selectFrom("questionBlueprints").selectAll();
    query = input.includeSystem
      ? query.where((eb) =>
          eb.or([
            eb("ownerUserId", "=", input.ownerUserId),
            eb("visibility", "=", "system"),
          ]),
        )
      : query.where("ownerUserId", "=", input.ownerUserId);
    if (input.statuses?.length) {
      query = query.where("status", "in", input.statuses);
    }
    if (input.cursor) {
      query = query.where("createdAt", "<", input.cursor);
    }
    const rows = await query
      .orderBy("createdAt", "desc")
      .limit(input.limit)
      .execute();
    return rows.map(mapQuestionBlueprintRowToDomain);
  }

  async createQuestionBlueprint(
    blueprint: QuestionBlueprint,
  ): Promise<QuestionBlueprint> {
    const row = await this.db
      .insertInto("questionBlueprints")
      .values(mapQuestionBlueprintToInsert(blueprint))
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapQuestionBlueprintRowToDomain(row);
  }

  async createQuestionBlueprintVersion(
    version: QuestionBlueprintVersion,
  ): Promise<QuestionBlueprintVersion> {
    const row = await this.db
      .insertInto("questionBlueprintVersions")
      .values(mapQuestionBlueprintVersionToInsert(version))
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapQuestionBlueprintVersionRowToDomain(row);
  }

  async updateQuestionBlueprint(
    blueprint: QuestionBlueprint,
  ): Promise<QuestionBlueprint | null> {
    const row = await this.db
      .updateTable("questionBlueprints")
      .set(mapQuestionBlueprintToUpdate(blueprint))
      .where("id", "=", blueprint.id)
      .returningAll()
      .executeTakeFirst();
    return row ? mapQuestionBlueprintRowToDomain(row) : null;
  }

  async updateQuestionBlueprintCurrentVersion(input: {
    blueprintId: QuestionBlueprintId;
    currentVersionId: QuestionBlueprintVersionId;
    sources: QuestionBlueprint["sources"];
    updatedAt: Date;
  }): Promise<QuestionBlueprint | null> {
    const row = await this.db
      .updateTable("questionBlueprints")
      .set({
        currentVersionId: input.currentVersionId,
        sources: input.sources as never,
        updatedAt: input.updatedAt,
      })
      .where("id", "=", input.blueprintId)
      .returningAll()
      .executeTakeFirst();
    return row ? mapQuestionBlueprintRowToDomain(row) : null;
  }

  async createQuestionBlueprintWithVersion(input: {
    blueprint: QuestionBlueprint;
    version: QuestionBlueprintVersion;
    assets: readonly QuestionBlueprintVersionAsset[];
  }): Promise<QuestionBlueprint> {
    return this.db.transaction().execute(async (tx) => {
      const blueprintRow = await tx
        .insertInto("questionBlueprints")
        .values({
          ...mapQuestionBlueprintToInsert(input.blueprint),
          currentVersionId: null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      const versionRow = await tx
        .insertInto("questionBlueprintVersions")
        .values({
          ...mapQuestionBlueprintVersionToInsert(input.version),
          questionBlueprintId: blueprintRow.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      if (input.assets.length > 0) {
        await tx
          .insertInto("questionBlueprintVersionAssets")
          .values(
            input.assets.map((asset) => ({
              ...mapQuestionBlueprintVersionAssetToInsert(asset),
              questionBlueprintVersionId: versionRow.id,
            })),
          )
          .execute();
      }
      const updatedBlueprintRow = await tx
        .updateTable("questionBlueprints")
        .set({
          currentVersionId: versionRow.id,
          sources: versionRow.sources,
        })
        .where("id", "=", blueprintRow.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      return mapQuestionBlueprintRowToDomain(updatedBlueprintRow);
    });
  }

  async updateQuestionBlueprintWithNewVersion(input: {
    blueprint: QuestionBlueprint;
    version: QuestionBlueprintVersion;
    assets: readonly QuestionBlueprintVersionAsset[];
  }): Promise<QuestionBlueprint | null> {
    return this.db.transaction().execute(async (tx) => {
      const blueprintRow = await tx
        .updateTable("questionBlueprints")
        .set(mapQuestionBlueprintToUpdate(input.blueprint))
        .where("id", "=", input.blueprint.id)
        .returningAll()
        .executeTakeFirst();
      if (!blueprintRow) {
        return null;
      }
      const versionRow = await tx
        .insertInto("questionBlueprintVersions")
        .values(mapQuestionBlueprintVersionToInsert(input.version))
        .returningAll()
        .executeTakeFirstOrThrow();
      if (input.assets.length > 0) {
        await tx
          .insertInto("questionBlueprintVersionAssets")
          .values(
            input.assets.map((asset) => ({
              ...mapQuestionBlueprintVersionAssetToInsert(asset),
              questionBlueprintVersionId: versionRow.id,
            })),
          )
          .execute();
      }
      const updatedBlueprintRow = await tx
        .updateTable("questionBlueprints")
        .set({
          currentVersionId: versionRow.id,
          sources: versionRow.sources,
        })
        .where("id", "=", blueprintRow.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      return mapQuestionBlueprintRowToDomain(updatedBlueprintRow);
    });
  }
}
