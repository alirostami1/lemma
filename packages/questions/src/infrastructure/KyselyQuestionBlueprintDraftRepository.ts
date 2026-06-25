import type { DatabaseExecutor } from "@lemma/db";
import type {
  DB,
  QuestionBlueprintDraftSourceFiles,
  QuestionBlueprintDrafts,
} from "@lemma/db/tables";
import type {
  Insertable,
  InsertObject,
  Selectable,
  UpdateObject,
} from "kysely";
import {
  type DraftSourceFileMetadata,
  type PublishSourceMaterialization,
  QuestionBlueprintBaseVersionConflictError,
  QuestionBlueprintDraftRevisionConflictError,
} from "../application/index.js";
import {
  createQuestionBlueprint,
  InvalidQuestionStateTransitionError,
  markQuestionBlueprintDraftPublished,
  type QuestionBlueprint,
  type QuestionBlueprintDraft,
  type QuestionBlueprintDraftId,
  type QuestionBlueprintDraftSource,
  type QuestionBlueprintDraftStatus,
  type QuestionBlueprintId,
  type QuestionBlueprintVersion,
  type QuestionBlueprintVersionId,
  questionBlueprintDraftPublishIdempotencyKey,
  questionBlueprintSourceIdsUsedByDocument,
  questionBlueprintVersionId,
  questionBlueprintVisibility,
  reconstituteQuestionBlueprintDraft,
  type UserId,
  updateQuestionBlueprintDefinition,
  updateQuestionBlueprintMetadata,
  type WorkbookId,
} from "../domain/index.js";
import { insertQuestionBlueprintVersion } from "./KyselyQuestionBlueprintRepository.js";
import {
  mapJsonArrayToDb,
  mapQuestionBlueprintRowToDomain,
  mapQuestionBlueprintToInsert,
  mapQuestionBlueprintToUpdate,
  mapQuestionBlueprintVersionRowToDomain,
} from "./KyselyQuestionMappers.js";

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

  async findActiveQuestionBlueprintDraftByOwnerAndBlueprint(input: {
    ownerUserId: UserId;
    blueprintId: QuestionBlueprintId;
  }): Promise<QuestionBlueprintDraft | null> {
    const row = await this.db
      .selectFrom("questionBlueprintDrafts")
      .selectAll()
      .where("ownerUserId", "=", input.ownerUserId)
      .where("blueprintId", "=", input.blueprintId)
      .where("status", "in", ["draft", "publishing"])
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

  async createOrResumeQuestionBlueprintEditDraft(input: {
    draft: QuestionBlueprintDraft;
    ownerUserId: UserId;
    blueprintId: QuestionBlueprintId;
  }): Promise<{
    draft: QuestionBlueprintDraft;
    resolution: "created" | "resumed";
  }> {
    const existing =
      await this.findActiveQuestionBlueprintDraftByOwnerAndBlueprint(input);
    if (existing) return { draft: existing, resolution: "resumed" };

    try {
      return {
        draft: await this.createQuestionBlueprintDraft(input.draft),
        resolution: "created",
      };
    } catch (error) {
      if (!isActiveTargetedDraftUniqueViolation(error)) throw error;

      const raced =
        await this.findActiveQuestionBlueprintDraftByOwnerAndBlueprint(input);
      if (!raced) throw error;
      return { draft: raced, resolution: "resumed" };
    }
  }

  async updateQuestionBlueprintDraftWithExpectedRevision(input: {
    draft: QuestionBlueprintDraft;
    expectedRevision: number;
  }): Promise<QuestionBlueprintDraft | null> {
    return updateQuestionBlueprintDraftWithExpectedRevision(this.db, input);
  }

  async publishQuestionBlueprintDraft(input: {
    blueprintId: QuestionBlueprintId;
    draftId: QuestionBlueprintDraftId;
    expectedRevision: number;
    idempotencyKey: string;
    ownerUserId: UserId;
    sourceMaterialization: readonly PublishSourceMaterialization[];
    publishedAt: Date;
    versionId: QuestionBlueprintVersionId;
  }): Promise<{
    draft: QuestionBlueprintDraft;
    questionBlueprint: QuestionBlueprint;
    questionBlueprintVersion: QuestionBlueprintVersion;
  } | null> {
    return withTransaction(this.db, (tx) =>
      publishQuestionBlueprintDraftInTransaction(tx, input),
    );
  }

  async attachQuestionBlueprintDraftSourceFile(input: {
    draft: QuestionBlueprintDraft;
    expectedRevision: number;
    sourceId: string;
    file: DraftSourceFileMetadata;
  }): Promise<QuestionBlueprintDraft | null> {
    return withTransaction(this.db, async (tx) => {
      const updated = await updateQuestionBlueprintDraftWithExpectedRevision(
        tx,
        input,
      );
      if (!updated) return null;

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
      await tx
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
      return updated;
    });
  }
}

