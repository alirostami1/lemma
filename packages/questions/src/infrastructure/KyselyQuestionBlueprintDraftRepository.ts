import type { DatabaseExecutor } from "@lemma/db";
import type {
  DB,
  QuestionBlueprintDraftSources,
  QuestionBlueprintDrafts,
  QuestionBlueprintVersions,
} from "@lemma/db/tables";
import type { OperationLineage } from "@lemma/domain";
import type { CurrentUser } from "@lemma/identity/application";
import type {
  Insertable,
  InsertObject,
  Selectable,
  UpdateObject,
} from "kysely";
import {
  DraftSourceFileForbiddenError,
  DraftSourceFileInvalidError,
  type DraftSourceFileMetadata,
  DraftSourceKindUnsupportedError,
  DraftSourceNotFoundError,
  type PublishSourceMaterialization,
  QuestionBlueprintBaseVersionConflictError,
  QuestionBlueprintDraftRevisionConflictError,
} from "../application/index.js";
import {
  attachDraftSourceFile,
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
  type QuestionBlueprintVersionSource,
  questionBlueprintDraftPublishIdempotencyKey,
  questionBlueprintSourceIdsUsedByDocument,
  questionBlueprintVersionId,
  questionBlueprintVisibility,
  reconstituteQuestionBlueprintDraft,
  reconstituteQuestionBlueprintVersion,
  type UserId,
  updateQuestionBlueprintDefinition,
  updateQuestionBlueprintMetadata,
  type WorkbookId,
  workbookId,
} from "../domain/index.js";
import {
  insertQuestionBlueprintVersion,
  listVersionSources,
} from "./KyselyQuestionBlueprintRepository.js";
import {
  mapQuestionBlueprintRowToDomain,
  mapQuestionBlueprintToInsert,
  mapQuestionBlueprintToUpdate,
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
    return row ? mapRow(row, await listDraftSources(this.db, [row.id])) : null;
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
    return row ? mapRow(row, await listDraftSources(this.db, [row.id])) : null;
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
    const sources = await listDraftSources(
      this.db,
      rows.map((row) => row.id),
    );
    return rows.map((row) => mapRow(row, sources));
  }

  async createQuestionBlueprintDraft(
    draft: QuestionBlueprintDraft,
  ): Promise<QuestionBlueprintDraft> {
    return withTransaction(this.db, async (tx) => {
      const values = mapInsert(draft);
      const row = await tx
        .insertInto("questionBlueprintDrafts")
        .values(values)
        .returningAll()
        .executeTakeFirstOrThrow();
      await replaceDraftSources(tx, draft);
      return mapRow(row, await listDraftSources(tx, [row.id]));
    });
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
    return withTransaction(this.db, (tx) =>
      updateQuestionBlueprintDraftWithExpectedRevision(tx, input),
    );
  }

  async attachQuestionBlueprintDraftSourceFileWithExpectedRevision(input: {
    currentUser: CurrentUser;
    draftId: QuestionBlueprintDraftId;
    expectedRevision: number;
    file: DraftSourceFileMetadata;
    lineage: OperationLineage;
    registeredAt: Date;
    sourceId: string;
    registerWorkbookFromFile(input: {
      currentUser: CurrentUser;
      fileId: string;
      lineage: OperationLineage;
      name: string;
    }): Promise<{ workbookId: WorkbookId }>;
  }): Promise<QuestionBlueprintDraft | null> {
    return withTransaction(this.db, (tx) =>
      attachQuestionBlueprintDraftSourceFileInTransaction(tx, input),
    );
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
}

