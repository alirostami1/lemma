import type { DatabaseExecutor } from "@lemma/db";
import type {
  SourceArtifacts,
  SourceDocuments,
  SourceRevisions,
} from "@lemma/db/tables";
import type { JsonObject } from "@lemma/domain";
import type { Insertable, Selectable } from "kysely";
import {
  QuestionsRepositoryDataError,
  SourceDocumentHeadUpdateFailedError,
} from "../application/errors.js";
import type {
  ProtectedSourceReferenceCounts,
  SourceArtifact,
  SourceArtifactId,
  SourceDocument,
  SourceDocumentId,
  SourceKind,
  SourceRevision,
  SourceRevisionId,
  UserId,
  WorkbookId,
} from "../domain/index.js";
import {
  reconstituteSourceArtifact,
  reconstituteSourceDocument,
  reconstituteSourceRevision,
  workbookId,
} from "../domain/index.js";
export class KyselySourceRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async createSourceDocument(
    document: SourceDocument,
  ): Promise<SourceDocument> {
    const row = await this.db
      .insertInto("sourceDocuments")
      .values(mapSourceDocumentToInsert(document))
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapSourceDocumentRow(row);
  }

  async createSourceRevision(
    revision: SourceRevision,
  ): Promise<SourceRevision> {
    const row = await this.db
      .insertInto("sourceRevisions")
      .values(mapSourceRevisionToInsert(revision))
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapSourceRevisionRow(row);
  }

  async createSourceArtifact(
    artifact: SourceArtifact,
  ): Promise<SourceArtifact> {
    const row = await this.db
      .insertInto("sourceArtifacts")
      .values(mapSourceArtifactToInsert(artifact))
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapSourceArtifactRow(row);
  }

  async findSourceDocumentById(
    id: SourceDocumentId,
  ): Promise<SourceDocument | null> {
    const row = await this.db
      .selectFrom("sourceDocuments")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? mapSourceDocumentRow(row) : null;
  }

  async findSourceDocumentByIdForUpdate(
    id: SourceDocumentId,
  ): Promise<SourceDocument | null> {
    const row = await this.db
      .selectFrom("sourceDocuments")
      .selectAll()
      .where("id", "=", id)
      .forUpdate()
      .executeTakeFirst();
    return row ? mapSourceDocumentRow(row) : null;
  }

  async findSourceRevisionById(
    id: SourceRevisionId,
  ): Promise<SourceRevision | null> {
    const row = await this.db
      .selectFrom("sourceRevisions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? mapSourceRevisionRow(row) : null;
  }

  async findSourceArtifactById(
    id: SourceArtifactId,
  ): Promise<SourceArtifact | null> {
    const row = await this.db
      .selectFrom("sourceArtifacts")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? mapSourceArtifactRow(row) : null;
  }

  async findSourceArtifactByIdForUpdate(
    id: SourceArtifactId,
  ): Promise<SourceArtifact | null> {
    const row = await this.db
      .selectFrom("sourceArtifacts")
      .selectAll()
      .where("id", "=", id)
      .forUpdate()
      .executeTakeFirst();
    return row ? mapSourceArtifactRow(row) : null;
  }

  async countProtectedSourceArtifactReferences(
    id: SourceArtifactId,
  ): Promise<ProtectedSourceReferenceCounts> {
    const counts = await Promise.all([
      this.countArtifactDraftBindings(id),
      this.countArtifactActiveFileAliases(id),
      this.countArtifactActiveSourceDocuments(id),
      this.countArtifactGeneratedQuestions(id),
      this.countArtifactGeneratedQuestionSetMemberships(id),
      this.countArtifactGenerationRuns(id),
      this.countArtifactPublishedVersions(id),
      this.countArtifactWorkbookCalculations(id),
      this.countArtifactWorkbookSnapshots(id),
    ]);
    return {
      activeDraftSourceBindings: counts[0],
      activeFileAliases: counts[1],
      activeSourceDocuments: counts[2],
      generatedQuestions: counts[3],
      generatedQuestionSetMembershipsConservativelyRetained: counts[4],
      generationRunsConservativelyRetained: counts[5],
      publishedBlueprintVersionSources: counts[6],
      workbookCalculationsConservativelyRetained: counts[7],
      workbookSnapshotsConservativelyRetained: counts[8],
    };
  }

  async tombstoneSourceDocumentGraph(input: {
    document: SourceDocument;
  }): Promise<boolean> {
    const document = await this.db
      .updateTable("sourceDocuments")
      .set({
        deletedAt: input.document.deletedAt,
        retentionExpiresAt: input.document.retentionExpiresAt,
        status: input.document.status,
        updatedAt: input.document.updatedAt,
      })
      .where("id", "=", input.document.id)
      .where("status", "!=", "deleted")
      .returning("id")
      .executeTakeFirst();
    if (!document) return false;
    await this.db
      .updateTable("sourceRevisions")
      .set({
        deletedAt: input.document.deletedAt,
        retentionExpiresAt: input.document.retentionExpiresAt,
      })
      .where("sourceDocumentId", "=", input.document.id)
      .where("deletedAt", "is", null)
      .execute();
    await this.db
      .updateTable("sourceArtifacts")
      .set({
        deletedAt: input.document.deletedAt,
        retentionExpiresAt: input.document.retentionExpiresAt,
        updatedAt: input.document.updatedAt,
      })
      .where(
        "sourceRevisionId",
        "in",
        this.db
          .selectFrom("sourceRevisions")
          .select("id")
          .where("sourceDocumentId", "=", input.document.id),
      )
      .where("deletedAt", "is", null)
      .execute();
    return true;
  }

  async findSourceArtifactBackingWorkbookForUpdate(input: {
    sourceArtifactId: SourceArtifactId;
    workbookId: WorkbookId;
  }): Promise<{
    id: WorkbookId;
    origin: "standalone" | "source_artifact";
    otherUncollectedSourceArtifacts: number;
  } | null> {
    const workbook = await this.db
      .selectFrom("workbooks")
      .select(["id", "origin"])
      .where("id", "=", input.workbookId)
      .forUpdate()
      .executeTakeFirst();
    if (!workbook) return null;
    if (
      workbook.origin !== "standalone" &&
      workbook.origin !== "source_artifact"
    ) {
      throw new QuestionsRepositoryDataError("workbook origin is invalid");
    }
    const row = await this.db
      .selectFrom("sourceArtifacts")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("workbookId", "=", input.workbookId)
      .where("id", "!=", input.sourceArtifactId)
      .where("collectedAt", "is", null)
      .executeTakeFirstOrThrow();
    return {
      id: workbookId(workbook.id),
      origin: workbook.origin,
      otherUncollectedSourceArtifacts: Number(row.count),
    };
  }

  async updateSourceArtifactForCollection(input: {
    artifact: SourceArtifact;
    retireBackingWorkbook: boolean;
  }): Promise<SourceArtifact | null> {
    const artifact = input.artifact;
    const row = await this.db
      .updateTable("sourceArtifacts")
      .set({
        collectedAt: artifact.collectedAt,
        status: artifact.status,
        updatedAt: artifact.updatedAt,
      })
      .where("id", "=", artifact.id)
      .where("deletedAt", "is not", null)
      .where("collectedAt", "is", null)
      .returningAll()
      .executeTakeFirst();
    if (!row) return null;

    if (input.retireBackingWorkbook && artifact.workbookId) {
      await this.db
        .updateTable("workbooks")
        .set({
          status: "deleted",
          updatedAt: artifact.updatedAt,
        })
        .where("id", "=", artifact.workbookId)
        .where("origin", "=", "source_artifact")
        .where("status", "!=", "deleted")
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom("sourceArtifacts")
                .select("id")
                .where("workbookId", "=", artifact.workbookId)
                .where("id", "!=", artifact.id)
                .where("collectedAt", "is", null),
            ),
          ),
        )
        .execute();
    }

    return mapSourceArtifactRow(row);
  }

  async setSourceDocumentCurrentRevision(input: {
    sourceDocumentId: SourceDocumentId;
    ownerUserId: UserId;
    kind: SourceKind;
    currentRevisionId: SourceRevisionId;
    updatedAt: Date;
  }): Promise<SourceDocument> {
    const row = await this.db
      .updateTable("sourceDocuments")
      .set({
        currentRevisionId: input.currentRevisionId,
        updatedAt: input.updatedAt,
      })
      .where("id", "=", input.sourceDocumentId)
      .where("ownerUserId", "=", input.ownerUserId)
      .where("kind", "=", input.kind)
      .returningAll()
      .executeTakeFirst();
    if (!row) {
      throw new SourceDocumentHeadUpdateFailedError();
    }
    return mapSourceDocumentRow(row);
  }

  async applyWorkbookValidationResultToSourceArtifacts(input: {
    artifactStatus: "valid" | "invalid";
    ownerUserId: UserId;
    updatedAt: Date;
    validationError: string | null;
    workbookId: WorkbookId;
  }): Promise<readonly SourceArtifact[]> {
    const rows = await this.db
      .updateTable("sourceArtifacts")
      .set({
        status: input.artifactStatus,
        updatedAt: input.updatedAt,
        validationError: input.validationError
          ? { message: input.validationError }
          : null,
      })
      .where("workbookId", "=", input.workbookId)
      .where("ownerUserId", "=", input.ownerUserId)
      .where("kind", "=", "workbook")
      .where("status", "=", "pending_validation")
      .returningAll()
      .execute();
    return rows.map(mapSourceArtifactRow);
  }

  private async countArtifactDraftBindings(id: SourceArtifactId) {
    const row = await this.db
      .selectFrom("questionBlueprintDraftSources")
      .innerJoin(
        "questionBlueprintDrafts",
        "questionBlueprintDrafts.id",
        "questionBlueprintDraftSources.draftId",
      )
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("questionBlueprintDraftSources.sourceArtifactId", "=", id)
      .where("questionBlueprintDrafts.status", "in", ["draft", "publishing"])
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  private async countArtifactActiveFileAliases(id: SourceArtifactId) {
    const row = await this.db
      .selectFrom("sourceArtifacts")
      .innerJoin(
        "sourceRevisions",
        "sourceRevisions.id",
        "sourceArtifacts.sourceRevisionId",
      )
      .innerJoin("files", "files.id", "sourceRevisions.fileId")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("sourceArtifacts.id", "=", id)
      .where("files.status", "=", "uploaded")
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  private async countArtifactActiveSourceDocuments(id: SourceArtifactId) {
    const row = await this.db
      .selectFrom("sourceArtifacts")
      .innerJoin(
        "sourceRevisions",
        "sourceRevisions.id",
        "sourceArtifacts.sourceRevisionId",
      )
      .innerJoin(
        "sourceDocuments",
        "sourceDocuments.id",
        "sourceRevisions.sourceDocumentId",
      )
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("sourceArtifacts.id", "=", id)
      .where("sourceDocuments.status", "!=", "deleted")
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  private async countArtifactGeneratedQuestions(id: SourceArtifactId) {
    const row = await this.db
      .selectFrom("questions")
      .innerJoin(
        "questionGenerationRuns",
        "questionGenerationRuns.id",
        "questions.generationRunId",
      )
      .innerJoin(
        "questionBlueprintVersionSources",
        "questionBlueprintVersionSources.blueprintVersionId",
        "questionGenerationRuns.blueprintVersionId",
      )
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("questionBlueprintVersionSources.sourceArtifactId", "=", id)
      .where("questions.status", "!=", "deleted")
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  private async countArtifactGeneratedQuestionSetMemberships(
    id: SourceArtifactId,
  ) {
    const row = await this.db
      .selectFrom("questionSets")
      .innerJoin(
        "questionSetQuestions",
        "questionSetQuestions.questionSetId",
        "questionSets.id",
      )
      .innerJoin("questions", "questions.id", "questionSetQuestions.questionId")
      .innerJoin(
        "questionGenerationRuns",
        "questionGenerationRuns.id",
        "questions.generationRunId",
      )
      .innerJoin(
        "questionBlueprintVersionSources",
        "questionBlueprintVersionSources.blueprintVersionId",
        "questionGenerationRuns.blueprintVersionId",
      )
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("questionBlueprintVersionSources.sourceArtifactId", "=", id)
      .where("questionSets.status", "!=", "deleted")
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  private async countArtifactGenerationRuns(id: SourceArtifactId) {
    const row = await this.db
      .selectFrom("questionGenerationRuns")
      .innerJoin(
        "questionBlueprintVersionSources",
        "questionBlueprintVersionSources.blueprintVersionId",
        "questionGenerationRuns.blueprintVersionId",
      )
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("questionBlueprintVersionSources.sourceArtifactId", "=", id)
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  private async countArtifactPublishedVersions(id: SourceArtifactId) {
    const row = await this.db
      .selectFrom("questionBlueprintVersionSources")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("sourceArtifactId", "=", id)
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  private async countArtifactWorkbookCalculations(id: SourceArtifactId) {
    const row = await this.db
      .selectFrom("sourceArtifacts")
      .innerJoin(
        "workbookCalculationSources",
        "workbookCalculationSources.workbookId",
        "sourceArtifacts.workbookId",
      )
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("sourceArtifacts.id", "=", id)
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  private async countArtifactWorkbookSnapshots(id: SourceArtifactId) {
    const row = await this.db
      .selectFrom("sourceArtifacts")
      .innerJoin(
        "workbookSnapshots",
        "workbookSnapshots.workbookId",
        "sourceArtifacts.workbookId",
      )
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("sourceArtifacts.id", "=", id)
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }
}

function mapSourceDocumentToInsert(
  document: SourceDocument,
): Insertable<SourceDocuments> {
  return {
    createdAt: document.createdAt,
    currentRevisionId: document.currentRevisionId,
    deletedAt: document.deletedAt,
    id: document.id,
    kind: document.kind,
    name: document.name,
    ownerUserId: document.ownerUserId,
    retentionExpiresAt: document.retentionExpiresAt,
    status: document.status,
    updatedAt: document.updatedAt,
  };
}

function mapSourceRevisionToInsert(
  revision: SourceRevision,
): Insertable<SourceRevisions> {
  return {
    byteSize: String(revision.byteSize),
    checksumSha256: revision.checksumSha256,
    contentType: revision.contentType,
    createdAt: revision.createdAt,
    createdByUserId: revision.createdByUserId,
    deletedAt: revision.deletedAt,
    editorMetadata: revision.editorMetadata,
    fileId: revision.fileId,
    id: revision.id,
    kind: revision.kind,
    ownerUserId: revision.ownerUserId,
    parentRevisionId: revision.parentRevisionId,
    retentionExpiresAt: revision.retentionExpiresAt,
    sourceDocumentId: revision.sourceDocumentId,
  };
}

function mapSourceArtifactToInsert(
  artifact: SourceArtifact,
): Insertable<SourceArtifacts> {
  return {
    artifactMetadata: artifact.artifactMetadata,
    collectedAt: artifact.collectedAt,
    createdAt: artifact.createdAt,
    deletedAt: artifact.deletedAt,
    id: artifact.id,
    kind: artifact.kind,
    ownerUserId: artifact.ownerUserId,
    processor: artifact.processor,
    processorVersion: artifact.processorVersion,
    retentionExpiresAt: artifact.retentionExpiresAt,
    sourceRevisionId: artifact.sourceRevisionId,
    status: artifact.status,
    updatedAt: artifact.updatedAt,
    validationError: artifact.validationError,
    workbookId: artifact.workbookId,
  };
}

function mapSourceDocumentRow(
  row: Selectable<SourceDocuments>,
): SourceDocument {
  return reconstituteSourceDocument(row);
}

function mapSourceRevisionRow(
  row: Selectable<SourceRevisions>,
): SourceRevision {
  return reconstituteSourceRevision({
    ...row,
    byteSize: Number(row.byteSize),
    editorMetadata: requireJsonObject(row.editorMetadata, "editorMetadata"),
  });
}

function mapSourceArtifactRow(
  row: Selectable<SourceArtifacts>,
): SourceArtifact {
  return reconstituteSourceArtifact({
    ...row,
    artifactMetadata: requireJsonObject(
      row.artifactMetadata,
      "artifactMetadata",
    ),
    validationError: nullableJsonObject(row.validationError, "validationError"),
  });
}

function requireJsonObject(value: unknown, field: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QuestionsRepositoryDataError(`${field} must be a json object`);
  }
  return value as JsonObject;
}

function nullableJsonObject(value: unknown, field: string): JsonObject | null {
  if (value === null) return null;
  return requireJsonObject(value, field);
}
