import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { sql } from "@lemma/db";
import type { CurrentUser } from "@lemma/identity/application";
import type { RawBuilder } from "kysely";
import {
  QuestionBlueprintDraftService,
  SourceArtifactValidationService,
} from "../application/index.js";
import {
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintDraftId,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintVisibility,
  userId,
  workbookId,
} from "../domain/index.js";
import {
  startTestDatabase,
  type TestDatabase,
} from "../testing/testcontainers-postgres.js";
import { KyselyQuestionsRepository } from "./KyselyQuestionsRepository.js";

const at = new Date("2026-06-27T00:00:00.000Z");
const ownerUserId = "019e9315-6a87-715f-9861-8654df081001";
const otherUserId = "019e9315-6a87-715f-9861-8654df081002";
const creatorUserId = ownerUserId;
const workbookFileId = "019e9315-6a87-715f-9861-8654df081101";
const secondWorkbookFileId = "019e9315-6a87-715f-9861-8654df081102";
const otherOwnerWorkbookFileId = "019e9315-6a87-715f-9861-8654df081103";
const sourceDocumentId = "019e9315-6a87-715f-9861-8654df081201";
const sourceRevisionId = "019e9315-6a87-715f-9861-8654df081202";
const otherOwnerSourceDocumentId = "019e9315-6a87-715f-9861-8654df081207";
const otherOwnerSourceRevisionId = "019e9315-6a87-715f-9861-8654df081208";
const sourceArtifactId = "019e9315-6a87-715f-9861-8654df081203";
const secondSourceArtifactId = "019e9315-6a87-715f-9861-8654df081204";
const otherOwnerArtifactId = "019e9315-6a87-715f-9861-8654df081205";
const preexistingValidArtifactId = "019e9315-6a87-715f-9861-8654df081206";
const workbookSourceWorkbookId = "019e9315-6a87-715f-9861-8654df081301";
const otherWorkbookId = "019e9315-6a87-715f-9861-8654df081302";
const otherOwnerWorkbookId = "019e9315-6a87-715f-9861-8654df081303";
const draftId = "019e9315-6a87-715f-9861-8654df081401";
const publishingDraftId = "019e9315-6a87-715f-9861-8654df081402";
const publishedDraftId = "019e9315-6a87-715f-9861-8654df081403";
const discardedDraftId = "019e9315-6a87-715f-9861-8654df081404";
const untouchedDraftId = "019e9315-6a87-715f-9861-8654df081405";
const blueprintIdValue = "019e9315-6a87-715f-9861-8654df081501";
const versionIdValue = "019e9315-6a87-715f-9861-8654df081502";
const editDraftIdValue = "019e9315-6a87-715f-9861-8654df081503";
const checksum =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const draftSourceMaterializationConstraint =
  "question_blueprint_draft_sources_materialization_completeness_c";
type QuestionsTestDatabase = TestDatabase["db"];
let testDatabase: TestDatabase | null = null;

