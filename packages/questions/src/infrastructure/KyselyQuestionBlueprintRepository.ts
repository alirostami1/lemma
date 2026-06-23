import type { DatabaseExecutor } from "@lemma/db";
import type {
  QuestionBlueprint,
  QuestionBlueprintId,
  QuestionBlueprintStatus,
  UserId,
} from "../domain/index.js";
import {
  mapQuestionBlueprintRowToDomain,
  mapQuestionBlueprintToInsert,
  mapQuestionBlueprintToUpdate,
} from "./KyselyQuestionMappers.js";

export class KyselyQuestionBlueprintRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async findQuestionBlueprintById(
    id: QuestionBlueprintId,
  ): Promise<QuestionBlueprint | null> {
    const row = await this.baseBlueprintQuery()
      .where("questionBlueprints.id", "=", id)
      .executeTakeFirst();
    return row ? mapQuestionBlueprintRowToDomain(row) : null;
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
    return rows.map((row) => mapQuestionBlueprintRowToDomain(row));
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

  private baseBlueprintQuery() {
    return this.db.selectFrom("questionBlueprints").selectAll();
  }
}
