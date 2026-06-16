import type { DatabaseExecutor } from "@lemma/db";
import type {
  Question,
  QuestionBlueprintId,
  QuestionGenerationRunId,
  QuestionId,
  QuestionStatus,
  UserId,
} from "../domain/index.js";
import {
  mapQuestionRowToDomain,
  mapQuestionToUpdate,
} from "./KyselyQuestionMappers.js";

export class KyselyQuestionLibraryRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async findQuestionById(id: QuestionId): Promise<Question | null> {
    const row = await this.db
      .selectFrom("questions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? mapQuestionRowToDomain(row) : null;
  }

  async listQuestionsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionStatus[];
    blueprintId?: QuestionBlueprintId;
    generationRunId?: QuestionGenerationRunId;
    limit: number;
    cursor?: Date;
  }): Promise<Question[]> {
    let query = this.db
      .selectFrom("questions")
      .selectAll()
      .where("ownerUserId", "=", input.ownerUserId);
    if (input.statuses?.length) {
      query = query.where("status", "in", input.statuses);
    }
    if (input.blueprintId) {
      query = query.where("blueprintId", "=", input.blueprintId);
    }
    if (input.generationRunId) {
      query = query.where("generationRunId", "=", input.generationRunId);
    }
    if (input.cursor) {
      query = query.where("createdAt", "<", input.cursor);
    }
    const rows = await query
      .orderBy("createdAt", "desc")
      .limit(input.limit)
      .execute();
    return rows.map(mapQuestionRowToDomain);
  }

  async deleteQuestion(question: Question): Promise<Question | null> {
    const row = await this.db
      .updateTable("questions")
      .set(mapQuestionToUpdate(question))
      .where("id", "=", question.id)
      .returningAll()
      .executeTakeFirst();
    return row ? mapQuestionRowToDomain(row) : null;
  }
}