describe("KyselyQuestion persistence integration", () => {
  before(async () => {
    testDatabase = await startTestDatabase();
  });

  after(async () => {
    if (testDatabase) {
      await testDatabase.stop();
    }
  });

  beforeEach(async () => {
    await testDatabase?.reset();
  });

  integrationDbIt(
    "enforces draft source materialization completeness by status",
    async (db) => {
      await insertUser(db, ownerUserId);
      await insertUser(db, otherUserId);
      await insertFile(db, workbookFileId, ownerUserId, "source.xlsx");
      await insertWorkbook(db, workbookSourceWorkbookId, workbookFileId);
      await insertSourceDocument(db, sourceDocumentId);
      await insertSourceRevision(db, sourceRevisionId, sourceDocumentId);
      await insertSourceArtifact(
        db,
        sourceArtifactId,
        sourceRevisionId,
        workbookSourceWorkbookId,
        "valid",
      );
      await insertDraftRow(db, draftId, "draft");

      await assertPostgresRejects({
        constraint: draftSourceMaterializationConstraint,
        run: () =>
          insertDraftSourceMaterializationRow(db, {
            originalName: "source.xlsx",
            sourceArtifactId: null,
            sourceId: "validated_missing_artifact",
            status: "validated",
          }),
      });

      await assertPostgresRejects({
        constraint: draftSourceMaterializationConstraint,
        run: () =>
          insertDraftSourceMaterializationRow(db, {
            originalName: null,
            sourceId: "uploaded_missing_metadata",
            status: "uploaded",
          }),
      });

      await assertPostgresRejects({
        constraint: draftSourceMaterializationConstraint,
        run: () =>
          insertDraftSourceMaterializationRow(db, {
            sourceId: "local_with_materialization",
            status: "local",
          }),
      });

      await insertDraftSourceMaterializationRow(db, {
        byteSize: null,
        checksumSha256: null,
        fileId: null,
        originalName: null,
        sourceArtifactId: null,
        sourceDocumentId: null,
        sourceId: "local_ok",
        sourceRevisionId: null,
        status: "local",
        workbookId: null,
      });
      await insertDraftSourceMaterializationRow(db, {
        sourceId: "uploaded_ok",
        status: "uploaded",
      });
      await insertDraftSourceMaterializationRow(db, {
        sourceId: "validated_ok",
        status: "validated",
      });
      await insertDraftSourceMaterializationRow(db, {
        sourceId: "invalid_ok",
        status: "invalid",
      });

      const rows = await db
        .selectFrom("questionBlueprintDraftSources")
        .select(["sourceId", "status"])
        .orderBy("sourceId")
        .execute();
      assert.deepEqual(rows, [
        { sourceId: "invalid_ok", status: "invalid" },
        { sourceId: "local_ok", status: "local" },
        { sourceId: "uploaded_ok", status: "uploaded" },
        { sourceId: "validated_ok", status: "validated" },
      ]);
    },
  );

  integrationDbIt(
    "enforces published version source metadata completeness",
    async (db) => {
      await insertUser(db, ownerUserId);
      await insertFile(db, workbookFileId, ownerUserId, "source.xlsx");
      await insertWorkbook(db, workbookSourceWorkbookId, workbookFileId);
      await insertSourceDocument(db, sourceDocumentId);
      await insertSourceRevision(db, sourceRevisionId, sourceDocumentId);
      await insertSourceArtifact(
        db,
        sourceArtifactId,
        sourceRevisionId,
        workbookSourceWorkbookId,
        "valid",
      );
      await insertBlueprintWithVersion(db, blueprintIdValue, versionIdValue);

      await assertPostgresRejects({
        code: "23502",
        column: "file_id",
        run: () =>
          insertVersionSourceMaterializationRow(db, {
            fileId: null,
            sourceId: "missing_file_id",
          }),
      });
      await assertPostgresRejects({
        code: "23502",
        column: "original_name",
        run: () =>
          insertVersionSourceMaterializationRow(db, {
            originalName: null,
            sourceId: "missing_original_name",
          }),
      });
      await assertPostgresRejects({
        code: "23502",
        column: "byte_size",
        run: () =>
          insertVersionSourceMaterializationRow(db, {
            byteSize: null,
            sourceId: "missing_byte_size",
          }),
      });
      await assertPostgresRejects({
        code: "23502",
        column: "checksum_sha256",
        run: () =>
          insertVersionSourceMaterializationRow(db, {
            checksumSha256: null,
            sourceId: "missing_checksum",
          }),
      });
      await assertPostgresRejects({
        code: "23502",
        column: "source_document_id",
        run: () =>
          insertVersionSourceMaterializationRow(db, {
            sourceDocumentId: null,
            sourceId: "missing_document_id",
          }),
      });
      await assertPostgresRejects({
        code: "23502",
        column: "source_revision_id",
        run: () =>
          insertVersionSourceMaterializationRow(db, {
            sourceId: "missing_revision_id",
            sourceRevisionId: null,
          }),
      });
      await assertPostgresRejects({
        code: "23502",
        column: "source_artifact_id",
        run: () =>
          insertVersionSourceMaterializationRow(db, {
            sourceArtifactId: null,
            sourceId: "missing_artifact_id",
          }),
      });
      await assertPostgresRejects({
        code: "23502",
        column: "workbook_id",
        run: () =>
          insertVersionSourceMaterializationRow(db, {
            sourceId: "missing_workbook_id",
            workbookId: null,
          }),
      });

      await insertVersionSourceMaterializationRow(db, {
        sourceId: "sourceD",
      });

      const row = await db
        .selectFrom("questionBlueprintVersionSources")
        .select([
          "fileId",
          "originalName",
          "byteSize",
          "checksumSha256",
          "sourceDocumentId",
          "sourceRevisionId",
          "sourceArtifactId",
          "workbookId",
        ])
        .where("blueprintVersionId", "=", versionIdValue)
        .where("sourceId", "=", "sourceD")
        .executeTakeFirstOrThrow();
      assert.equal(row.fileId, workbookFileId);
      assert.equal(row.originalName, "source.xlsx");
      assert.equal(Number(row.byteSize), 1234);
      assert.equal(row.checksumSha256, checksum);
      assert.equal(row.sourceDocumentId, sourceDocumentId);
      assert.equal(row.sourceRevisionId, sourceRevisionId);
      assert.equal(row.sourceArtifactId, sourceArtifactId);
      assert.equal(row.workbookId, workbookSourceWorkbookId);
    },
  );

  integrationDbIt(
    "finalizes only matching pending artifacts and updates only eligible active draft sources",
    async (db) => {
      await seedFinalizationFixture(db);
      const service = createValidationService(db);
      const beforeVersionRow = await db
        .selectFrom("questionBlueprintVersionSources")
        .selectAll()
        .executeTakeFirstOrThrow();

      const result = await service.applyWorkbookValidationResult({
        occurredAt: at,
        ownerUserId: userId(ownerUserId),
        status: "valid",
        validationError: null,
        workbookId: workbookId(workbookSourceWorkbookId),
      });

      assert.deepEqual(result, {
        finalizedArtifactCount: 1,
        updatedDraftSourceCount: 2,
      });

      const artifacts = await db
        .selectFrom("sourceArtifacts")
        .select(["id", "status"])
        .execute();
      const artifactStatuses = new Map(
        artifacts.map((artifact) => [artifact.id, artifact.status]),
      );
      assert.equal(artifactStatuses.get(sourceArtifactId), "valid");
      assert.equal(
        artifactStatuses.get(secondSourceArtifactId),
        "pending_validation",
      );
      assert.equal(
        artifactStatuses.get(otherOwnerArtifactId),
        "pending_validation",
      );
      assert.equal(artifactStatuses.get(preexistingValidArtifactId), "valid");

      const draftSources = await db
        .selectFrom("questionBlueprintDraftSources")
        .select(["draftId", "status"])
        .where("sourceId", "=", "sourceA")
        .execute();
      const draftSourceStatuses = new Map(
        draftSources.map((row) => [row.draftId, row.status]),
      );
      assert.equal(draftSourceStatuses.get(draftId), "validated");
      assert.equal(draftSourceStatuses.get(publishingDraftId), "validated");
      assert.equal(draftSourceStatuses.get(publishedDraftId), "uploaded");
      assert.equal(draftSourceStatuses.get(discardedDraftId), "uploaded");
      assert.equal(draftSourceStatuses.get(untouchedDraftId), "uploaded");

      const afterVersionRow = await db
        .selectFrom("questionBlueprintVersionSources")
        .selectAll()
        .executeTakeFirstOrThrow();
      assert.deepEqual(afterVersionRow, beforeVersionRow);

      const replay = await service.applyWorkbookValidationResult({
        occurredAt: new Date("2026-06-27T01:00:00.000Z"),
        ownerUserId: userId(ownerUserId),
        status: "valid",
        validationError: null,
        workbookId: workbookId(workbookSourceWorkbookId),
      });
      assert.deepEqual(replay, {
        finalizedArtifactCount: 0,
        updatedDraftSourceCount: 0,
      });
    },
  );

  integrationDbIt(
    "stores invalid validation errors as json objects and is idempotent on replay",
    async (db) => {
      await insertUser(db, ownerUserId);
      await insertFile(db, workbookFileId, ownerUserId, "source.xlsx");
      await insertWorkbook(db, workbookSourceWorkbookId, workbookFileId);
      await insertSourceDocument(db, sourceDocumentId);
      await insertSourceRevision(db, sourceRevisionId, sourceDocumentId);
      await insertSourceArtifact(
        db,
        sourceArtifactId,
        sourceRevisionId,
        workbookSourceWorkbookId,
        "pending_validation",
      );
      await insertDraftRow(db, draftId, "draft");
      await insertDraftSourceRow(db, {
        artifactId: sourceArtifactId,
        draftId,
        sourceId: "sourceA",
        status: "uploaded",
        workbookId: workbookSourceWorkbookId,
      });

      const service = createValidationService(db);

      const first = await service.applyWorkbookValidationResult({
        occurredAt: at,
        ownerUserId: userId(ownerUserId),
        status: "invalid",
        validationError: "bad workbook",
        workbookId: workbookId(workbookSourceWorkbookId),
      });
      assert.deepEqual(first, {
        finalizedArtifactCount: 1,
        updatedDraftSourceCount: 1,
      });

      const artifact = await db
        .selectFrom("sourceArtifacts")
        .select(["status", "validationError"])
        .where("id", "=", sourceArtifactId)
        .executeTakeFirstOrThrow();
      assert.equal(artifact.status, "invalid");
      assert.deepEqual(artifact.validationError, { message: "bad workbook" });
      const draftSource = await db
        .selectFrom("questionBlueprintDraftSources")
        .select(["status"])
        .where("draftId", "=", draftId)
        .where("sourceId", "=", "sourceA")
        .executeTakeFirstOrThrow();
      assert.equal(draftSource.status, "invalid");

      const second = await service.applyWorkbookValidationResult({
        occurredAt: new Date("2026-06-27T01:00:00.000Z"),
        ownerUserId: userId(ownerUserId),
        status: "invalid",
        validationError: "bad workbook",
        workbookId: workbookId(workbookSourceWorkbookId),
      });
      assert.deepEqual(second, {
        finalizedArtifactCount: 0,
        updatedDraftSourceCount: 0,
      });
      const artifactAfterReplay = await db
        .selectFrom("sourceArtifacts")
        .select(["status", "validationError"])
        .where("id", "=", sourceArtifactId)
        .executeTakeFirstOrThrow();
      assert.equal(artifactAfterReplay.status, "invalid");
      assert.deepEqual(artifactAfterReplay.validationError, {
        message: "bad workbook",
      });
    },
  );

  integrationDbIt(
    "persists edit drafts created from published workbook sources with complete materialization",
    async (db) => {
      await insertUser(db, ownerUserId);
      await insertFile(db, workbookFileId, ownerUserId, "published.xlsx");
      await insertWorkbook(db, workbookSourceWorkbookId, workbookFileId);
      await insertSourceDocument(db, sourceDocumentId);
      await insertSourceRevision(db, sourceRevisionId, sourceDocumentId);
      await insertSourceArtifact(
        db,
        sourceArtifactId,
        sourceRevisionId,
        workbookSourceWorkbookId,
        "valid",
      );
      await insertBlueprintWithVersion(db, blueprintIdValue, versionIdValue);
      await insertVersionSourceRow(db, "sourceA");

      const service = new QuestionBlueprintDraftService({
        clock: { now: () => at },
        draftSourceFilePort: {
          getFileMetadata: async () => {
            throw new Error("unused in edit draft creation");
          },
        },
        idGenerator: {
          eventId: () => {
            throw new Error("unused in edit draft creation");
          },
          questionBlueprintDraftId: () =>
            questionBlueprintDraftId(editDraftIdValue),
          questionBlueprintId: () => {
            throw new Error("unused in edit draft creation");
          },
          questionBlueprintVersionId: () => {
            throw new Error("unused in edit draft creation");
          },
          questionGenerationRunId: () => {
            throw new Error("unused in edit draft creation");
          },
          questionId: () => {
            throw new Error("unused in edit draft creation");
          },
          questionSetId: () => {
            throw new Error("unused in edit draft creation");
          },
          sourceArtifactId: () => {
            throw new Error("unused in edit draft creation");
          },
          sourceDocumentId: () => {
            throw new Error("unused in edit draft creation");
          },
          sourceRevisionId: () => {
            throw new Error("unused in edit draft creation");
          },
        },
        questionBlueprintDraftTransaction: {
          transaction: async () => {
            throw new Error("unused in edit draft creation");
          },
        },
        questionsRepository: new KyselyQuestionsRepository(db),
      });

      const result = await service.createQuestionBlueprintEditDraft({
        blueprintId: questionBlueprintId(blueprintIdValue),
        currentUser: currentUser(),
      });

      assert.equal(result.draft.id, editDraftIdValue);
      const row = await db
        .selectFrom("questionBlueprintDraftSources")
        .selectAll()
        .where("draftId", "=", editDraftIdValue)
        .where("sourceId", "=", "sourceA")
        .executeTakeFirstOrThrow();
      assert.equal(row.status, "validated");
      assert.equal(row.fileId, workbookFileId);
      assert.equal(row.sourceDocumentId, sourceDocumentId);
      assert.equal(row.sourceRevisionId, sourceRevisionId);
      assert.equal(row.sourceArtifactId, sourceArtifactId);
      assert.equal(row.workbookId, workbookSourceWorkbookId);
      assert.equal(row.originalName, "published.xlsx");
      assert.equal(Number(row.byteSize), 1234);
      assert.equal(row.checksumSha256, checksum);
    },
  );
});