async function publishQuestionBlueprintDraftInTransaction(
  db: DatabaseExecutor,
  input: {
    blueprintId: QuestionBlueprintId;
    draftId: QuestionBlueprintDraftId;
    expectedRevision: number;
    idempotencyKey: string;
    ownerUserId: UserId;
    sourceMaterialization: readonly PublishSourceMaterialization[];
    publishedAt: Date;
    versionId: QuestionBlueprintVersionId;
  },
): Promise<{
  draft: QuestionBlueprintDraft;
  questionBlueprint: QuestionBlueprint;
  questionBlueprintVersion: QuestionBlueprintVersion;
} | null> {
  const lockedDraftRow = await db
    .selectFrom("questionBlueprintDrafts")
    .selectAll()
    .where("id", "=", input.draftId)
    .forUpdate()
    .executeTakeFirst();
  if (!lockedDraftRow) return null;

  const lockedDraft = mapRow(lockedDraftRow);
  if (lockedDraft.ownerUserId !== input.ownerUserId) return null;
  if (lockedDraft.status === "published") {
    if (
      lockedDraft.publishIdempotencyKey ===
      questionBlueprintDraftPublishIdempotencyKey(input.idempotencyKey)
    ) {
      return findPublishedDraftResult(db, lockedDraft);
    }
    throw new InvalidQuestionStateTransitionError(
      "question blueprint draft cannot be published from current state",
    );
  }
  if (lockedDraft.status !== "draft") {
    throw new InvalidQuestionStateTransitionError(
      "question blueprint draft cannot be published from current state",
    );
  }
  if (lockedDraft.revision !== input.expectedRevision) {
    throw new QuestionBlueprintDraftRevisionConflictError();
  }

  const sources = derivePublishedDraftSources(input, lockedDraft);
  const publishedSources = derivePublishedBlueprintSources(
    lockedDraft,
    sources,
  );
  const blueprintId = lockedDraft.blueprintId ?? input.blueprintId;

  const questionBlueprintVersion = lockedDraft.baseVersionId
    ? await publishExistingBlueprintDraft(
        db,
        input,
        lockedDraft,
        publishedSources,
      )
    : await publishNewBlueprintDraft(db, input, lockedDraft, publishedSources);

  const publishedDraft = markQuestionBlueprintDraftPublished(
    lockedDraft,
    {
      blueprintId,
      idempotencyKey: input.idempotencyKey,
      sources,
      versionId: input.versionId,
    },
    input.publishedAt,
  );
  const draft = await updateQuestionBlueprintDraftUnchecked(db, publishedDraft);
  if (!draft) return null;

  const blueprintRow = await db
    .selectFrom("questionBlueprints")
    .selectAll()
    .where("id", "=", blueprintId)
    .executeTakeFirst();
  if (!blueprintRow) return null;

  return {
    draft,
    questionBlueprint: mapQuestionBlueprintRowToDomain(blueprintRow),
    questionBlueprintVersion,
  };
}

function derivePublishedDraftSources(
  input: {
    sourceMaterialization: readonly PublishSourceMaterialization[];
  },
  lockedDraft: QuestionBlueprintDraft,
): QuestionBlueprintDraftSource[] {
  const usedIds = new Set(
    questionBlueprintSourceIdsUsedByDocument(lockedDraft.document),
  );
  const lockedById = new Map(
    lockedDraft.sources.map((source) => [source.sourceId, source]),
  );
  const preparedById = new Map<string, WorkbookId>();
  for (const prepared of input.sourceMaterialization) {
    if (preparedById.has(prepared.sourceId)) {
      throw new InvalidQuestionStateTransitionError(
        "publish source materialization contains duplicate source ids",
      );
    }

    const lockedSource = lockedById.get(prepared.sourceId);
    if (!lockedSource || !usedIds.has(prepared.sourceId)) {
      throw new InvalidQuestionStateTransitionError(
        "publish source materialization does not match locked draft",
      );
    }

    if (
      lockedSource.workbookId !== null &&
      lockedSource.workbookId !== prepared.workbookId
    ) {
      throw new InvalidQuestionStateTransitionError(
        "publish source materialization conflicts with locked draft",
      );
    }

    preparedById.set(prepared.sourceId, prepared.workbookId);
  }
  return lockedDraft.sources.map((source) => {
    const workbookId = preparedById.get(source.sourceId);
    if (workbookId === undefined) return source;
    if (source.workbookId !== null) {
      if (source.status !== "validated" || source.workbookId !== workbookId) {
        throw new InvalidQuestionStateTransitionError(
          "publish source materialization conflicts with locked draft",
        );
      }
      return source;
    }

    if (source.status !== "uploaded" || source.fileId === null) {
      throw new InvalidQuestionStateTransitionError(
        "publish source materialization does not match locked draft",
      );
    }

    return { ...source, status: "validated", workbookId };
  });
}

