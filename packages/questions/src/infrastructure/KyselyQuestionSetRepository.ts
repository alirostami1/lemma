import type { DatabaseExecutor } from "@lemma/db";
import type {
  Question,
  QuestionId,
  QuestionSet,
  QuestionSetId,
  QuestionSetStatus,
  UserId,
} from "../domain/index.js";
import {
  mapQuestionRowToDomain,
  mapQuestionSetRowToDomain,
  mapQuestionSetToInsert,
  mapQuestionSetToUpdate,
} from "./KyselyQuestionMappers.js";

export class KyselyQuestionSetRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async findQuestionSetById(id: QuestionSetId): Promise<QuestionSet | null> {
    const row = await this.db
      .selectFrom("questionSets")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? mapQuestionSetRowToDomain(row) : null;
  }

  async listQuestionSetsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionSetStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<QuestionSet[]> {
    let query = this.db
      .selectFrom("questionSets")
      .selectAll()
      .where("ownerUserId", "=", input.ownerUserId);
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
    return rows.map(mapQuestionSetRowToDomain);
  }

  async createQuestionSet(set: QuestionSet): Promise<QuestionSet> {
    const row = await this.db
      .insertInto("questionSets")
      .values(mapQuestionSetToInsert(set))
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapQuestionSetRowToDomain(row);
  }

  async updateQuestionSet(set: QuestionSet): Promise<QuestionSet | null> {
    const row = await this.db
      .updateTable("questionSets")
      .set(mapQuestionSetToUpdate(set))
      .where("id", "=", set.id)
      .returningAll()
      .executeTakeFirst();
    return row ? mapQuestionSetRowToDomain(row) : null;
  }

  async removeQuestionFromSet(input: {
    questionSetId: QuestionSetId;
    questionId: QuestionId;
  }): Promise<void> {
    await this.db
      .deleteFrom("questionSetQuestions")
      .where("questionSetId", "=", input.questionSetId)
      .where("questionId", "=", input.questionId)
      .execute();
  }

  async listQuestionsBySetId(input: {
    questionSetId: QuestionSetId;
    limit: number;
    cursor?: Date;
  }): Promise<Question[]> {
    let query = this.db
      .selectFrom("questionSetQuestions")
      .innerJoin("questions", "questions.id", "questionSetQuestions.questionId")
      .selectAll("questions")
      .where("questionSetQuestions.questionSetId", "=", input.questionSetId);
    if (input.cursor) {
      query = query.where("questions.createdAt", "<", input.cursor);
    }
    const rows = await query
      .orderBy("questions.createdAt", "desc")
      .limit(input.limit)
      .execute();
    return rows.map(mapQuestionRowToDomain);
  }
}