function integrationDbIt(
  name: string,
  fn: (db: QuestionsTestDatabase) => Promise<void>,
): void {
  it(name, async () => {
    if (!testDatabase) {
      throw new Error("Test database did not start.");
    }
    await fn(testDatabase.db);
  });
}

function createValidationService(db: QuestionsTestDatabase) {
  return new SourceArtifactValidationService({
    questionsTransaction: {
      transaction: (fn) =>
        db.transaction().execute((tx) =>
          fn({
            questionsRepository: new KyselyQuestionsRepository(tx),
          }),
        ),
    },
  });
}

async function assertPostgresRejects(input: {
  run(): Promise<unknown>;
  constraint?: string;
  column?: string;
  code?: string;
}): Promise<void> {
  await assert.rejects(input.run, (error: unknown) => {
    if (!isPostgresError(error)) {
      return false;
    }
    if (input.code && error.code !== input.code) {
      return false;
    }
    if (input.column && error.column !== input.column) {
      return false;
    }
    if (input.constraint && error.constraint !== input.constraint) {
      return false;
    }
    return true;
  });
}

async function seedFinalizationFixture(
  db: QuestionsTestDatabase,
): Promise<void> {
  await insertUser(db, ownerUserId);
  await insertUser(db, otherUserId);
  await insertFile(db, workbookFileId, ownerUserId, "source.xlsx");
  await insertFile(db, secondWorkbookFileId, ownerUserId, "other.xlsx");
  await insertFile(
    db,
    otherOwnerWorkbookFileId,
    otherUserId,
    "other-owner.xlsx",
  );
  await insertWorkbook(db, workbookSourceWorkbookId, workbookFileId);
  await insertWorkbook(db, otherWorkbookId, secondWorkbookFileId);
  await insertWorkbook(db, otherOwnerWorkbookId, otherOwnerWorkbookFileId, {
    ownerUserId: otherUserId,
    originalName: "other-owner.xlsx",
  });
  await insertSourceDocument(db, sourceDocumentId);
  await insertSourceRevision(db, sourceRevisionId, sourceDocumentId);
  await insertSourceDocument(db, otherOwnerSourceDocumentId, otherUserId);
  await insertSourceRevision(
    db,
    otherOwnerSourceRevisionId,
    otherOwnerSourceDocumentId,
    otherUserId,
  );
  await insertSourceArtifact(
    db,
    sourceArtifactId,
    sourceRevisionId,
    workbookSourceWorkbookId,
    "pending_validation",
  );
  await insertSourceArtifact(
    db,
    secondSourceArtifactId,
    sourceRevisionId,
    otherWorkbookId,
    "pending_validation",
  );
  await insertSourceArtifact(
    db,
    otherOwnerArtifactId,
    otherOwnerSourceRevisionId,
    otherOwnerWorkbookId,
    "pending_validation",
    otherUserId,
  );
  await insertSourceArtifact(
    db,
    preexistingValidArtifactId,
    sourceRevisionId,
    workbookSourceWorkbookId,
    "valid",
  );
  await insertBlueprintWithVersion(db, blueprintIdValue, versionIdValue);
  await insertDraftRow(db, draftId, "draft");
  await insertDraftRow(db, publishingDraftId, "publishing");
  await insertDraftRow(db, publishedDraftId, "published");
  await insertDraftRow(db, discardedDraftId, "discarded");
  await insertDraftRow(db, untouchedDraftId, "draft");
  await insertDraftSourceRow(db, {
    artifactId: sourceArtifactId,
    draftId,
    sourceId: "sourceA",
    status: "uploaded",
    workbookId: workbookSourceWorkbookId,
  });
  await insertDraftSourceRow(db, {
    artifactId: sourceArtifactId,
    draftId: publishingDraftId,
    sourceId: "sourceA",
    status: "uploaded",
    workbookId: workbookSourceWorkbookId,
  });
  await insertDraftSourceRow(db, {
    artifactId: sourceArtifactId,
    draftId: publishedDraftId,
    sourceId: "sourceA",
    status: "uploaded",
    workbookId: workbookSourceWorkbookId,
  });
  await insertDraftSourceRow(db, {
    artifactId: sourceArtifactId,
    draftId: discardedDraftId,
    sourceId: "sourceA",
    status: "uploaded",
    workbookId: workbookSourceWorkbookId,
  });
  await insertDraftSourceRow(db, {
    artifactId: secondSourceArtifactId,
    draftId: untouchedDraftId,
    sourceId: "sourceA",
    status: "uploaded",
    workbookId: otherWorkbookId,
  });
  await insertVersionSourceRow(db, "sourceA");
}

