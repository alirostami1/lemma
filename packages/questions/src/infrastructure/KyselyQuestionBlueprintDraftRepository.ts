import type { DatabaseExecutor } from "@lemma/db";
import type {
  QuestionBlueprintDraftSourceFiles,
  QuestionBlueprintDrafts,
} from "@lemma/db/tables";
import type { Insertable, Selectable, Updateable } from "kysely";
import type { DraftSourceFileMetadata } from "../application/index.js";
import {
  type QuestionBlueprintDraft,
  type QuestionBlueprintDraftId,
  type QuestionBlueprintDraftStatus,
  reconstituteQuestionBlueprintDraft,
  type UserId,
} from "../domain/index.js";
import { mapJsonArrayToDb } from "./KyselyQuestionMappers.js";

export class KyselyQuestionBlueprintDraftRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async findQuestionBlueprintDraftById(
    id: QuestionBlueprintDraftId,
  ): Promise<QuestionBlueprintDraft | null> {
    const row = await this.db
      .selectFrom("questionBlueprintDrafts")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? mapRow(row) : null;
  }

  async listQuestionBlueprintDraftsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionBlueprintDraftStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<QuestionBlueprintDraft[]> {
    let query = this.db
      .selectFrom("questionBlueprintDrafts")
      .selectAll()
      .where("ownerUserId", "=", input.ownerUserId);
    if (input.statuses?.length) {
      query = query.where("status", "in", input.statuses);
    }
    if (input.cursor) query = query.where("updatedAt", "<", input.cursor);
    const rows = await query
      .orderBy("updatedAt", "desc")
      .limit(input.limit)
      .execute();
    return rows.map(mapRow);
  }

  async createQuestionBlueprintDraft(
    draft: QuestionBlueprintDraft,
  ): Promise<QuestionBlueprintDraft> {
    const values = mapInsert(draft);
    const row = await this.db
      .insertInto("questionBlueprintDrafts")
      .values(values)
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapRow(row);
  }

  async updateQuestionBlueprintDraft(
    draft: QuestionBlueprintDraft,
  ): Promise<QuestionBlueprintDraft | null> {
    const row = await this.db
      .updateTable("questionBlueprintDrafts")
      .set(mapUpdate(draft))
      .where("id", "=", draft.id)
      .returningAll()
      .executeTakeFirst();
    return row ? mapRow(row) : null;
  }

  async attachQuestionBlueprintDraftSourceFile(input: {
    draft: QuestionBlueprintDraft;
    sourceId: string;
    file: DraftSourceFileMetadata;
  }): Promise<QuestionBlueprintDraft | null> {
    const attachment: Insertable<QuestionBlueprintDraftSourceFiles> = {
      byteSize: String(input.file.byteSize),
      checksumSha256: input.file.checksumSha256,
      contentType: input.file.contentType,
      createdAt: input.draft.updatedAt,
      draftId: input.draft.id,
      fileId: input.file.fileId,
      originalName: input.file.originalName,
      sourceId: input.sourceId,
    };
    await this.db
      .insertInto("questionBlueprintDraftSourceFiles")
      .values(attachment)
      .onConflict((conflict) =>
        conflict.columns(["draftId", "sourceId"]).doUpdateSet({
          byteSize: attachment.byteSize,
          checksumSha256: attachment.checksumSha256,
          contentType: attachment.contentType,
          fileId: attachment.fileId,
          originalName: attachment.originalName,
        }),
      )
      .execute();
    return this.updateQuestionBlueprintDraft(input.draft);
  }
}

function mapRow(
  row: Selectable<QuestionBlueprintDrafts> & {
    document: unknown;
    sources: unknown;
  },
): QuestionBlueprintDraft {
  return reconstituteQuestionBlueprintDraft(row);
}

function mapInsert(
  draft: QuestionBlueprintDraft,
): Insertable<QuestionBlueprintDrafts> {
  return {
    blueprintId: draft.blueprintId,
    createdAt: draft.createdAt,
    createdByUserId: draft.createdByUserId,
    description: draft.description,
    discardedAt: draft.discardedAt,
    document: JSON.stringify(
      draft.document,
    ) as Insertable<QuestionBlueprintDrafts>["document"],
    id: draft.id,
    lastSavedAt: draft.lastSavedAt,
    name: draft.name,
    ownerUserId: draft.ownerUserId,
    publishedAt: draft.publishedAt,
    sources: mapJsonArrayToDb(draft.sources),
    status: draft.status,
    updatedAt: draft.updatedAt,
  };
}

function mapUpdate(
  draft: QuestionBlueprintDraft,
): Updateable<QuestionBlueprintDrafts> {
  return {
    blueprintId: draft.blueprintId,
    description: draft.description,
    discardedAt: draft.discardedAt,
    document: JSON.stringify(
      draft.document,
    ) as Updateable<QuestionBlueprintDrafts>["document"],
    lastSavedAt: draft.lastSavedAt,
    name: draft.name,
    publishedAt: draft.publishedAt,
    sources: mapJsonArrayToDb(draft.sources),
    status: draft.status,
    updatedAt: draft.updatedAt,
  };
}