function derivePublishedBlueprintSources(
  lockedDraft: QuestionBlueprintDraft,
  sources: readonly QuestionBlueprintDraftSource[],
): QuestionBlueprint["sources"] {
  const usedIds = questionBlueprintSourceIdsUsedByDocument(
    lockedDraft.document,
  );
  const sourcesById = new Map(
    sources.map((source) => [source.sourceId, source]),
  );
  return usedIds.map((sourceId) => {
    const source = sourcesById.get(sourceId);
    if (source?.status !== "validated" || source.workbookId === null) {
      throw new InvalidQuestionStateTransitionError(
        "publish source materialization does not match locked draft",
      );
    }
    return {
      name: source.name,
      sourceId,
      type: "workbook" as const,
      workbookId: source.workbookId,
    };
  });
}

async function publishNewBlueprintDraft(
  db: DatabaseExecutor,
  input: {
    blueprintId: QuestionBlueprintId;
    publishedAt: Date;
    versionId: QuestionBlueprintVersionId;
  },
  lockedDraft: QuestionBlueprintDraft,
  sources: QuestionBlueprint["sources"],
): Promise<QuestionBlueprintVersion> {
  const newBlueprint = createQuestionBlueprint(
    {
      createdByUserId: lockedDraft.createdByUserId,
      currentVersionId: input.versionId,
      description: lockedDraft.description,
      document: lockedDraft.document,
      id: input.blueprintId,
      name: lockedDraft.name,
      ownerUserId: lockedDraft.ownerUserId,
      sources,
      visibility: questionBlueprintVisibility("private"),
    },
    input.publishedAt,
  );
  const blueprintRow = await db
    .insertInto("questionBlueprints")
    .values(mapQuestionBlueprintToInsert(newBlueprint))
    .returningAll()
    .executeTakeFirstOrThrow();
  const blueprint = mapQuestionBlueprintRowToDomain(blueprintRow);
  await insertQuestionBlueprintVersion(db, {
    blueprint,
    id: input.versionId,
    parentVersionId: null,
    publishedAt: blueprint.createdAt,
    versionNumber: 1,
  });
  return findQuestionBlueprintVersionByIdOrThrow(db, input.versionId);
}

async function publishExistingBlueprintDraft(
  db: DatabaseExecutor,
  input: {
    publishedAt: Date;
    versionId: QuestionBlueprintVersionId;
  },
  lockedDraft: QuestionBlueprintDraft,
  sources: QuestionBlueprint["sources"],
): Promise<QuestionBlueprintVersion> {
  if (!lockedDraft.blueprintId) {
    throw new QuestionBlueprintBaseVersionConflictError();
  }
  const currentRow = await db
    .selectFrom("questionBlueprints")
    .selectAll()
    .where("id", "=", lockedDraft.blueprintId)
    .forUpdate()
    .executeTakeFirst();
  if (!currentRow) {
    throw new QuestionBlueprintBaseVersionConflictError();
  }
  const current = mapQuestionBlueprintRowToDomain(currentRow);
  if (current.currentVersionId !== lockedDraft.baseVersionId) {
    throw new QuestionBlueprintBaseVersionConflictError();
  }
  const blueprint = updateQuestionBlueprintDefinition(
    updateQuestionBlueprintMetadata(
      current,
      { description: lockedDraft.description, name: lockedDraft.name },
      input.publishedAt,
    ),
    { document: lockedDraft.document, sources },
    input.publishedAt,
  );

  const maxVersion = await db
    .selectFrom("questionBlueprintVersions")
    .select(({ fn }) => fn.max<number>("versionNumber").as("maxVersionNumber"))
    .where("blueprintId", "=", current.id)
    .executeTakeFirst();
  const nextVersionNumber = Number(maxVersion?.maxVersionNumber ?? 0) + 1;
  await insertQuestionBlueprintVersion(db, {
    blueprint,
    id: input.versionId,
    parentVersionId: questionBlueprintVersionId(current.currentVersionId),
    publishedAt: input.publishedAt,
    versionNumber: nextVersionNumber,
  });

  await db
    .updateTable("questionBlueprints")
    .set({
      ...mapQuestionBlueprintToUpdate(blueprint),
      currentVersionId: input.versionId,
    })
    .where("id", "=", current.id)
    .executeTakeFirst();

  return findQuestionBlueprintVersionByIdOrThrow(db, input.versionId);
}

