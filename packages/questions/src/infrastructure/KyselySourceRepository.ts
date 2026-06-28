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
    editorMetadata: revision.editorMetadata,
    fileId: revision.fileId,
    id: revision.id,
    kind: revision.kind,
    ownerUserId: revision.ownerUserId,
    parentRevisionId: revision.parentRevisionId,
    sourceDocumentId: revision.sourceDocumentId,
  };
}

function mapSourceArtifactToInsert(
  artifact: SourceArtifact,
): Insertable<SourceArtifacts> {
  return {
    artifactMetadata: artifact.artifactMetadata,
    createdAt: artifact.createdAt,
    id: artifact.id,
    kind: artifact.kind,
    ownerUserId: artifact.ownerUserId,
    processor: artifact.processor,
    processorVersion: artifact.processorVersion,
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