async function insertUser(
  db: QuestionsTestDatabase,
  id: string,
): Promise<void> {
  await db
    .insertInto("users")
    .values({
      displayName: `User ${id.slice(-4)}`,
      email: `${id}@example.com`,
      id,
      identityId: `identity-${id}`,
      status: "active",
    })
    .execute();
}

async function insertFile(
  db: QuestionsTestDatabase,
  id: string,
  ownerId: string,
  originalName: string,
): Promise<void> {
  await db
    .insertInto("files")
    .values({
      bucket: "bucket",
      byteSize: 1234,
      checksumSha256: checksum,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      createdByUserId: ownerId,
      id,
      metadata: {},
      objectKey: `${id}.xlsx`,
      originalName,
      ownerUserId: ownerId,
      purpose: "workbook",
      status: "uploaded",
    })
    .execute();
}

async function insertWorkbook(
  db: QuestionsTestDatabase,
  id: string,
  fileIdValue: string,
  input?: Partial<{
    ownerUserId: string;
    originalName: string;
  }>,
): Promise<void> {
  await db
    .insertInto("workbooks")
    .values({
      checksumSha256: checksum,
      createdByUserId: creatorUserId,
      engine: "libreoffice",
      fileId: fileIdValue,
      id,
      name: "Workbook A",
      originalName: input?.originalName ?? "source.xlsx",
      ownerUserId: input?.ownerUserId ?? ownerUserId,
      status: "valid",
    })
    .execute();
}