async function findPublishedDraftResult(
  db: DatabaseExecutor,
  draft: QuestionBlueprintDraft,
): Promise<{
  draft: QuestionBlueprintDraft;
  questionBlueprint: QuestionBlueprint;
  questionBlueprintVersion: QuestionBlueprintVersion;
} | null> {
  if (!draft.blueprintId || !draft.publishedVersionId) return null;
  const blueprintRow = await db
    .selectFrom("questionBlueprints")
    .selectAll()
    .where("id", "=", draft.blueprintId)
    .executeTakeFirst();
  if (!blueprintRow) return null;
  return {
    draft,
    questionBlueprint: mapQuestionBlueprintRowToDomain(blueprintRow),
    questionBlueprintVersion: await findQuestionBlueprintVersionByIdOrThrow(
      db,
      draft.publishedVersionId,
    ),
  };
}

async function findQuestionBlueprintVersionByIdOrThrow(
  db: DatabaseExecutor,
  id: QuestionBlueprintVersionId,
): Promise<QuestionBlueprintVersion> {
  const row = await db
    .selectFrom("questionBlueprintVersions")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
  return mapQuestionBlueprintVersionRowToDomain(row);
}

async function updateQuestionBlueprintDraftUnchecked(
  db: DatabaseExecutor,
  draft: QuestionBlueprintDraft,
): Promise<QuestionBlueprintDraft | null> {
  const row = await db
    .updateTable("questionBlueprintDrafts")
    .set(mapUpdate(draft))
    .where("id", "=", draft.id)
    .returningAll()
    .executeTakeFirst();
  return row ? mapRow(row) : null;
}

async function updateQuestionBlueprintDraftWithExpectedRevision(
  db: DatabaseExecutor,
  input: {
    draft: QuestionBlueprintDraft;
    expectedRevision: number;
  },
): Promise<QuestionBlueprintDraft | null> {
  const row = await db
    .updateTable("questionBlueprintDrafts")
    .set(mapUpdate(input.draft))
    .where("id", "=", input.draft.id)
    .where("revision", "=", input.expectedRevision)
    .returningAll()
    .executeTakeFirst();
  return row ? mapRow(row) : null;
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
): InsertObject<DB, "questionBlueprintDrafts"> {
  return {
    baseVersionId: draft.baseVersionId,
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
    publishedVersionId: draft.publishedVersionId,
    publishIdempotencyKey: draft.publishIdempotencyKey,
    revision: draft.revision,
    sources: mapJsonArrayToDb(draft.sources),
    status: draft.status,
    updatedAt: draft.updatedAt,
  };
}

function mapUpdate(
  draft: QuestionBlueprintDraft,
): UpdateObject<DB, "questionBlueprintDrafts"> {
  return {
    baseVersionId: draft.baseVersionId,
    blueprintId: draft.blueprintId,
    description: draft.description,
    discardedAt: draft.discardedAt,
    document: JSON.stringify(draft.document) as UpdateObject<
      DB,
      "questionBlueprintDrafts"
    >["document"],
    lastSavedAt: draft.lastSavedAt,
    name: draft.name,
    publishedAt: draft.publishedAt,
    publishedVersionId: draft.publishedVersionId,
    publishIdempotencyKey: draft.publishIdempotencyKey,
    revision: draft.revision,
    sources: mapJsonArrayToDb(draft.sources),
    status: draft.status,
    updatedAt: draft.updatedAt,
  };
}

function isActiveTargetedDraftUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint ===
      "question_blueprint_drafts_owner_user_id_blueprint_id_active_unique"
  );
}

type TransactionCapable = {
  transaction(): {
    execute<T>(fn: (tx: DatabaseExecutor) => Promise<T>): Promise<T>;
  };
};

function hasTransaction(
  db: DatabaseExecutor,
): db is DatabaseExecutor & TransactionCapable {
  return "transaction" in db && typeof db.transaction === "function";
}

function withTransaction<T>(
  db: DatabaseExecutor,
  fn: (tx: DatabaseExecutor) => Promise<T>,
): Promise<T> {
  if (hasTransaction(db)) {
    return db.transaction().execute(fn);
  }
  return fn(db);
}