async function attachQuestionBlueprintDraftSourceFileInTransaction(
  db: DatabaseExecutor,
  input: {
    currentUser: CurrentUser;
    draftId: QuestionBlueprintDraftId;
    expectedRevision: number;
    file: DraftSourceFileMetadata;
    lineage: OperationLineage;
    registeredAt: Date;
    sourceId: string;
    registerWorkbookFromFile(input: {
      currentUser: CurrentUser;
      fileId: string;
      lineage: OperationLineage;
      name: string;
    }): Promise<{ workbookId: WorkbookId }>;
  },
): Promise<QuestionBlueprintDraft | null> {
  const lockedDraftRow = await db
    .selectFrom("questionBlueprintDrafts")
    .selectAll()
    .where("id", "=", input.draftId)
    .forUpdate()
    .executeTakeFirst();
  if (!lockedDraftRow) return null;

  const lockedDraft = mapRow(
    lockedDraftRow,
    await listDraftSources(db, [lockedDraftRow.id]),
  );
  if (lockedDraft.ownerUserId !== input.currentUser.user.id) return null;
  if (lockedDraft.status !== "draft") {
    throw new InvalidQuestionStateTransitionError(
      "question blueprint draft cannot change from current state",
    );
  }
  if (lockedDraft.revision !== input.expectedRevision) {
    throw new QuestionBlueprintDraftRevisionConflictError();
  }
  if (input.file.ownerUserId !== lockedDraft.ownerUserId) {
    throw new DraftSourceFileForbiddenError(
      "Draft source file must belong to draft owner.",
    );
  }
  if (
    input.file.purpose !== "workbook" ||
    input.file.contentType !==
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    throw new DraftSourceFileInvalidError(
      "Draft source file must be an xlsx workbook.",
    );
  }

  const source = lockedDraft.sources.find(
    (candidate) => candidate.sourceId === input.sourceId,
  );
  if (!source) throw new DraftSourceNotFoundError();
  if (source.type !== "workbook") throw new DraftSourceKindUnsupportedError();

  // Intentionally call workbook registration only after the locked revision
  // check so stale attaches cannot create materialization side effects.
  const registered = await input.registerWorkbookFromFile({
    currentUser: input.currentUser,
    fileId: input.file.fileId,
    lineage: input.lineage,
    name: source.name,
  });
  const updated = attachDraftSourceFile(
    lockedDraft,
    {
      byteSize: input.file.byteSize,
      checksumSha256: input.file.checksumSha256,
      fileId: input.file.fileId,
      originalName: input.file.originalName,
      sourceId: input.sourceId,
      workbookId: workbookId(registered.workbookId),
    },
    input.registeredAt,
  );
  const row = await db
    .updateTable("questionBlueprintDrafts")
    .set(mapUpdate(updated))
    .where("id", "=", updated.id)
    .where("revision", "=", input.expectedRevision)
    .returningAll()
    .executeTakeFirst();
  if (!row) throw new QuestionBlueprintDraftRevisionConflictError();

  const updatedSource = updated.sources.find(
    (candidate) => candidate.sourceId === input.sourceId,
  );
  if (!updatedSource) throw new DraftSourceNotFoundError();
  await db
    .updateTable("questionBlueprintDraftSources")
    .set({
      byteSize:
        updatedSource.byteSize === null ? null : String(updatedSource.byteSize),
      checksumSha256: updatedSource.checksumSha256,
      fileId: updatedSource.fileId,
      originalName: updatedSource.originalName,
      status: updatedSource.status,
      updatedAt: updated.updatedAt,
      workbookId: updatedSource.workbookId,
    })
    .where("draftId", "=", updated.id)
    .where("sourceId", "=", input.sourceId)
    .execute();

  return mapRow(row, await listDraftSources(db, [row.id]));
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

  const lockedDraft = mapRow(
    lockedDraftRow,
    await listDraftSources(db, [lockedDraftRow.id]),
  );
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
  const sourceSnapshot = derivePublishedVersionSources(lockedDraft, sources);
  const blueprintId = lockedDraft.blueprintId ?? input.blueprintId;

  const questionBlueprintVersion = lockedDraft.baseVersionId
    ? await publishExistingBlueprintDraft(
        db,
        input,
        lockedDraft,
        publishedSources,
        sourceSnapshot,
      )
    : await publishNewBlueprintDraft(
        db,
        input,
        lockedDraft,
        publishedSources,
        sourceSnapshot,
      );

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
  const versionSources = await listVersionSources(db, [
    questionBlueprintVersion.id,
  ]);

  return {
    draft,
    questionBlueprint: mapQuestionBlueprintRowToDomain({
      ...blueprintRow,
      sources: versionSources.get(questionBlueprintVersion.id) ?? [],
    }),
    questionBlueprintVersion: {
      ...questionBlueprintVersion,
      sources: versionSources.get(questionBlueprintVersion.id) ?? [],
    },
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
    if (source.status !== "validated" || source.workbookId !== workbookId) {
      throw new InvalidQuestionStateTransitionError(
        "publish source materialization conflicts with locked draft",
      );
    }
    return source;
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
      byteSize: source.byteSize,
      checksumSha256: source.checksumSha256,
      fileId: source.fileId,
      name: source.name,
      originalName: source.originalName,
      sourceId,
      type: "workbook" as const,
      workbookId: source.workbookId,
    };
  });
}