async function insertSourceDocument(
  db: QuestionsTestDatabase,
  id: string,
  ownerId = ownerUserId,
): Promise<void> {
  await db
    .insertInto("sourceDocuments")
    .values({
      id,
      kind: "workbook",
      name: "Source A",
      ownerUserId: ownerId,
      status: "active",
    })
    .execute();
}

async function insertSourceRevision(
  db: QuestionsTestDatabase,
  id: string,
  documentId: string,
  ownerId = ownerUserId,
): Promise<void> {
  await db
    .insertInto("sourceRevisions")
    .values({
      byteSize: 1234,
      checksumSha256: checksum,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      createdByUserId: ownerId,
      editorMetadata: {},
      fileId: workbookFileId,
      id,
      kind: "workbook",
      ownerUserId: ownerId,
      sourceDocumentId: documentId,
    })
    .execute();
}

async function insertSourceArtifact(
  db: QuestionsTestDatabase,
  id: string,
  revisionId: string,
  workbookValue: string,
  status: "pending_validation" | "valid" | "invalid",
  ownerId = ownerUserId,
): Promise<void> {
  await db
    .insertInto("sourceArtifacts")
    .values({
      artifactMetadata: {},
      id,
      kind: "workbook",
      ownerUserId: ownerId,
      processor: "lemma-workbook",
      processorVersion: "1",
      sourceRevisionId: revisionId,
      status,
      validationError: null,
      workbookId: workbookValue,
    })
    .execute();
}

