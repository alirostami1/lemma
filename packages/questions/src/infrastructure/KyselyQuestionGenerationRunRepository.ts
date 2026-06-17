import type { DatabaseExecutor } from "@lemma/db";
import { sql } from "kysely";
import type {
  Question,
  QuestionGenerationRun,
  QuestionGenerationRunId,
  QuestionGenerationRunStatus,
  QuestionSetQuestion,
  UserId,
  WorkbookCalculationId,
} from "../domain/index.js";
import {
  mapQuestionGenerationRunRowToDomain,
  mapQuestionGenerationRunToInsert,
  mapQuestionGenerationRunToUpdate,
  mapQuestionToInsert,
} from "./KyselyQuestionMappers.js";

export class KyselyQuestionGenerationRunRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async findQuestionGenerationRunById(
    id: QuestionGenerationRunId,
  ): Promise<QuestionGenerationRun | null> {
    const row = await this.db
      .selectFrom("questionGenerationRuns")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? mapQuestionGenerationRunRowToDomain(row) : null;
  }

  async findQuestionGenerationRunByWorkbookCalculationId(
    id: WorkbookCalculationId,
  ): Promise<QuestionGenerationRun | null> {
    const row = await this.db
      .selectFrom("questionGenerationRuns")
      .selectAll()
      .where(sql<boolean>`source ->> 'workbookCalculationId' = ${id}`)
      .executeTakeFirst();
    return row ? mapQuestionGenerationRunRowToDomain(row) : null;
  }

  async listQuestionGenerationRunsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionGenerationRunStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<QuestionGenerationRun[]> {
    let query = this.db
      .selectFrom("questionGenerationRuns")
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
    return rows.map(mapQuestionGenerationRunRowToDomain);
  }

  async createQuestionGenerationRun(
    run: QuestionGenerationRun,
  ): Promise<QuestionGenerationRun> {
    const row = await this.db
      .insertInto("questionGenerationRuns")
      .values(mapQuestionGenerationRunToInsert(run))
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapQuestionGenerationRunRowToDomain(row);
  }

  async updateQuestionGenerationRun(
    run: QuestionGenerationRun,
  ): Promise<QuestionGenerationRun | null> {
    const row = await this.db
      .updateTable("questionGenerationRuns")
      .set(mapQuestionGenerationRunToUpdate(run))
      .where("id", "=", run.id)
      .returningAll()
      .executeTakeFirst();
    return row ? mapQuestionGenerationRunRowToDomain(row) : null;
  }

  async completeQuestionGenerationRun(input: {
    run: QuestionGenerationRun;
    questions: readonly Question[];
    memberships: readonly QuestionSetQuestion[];
  }): Promise<QuestionGenerationRun | null> {
    const row = await this.db
      .updateTable("questionGenerationRuns")
      .set(mapQuestionGenerationRunToUpdate(input.run))
      .where("id", "=", input.run.id)
      .where("status", "not in", ["cancelled", "failed", "succeeded"])
      .returningAll()
      .executeTakeFirst();
    if (!row) {
      return null;
    }

    if (input.questions.length > 0) {
      await this.db
        .insertInto("questions")
        .values(input.questions.map(mapQuestionToInsert))
        .execute();
    }
    if (input.memberships.length > 0) {
      await this.db
        .insertInto("questionSetQuestions")
        .values(
          input.memberships.map((membership) => ({
            questionSetId: membership.questionSetId,
            questionId: membership.questionId,
            addedByUserId: membership.addedByUserId,
            position: membership.position,
            createdAt: membership.createdAt,
          })),
        )
        .onConflict((oc) =>
          oc.columns(["questionSetId", "questionId"]).doNothing(),
        )
        .execute();
    }
    return mapQuestionGenerationRunRowToDomain(row);
  }
}