function derivePublishedVersionSources(
  lockedDraft: QuestionBlueprintDraft,
  sources: readonly QuestionBlueprintDraftSource[],
): QuestionBlueprintVersionSource[] {
  const usedIds = new Set(
    questionBlueprintSourceIdsUsedByDocument(lockedDraft.document),
  );
  return sources
    .filter((source) => usedIds.has(source.sourceId))
    .map((source) => {
      if (source.status !== "validated" || source.workbookId === null) {
        throw new InvalidQuestionStateTransitionError(
          "publish source materialization does not match locked draft",
        );
      }
      return {
        byteSize: source.byteSize,
        checksumSha256: source.checksumSha256,
        fileId: source.fileId,
        name: source.name,
        originalName: source.originalName,
        sourceId: source.sourceId,
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
  sourceSnapshot: readonly QuestionBlueprintVersionSource[],
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
  const blueprint = mapQuestionBlueprintRowToDomain({
    ...blueprintRow,
    sources: newBlueprint.sources,
  });
  await insertQuestionBlueprintVersion(db, {
    blueprint,
    id: input.versionId,
    parentVersionId: null,
    publishedAt: blueprint.createdAt,
    sourceSnapshot,
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
  sourceSnapshot: readonly QuestionBlueprintVersionSource[],
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
  const currentSources = await listVersionSources(db, [
    currentRow.currentVersionId,
  ]);
  const current = mapQuestionBlueprintRowToDomain({
    ...currentRow,
    sources: currentSources.get(currentRow.currentVersionId) ?? [],
  });
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
    sourceSnapshot,
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
  const versionSources = await listVersionSources(db, [
    draft.publishedVersionId,
  ]);
  return {
    draft,
    questionBlueprint: mapQuestionBlueprintRowToDomain({
      ...blueprintRow,
      sources: versionSources.get(draft.publishedVersionId) ?? [],
    }),
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
  const sources = await listVersionSources(db, [row.id]);
  return reconstituteQuestionBlueprintVersionFromRow(
    row,
    sources.get(row.id) ?? [],
  );
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
  if (!row) return null;
  await replaceDraftSources(db, draft);
  return mapRow(row, await listDraftSources(db, [row.id]));
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
  if (!row) return null;
  await replaceDraftSources(db, input.draft);
  return mapRow(row, await listDraftSources(db, [row.id]));
}

function mapRow(
  row: Selectable<QuestionBlueprintDrafts> & { document: unknown },
  sourcesByDraftId: Map<string, QuestionBlueprintDraftSource[]>,
): QuestionBlueprintDraft {
  return reconstituteQuestionBlueprintDraft({
    ...row,
    sources: sourcesByDraftId.get(row.id) ?? [],
  });
}

function reconstituteQuestionBlueprintVersionFromRow(
  row: Selectable<QuestionBlueprintVersions> & { document: unknown },
  sources: readonly QuestionBlueprintVersionSource[],
): QuestionBlueprintVersion {
  return reconstituteQuestionBlueprintVersion({
    ...row,
    sources,
  });
}

async function listDraftSources(
  db: DatabaseExecutor,
  draftIds: readonly string[],
): Promise<Map<string, QuestionBlueprintDraftSource[]>> {
  const result = new Map<string, QuestionBlueprintDraftSource[]>();
  if (draftIds.length === 0) return result;
  const rows = await db
    .selectFrom("questionBlueprintDraftSources")
    .selectAll()
    .where("draftId", "in", [...draftIds])
    .orderBy("createdAt", "asc")
    .execute();
  for (const row of rows) {
    const source = mapDraftSourceRow(row);
    const sources = result.get(row.draftId) ?? [];
    sources.push(source);
    result.set(row.draftId, sources);
  }
  return result;
}

async function replaceDraftSources(
  db: DatabaseExecutor,
  draft: QuestionBlueprintDraft,
): Promise<void> {
  const sourceIds = draft.sources.map((source) => source.sourceId);
  if (sourceIds.length > 0) {
    await db
      .deleteFrom("questionBlueprintDraftSources")
      .where("draftId", "=", draft.id)
      .where("sourceId", "not in", sourceIds)
      .execute();
  } else {
    await db
      .deleteFrom("questionBlueprintDraftSources")
      .where("draftId", "=", draft.id)
      .execute();
  }
  if (draft.sources.length === 0) return;
  const values: Insertable<QuestionBlueprintDraftSources>[] = draft.sources.map(
    (source) => ({
      byteSize: source.byteSize === null ? null : String(source.byteSize),
      checksumSha256: source.checksumSha256,
      createdAt: draft.createdAt,
      draftId: draft.id,
      fileId: source.fileId,
      name: source.name,
      originalName: source.originalName,
      sourceId: source.sourceId,
      status: source.status,
      type: source.type,
      updatedAt: draft.updatedAt,
      workbookId: source.workbookId,
    }),
  );
  await db
    .insertInto("questionBlueprintDraftSources")
    .values(values)
    .onConflict((conflict) =>
      conflict.columns(["draftId", "sourceId"]).doUpdateSet((eb) => ({
        byteSize: eb.ref("excluded.byteSize"),
        checksumSha256: eb.ref("excluded.checksumSha256"),
        fileId: eb.ref("excluded.fileId"),
        name: eb.ref("excluded.name"),
        originalName: eb.ref("excluded.originalName"),
        status: eb.ref("excluded.status"),
        type: eb.ref("excluded.type"),
        updatedAt: eb.ref("excluded.updatedAt"),
        workbookId: eb.ref("excluded.workbookId"),
      })),
    )
    .execute();
}

function mapDraftSourceRow(
  row: Selectable<QuestionBlueprintDraftSources>,
): QuestionBlueprintDraftSource {
  return {
    byteSize: row.byteSize === null ? null : Number(row.byteSize),
    checksumSha256: row.checksumSha256,
    fileId: row.fileId,
    name: row.name,
    originalName: row.originalName,
    sourceId: row.sourceId,
    status: row.status as QuestionBlueprintDraftSource["status"],
    type: "workbook",
    workbookId: row.workbookId === null ? null : workbookId(row.workbookId),
  };
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