async function insertDraftRow(
  db: QuestionsTestDatabase,
  id: string,
  status: "draft" | "publishing" | "published" | "discarded",
): Promise<void> {
  await db
    .insertInto("questionBlueprintDrafts")
    .values({
      baseVersionId: status === "published" ? versionIdValue : null,
      blueprintId: status === "published" ? blueprintIdValue : null,
      createdByUserId: creatorUserId,
      description: null,
      discardedAt: status === "discarded" ? at : null,
      document: emptyDocument(),
      id,
      lastSavedAt: at,
      name: "Draft",
      ownerUserId,
      publishedAt: status === "published" ? at : null,
      publishedVersionId: status === "published" ? versionIdValue : null,
      publishIdempotencyKey: status === "published" ? "published-key" : null,
      revision: 1,
      status,
    })
    .execute();
}

async function insertDraftSourceRow(
  db: QuestionsTestDatabase,
  input: {
    draftId: string;
    sourceId: string;
    status: "uploaded" | "validated" | "invalid";
    artifactId: string;
    workbookId: string;
  },
): Promise<void> {
  await db
    .insertInto("questionBlueprintDraftSources")
    .values({
      byteSize: 1234,
      checksumSha256: checksum,
      draftId: input.draftId,
      fileId: workbookFileId,
      name: "Source A",
      originalName: "source.xlsx",
      sourceArtifactId: input.artifactId,
      sourceDocumentId,
      sourceId: input.sourceId,
      sourceRevisionId,
      status: input.status,
      type: "workbook",
      workbookId: input.workbookId,
    })
    .execute();
}

async function insertDraftSourceMaterializationRow(
  db: QuestionsTestDatabase,
  input: Partial<{
    byteSize: number | null;
    checksumSha256: string | null;
    fileId: string | null;
    originalName: string | null;
    sourceArtifactId: string | null;
    sourceDocumentId: string | null;
    sourceId: string;
    sourceRevisionId: string | null;
    status: "local" | "uploaded" | "validated" | "invalid";
    workbookId: string | null;
  }>,
): Promise<void> {
  await db
    .insertInto("questionBlueprintDraftSources")
    .values({
      byteSize: nullableValue(input.byteSize, 1234),
      checksumSha256: nullableValue(input.checksumSha256, checksum),
      draftId,
      fileId: nullableValue(input.fileId, workbookFileId),
      name: "Source A",
      originalName: nullableValue(input.originalName, "source.xlsx"),
      sourceArtifactId: nullableValue(input.sourceArtifactId, sourceArtifactId),
      sourceDocumentId: nullableValue(input.sourceDocumentId, sourceDocumentId),
      sourceId: input.sourceId ?? "sourceA",
      sourceRevisionId: nullableValue(input.sourceRevisionId, sourceRevisionId),
      status: input.status ?? "validated",
      type: "workbook",
      workbookId: nullableValue(input.workbookId, workbookSourceWorkbookId),
    })
    .execute();
}

async function insertBlueprintWithVersion(
  db: QuestionsTestDatabase,
  blueprintValue: string,
  versionValue: string,
): Promise<void> {
  await db.transaction().execute(async (tx) => {
    await tx
      .insertInto("questionBlueprints")
      .values({
        archivedAt: null,
        createdByUserId: creatorUserId,
        currentVersionId: versionValue,
        description: questionBlueprintDescription(null),
        document: emptyDocument(),
        id: blueprintValue,
        name: questionBlueprintName("Blueprint"),
        ownerUserId,
        status: "active",
        visibility: questionBlueprintVisibility("private"),
      })
      .execute();
    await tx
      .insertInto("questionBlueprintVersions")
      .values({
        blueprintId: blueprintValue,
        createdByUserId: creatorUserId,
        description: null,
        document: emptyDocument(),
        id: versionValue,
        name: "Blueprint",
        ownerUserId,
        parentVersionId: null,
        publishedAt: at,
        versionNumber: 1,
      })
      .execute();
  });
}

async function insertVersionSourceRow(
  db: QuestionsTestDatabase,
  sourceIdValue: string,
): Promise<void> {
  await insertVersionSourceMaterializationRow(db, {
    originalName: "published.xlsx",
    sourceId: sourceIdValue,
  });
}

async function insertVersionSourceMaterializationRow(
  db: QuestionsTestDatabase,
  input: Partial<{
    byteSize: number | null;
    checksumSha256: string | null;
    fileId: string | null;
    originalName: string | null;
    sourceArtifactId: string | null;
    sourceDocumentId: string | null;
    sourceId: string;
    sourceRevisionId: string | null;
    workbookId: string | null;
  }>,
): Promise<void> {
  await db
    .insertInto("questionBlueprintVersionSources")
    .values({
      blueprintVersionId: versionIdValue,
      byteSize: nullableValue(input.byteSize, 1234),
      checksumSha256: nullableValue(input.checksumSha256, checksum),
      fileId: nullableValue(input.fileId, workbookFileId),
      name: "Source A",
      originalName: nullableValue(input.originalName, "source.xlsx"),
      sourceArtifactId: nullableValue(input.sourceArtifactId, sourceArtifactId),
      sourceDocumentId: nullableValue(input.sourceDocumentId, sourceDocumentId),
      sourceId: input.sourceId ?? "sourceA",
      sourceRevisionId: nullableValue(input.sourceRevisionId, sourceRevisionId),
      type: "workbook",
      workbookId: nullableValue(input.workbookId, workbookSourceWorkbookId),
    })
    .execute();
}

function nullableValue<T>(
  value: T | null | undefined,
  fallback: T,
): T | RawBuilder<T> {
  if (value === undefined) {
    return fallback;
  }
  if (value === null) {
    return sql<T>`null`;
  }
  return value;
}

type PostgresError = {
  code?: string;
  column?: string;
  constraint?: string;
};

function isPostgresError(error: unknown): error is PostgresError {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const record = error as Record<string, unknown>;
  return (
    ("code" in record ? typeof record.code === "string" : true) &&
    ("column" in record
      ? record.column === undefined ||
        record.column === null ||
        typeof record.column === "string"
      : true) &&
    ("constraint" in record
      ? record.constraint === undefined ||
        record.constraint === null ||
        typeof record.constraint === "string"
      : true)
  );
}

function currentUser(): CurrentUser {
  return {
    isAdmin: false,
    roles: [],
    user: { id: userId(ownerUserId) },
  } as unknown as CurrentUser;
}

function emptyDocument() {
  return questionBlueprintDocument({
    blocks: [],
    references: [],
    responseFields: [],
    schemaVersion: 1,
  });
}
