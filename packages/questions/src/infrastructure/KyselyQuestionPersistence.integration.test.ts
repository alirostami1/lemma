import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { sql } from "@lemma/db";
import { startTestDatabase, type TestDatabase } from "@lemma/db/testing";
import { rootOperationLineage } from "@lemma/domain";
import {
  FileLifecycleService,
  type FileStorage,
} from "@lemma/files/application";
import { fileId as toFileFileId } from "@lemma/files/domain";
import { KyselyFilesRepository } from "@lemma/files/infrastructure";
import type { CurrentUser } from "@lemma/identity/application";
import type { RawBuilder } from "kysely";
import {
  QuestionBlueprintDraftService,
  SourceArtifactValidationService,
  SourceDocumentRevisionConflictError,
  SourceGarbageCollectionService,
  WORKBOOK_EDITOR_OUTPUT_FILE_METADATA_TYPE,
  WORKBOOK_EDITOR_OUTPUT_FILE_METADATA_VERSION,
} from "../application/index.js";
import {
  type QuestionBlueprintDocument,
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintDraftId,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintVersionId,
  questionBlueprintVisibility,
  sourceArtifactId as toSourceArtifactId,
  sourceRevisionId as toSourceRevisionId,
  userId,
  workbookId,
} from "../domain/index.js";
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
const editorSourceRevisionId = "019e9315-6a87-715f-9861-8654df081209";
const concurrentSourceRevisionId = "019e9315-6a87-715f-9861-8654df081210";
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
const editorVersionIdValue = "019e9315-6a87-715f-9861-8654df081504";
const sharedBlueprintIdValue = "019e9315-6a87-715f-9861-8654df081505";
const sharedVersionIdValue = "019e9315-6a87-715f-9861-8654df081506";
const checksum =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const draftSourceMaterializationConstraint =
  "question_blueprint_draft_sources_materialization_completeness_c";
type QuestionsTestDatabase = TestDatabase["db"];
let testDatabase: TestDatabase | null = null;

describe("KyselyQuestion persistence integration", () => {
  before(async () => {
    testDatabase = await startTestDatabase({
      context: "Question persistence integration tests",
    });
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
    "keeps a tombstoned shared source artifact protected by published versions",
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
      await insertVersionSourceRow(db, "sourceA");
      const repository = new KyselyQuestionsRepository(db);

      const before = await repository.countProtectedSourceArtifactReferences(
        toSourceArtifactId(sourceArtifactId),
      );
      assert.equal(before.publishedBlueprintVersionSources, 1);

      await db
        .updateTable("sourceDocuments")
        .set({
          deletedAt: at,
          retentionExpiresAt: new Date("2026-09-25T00:00:00.000Z"),
          status: "deleted",
        })
        .where("id", "=", sourceDocumentId)
        .execute();
      await db
        .updateTable("sourceArtifacts")
        .set({
          deletedAt: at,
          retentionExpiresAt: new Date("2026-09-25T00:00:00.000Z"),
        })
        .where("id", "=", sourceArtifactId)
        .execute();

      const after = await repository.countProtectedSourceArtifactReferences(
        toSourceArtifactId(sourceArtifactId),
      );
      assert.equal(after.activeSourceDocuments, 0);
      assert.equal(after.publishedBlueprintVersionSources, 1);
    },
  );

  integrationDbIt(
    "keeps a shared source artifact protected until every published version root is gone",
    async (db) => {
      const secondBlueprintId = "019e9315-6a87-715f-9861-8654df081901";
      const secondVersionId = "019e9315-6a87-715f-9861-8654df081902";
      await insertUser(db, ownerUserId);
      await insertFile(db, workbookFileId, ownerUserId, "source.xlsx");
      await insertWorkbook(db, workbookSourceWorkbookId, workbookFileId, {
        origin: "source_artifact",
      });
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
      await insertBlueprintWithVersion(db, secondBlueprintId, secondVersionId, {
        name: "Blueprint Two",
      });
      await insertVersionSourceRow(db, "sourceA", {
        blueprintVersionId: versionIdValue,
      });
      await insertVersionSourceRow(db, "sourceA", {
        blueprintVersionId: secondVersionId,
      });
      await tombstoneSourceGraph(db);
      const repository = new KyselyQuestionsRepository(db);

      const bothRoots = await repository.countProtectedSourceArtifactReferences(
        toSourceArtifactId(sourceArtifactId),
      );
      assert.equal(bothRoots.publishedBlueprintVersionSources, 2);

      await db
        .deleteFrom("questionBlueprintVersionSources")
        .where("blueprintVersionId", "=", versionIdValue)
        .execute();
      const oneRoot = await repository.countProtectedSourceArtifactReferences(
        toSourceArtifactId(sourceArtifactId),
      );
      assert.equal(oneRoot.publishedBlueprintVersionSources, 1);

      await db
        .deleteFrom("questionBlueprintVersionSources")
        .where("blueprintVersionId", "=", secondVersionId)
        .execute();
      const noRoots = await repository.countProtectedSourceArtifactReferences(
        toSourceArtifactId(sourceArtifactId),
      );
      assert.equal(noRoots.publishedBlueprintVersionSources, 0);
    },
  );

  integrationDbIt(
    "counts active generated question-set memberships conservatively after question deletion",
    async (db) => {
      const runId = "019e9315-6a87-715f-9861-8654df081910";
      const setId = "019e9315-6a87-715f-9861-8654df081911";
      const questionId = "019e9315-6a87-715f-9861-8654df081912";
      await insertUser(db, ownerUserId);
      await insertFile(db, workbookFileId, ownerUserId, "source.xlsx");
      await insertWorkbook(db, workbookSourceWorkbookId, workbookFileId, {
        origin: "source_artifact",
      });
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
      await db
        .insertInto("questionSets")
        .values({
          createdByUserId: ownerUserId,
          id: setId,
          name: "Generated set",
          ownerUserId,
          status: "active",
        })
        .execute();
      await db
        .insertInto("questionGenerationRuns")
        .values({
          blueprintId: blueprintIdValue,
          blueprintSnapshot: {
            blueprintId: blueprintIdValue,
            blueprintVersionId: versionIdValue,
            capturedAt: at.toISOString(),
            description: null,
            document: emptyDocument(),
            documentHash: "hash",
            name: "Blueprint",
            schemaVersion: 1,
            sources: [],
          },
          blueprintVersionId: versionIdValue,
          createdByUserId: ownerUserId,
          id: runId,
          ownerUserId,
          requestedCount: 1,
          status: "succeeded",
          targetQuestionSetId: setId,
        })
        .execute();
      await db
        .insertInto("questions")
        .values({
          blueprintId: blueprintIdValue,
          body: emptyDocument(),
          createdByUserId: ownerUserId,
          generationRunId: runId,
          id: questionId,
          ownerUserId,
          producer: { schemaVersion: 1 },
          solution: { schemaVersion: 1 },
          sourceEvidence: { schemaVersion: 1, sources: [] },
          sourcePlan: { schemaVersion: 1 },
          status: "deleted",
        })
        .execute();
      await db
        .insertInto("questionSetQuestions")
        .values({
          addedByUserId: ownerUserId,
          position: 0,
          questionId,
          questionSetId: setId,
        })
        .execute();

      const counts = await new KyselyQuestionsRepository(
        db,
      ).countProtectedSourceArtifactReferences(
        toSourceArtifactId(sourceArtifactId),
      );

      assert.equal(counts.generatedQuestions, 0);
      assert.equal(
        counts.generatedQuestionSetMembershipsConservativelyRetained,
        1,
      );
    },
  );

  integrationDbIt(
    "source artifact collection retires only source-owned backing workbooks",
    async (db) => {
      await insertUser(db, ownerUserId);
      await insertFile(db, workbookFileId, ownerUserId, "source.xlsx");
      await markFileDeleting(db, workbookFileId);
      await insertWorkbook(db, workbookSourceWorkbookId, workbookFileId, {
        origin: "source_artifact",
      });
      await insertSourceDocument(db, sourceDocumentId);
      await insertSourceRevision(db, sourceRevisionId, sourceDocumentId);
      await insertSourceArtifact(
        db,
        sourceArtifactId,
        sourceRevisionId,
        workbookSourceWorkbookId,
        "valid",
      );
      await tombstoneSourceGraph(db);

      assert.deepEqual(
        await createSourceGarbageCollectionService(db).collectSourceArtifact({
          sourceArtifactId,
        }),
        { status: "collected" },
      );

      const sourceOwnedWorkbook = await db
        .selectFrom("workbooks")
        .select(["origin", "status"])
        .where("id", "=", workbookSourceWorkbookId)
        .executeTakeFirstOrThrow();
      assert.deepEqual(sourceOwnedWorkbook, {
        origin: "source_artifact",
        status: "deleted",
      });

      await testDatabase?.reset();
      await insertUser(db, ownerUserId);
      await insertFile(db, workbookFileId, ownerUserId, "source.xlsx");
      await markFileDeleting(db, workbookFileId);
      await insertWorkbook(db, workbookSourceWorkbookId, workbookFileId, {
        origin: "standalone",
      });
      await insertSourceDocument(db, sourceDocumentId);
      await insertSourceRevision(db, sourceRevisionId, sourceDocumentId);
      await insertSourceArtifact(
        db,
        sourceArtifactId,
        sourceRevisionId,
        workbookSourceWorkbookId,
        "valid",
      );
      await tombstoneSourceGraph(db);

      assert.deepEqual(
        await createSourceGarbageCollectionService(db).collectSourceArtifact({
          sourceArtifactId,
        }),
        { status: "collected" },
      );
      const standaloneWorkbook = await db
        .selectFrom("workbooks")
        .select(["origin", "status"])
        .where("id", "=", workbookSourceWorkbookId)
        .executeTakeFirstOrThrow();
      assert.deepEqual(standaloneWorkbook, {
        origin: "standalone",
        status: "valid",
      });
    },
  );

  integrationDbIt(
    "file content becomes collectible after source artifact collection retires its source-owned workbook",
    async (db) => {
      const storage = new FakeFileStorage();
      await insertUser(db, ownerUserId);
      await insertFile(db, workbookFileId, ownerUserId, "source.xlsx");
      await db
        .updateTable("files")
        .set({
          deletedAt: new Date("2026-05-01T00:00:00.000Z"),
          retentionExpiresAt: new Date("2026-05-31T00:00:00.000Z"),
          status: "deleting",
        })
        .where("id", "=", workbookFileId)
        .execute();
      await insertWorkbook(db, workbookSourceWorkbookId, workbookFileId, {
        origin: "source_artifact",
      });
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
      await tombstoneSourceGraph(db);
      const sourceGc = createSourceGarbageCollectionService(db);
      const fileGc = createFileLifecycleService(db, storage);

      assert.equal(
        (
          await sourceGc.collectSourceArtifact({
            sourceArtifactId,
          })
        ).status,
        "skipped",
      );

      await db.deleteFrom("questionBlueprintVersionSources").execute();
      assert.deepEqual(
        await sourceGc.collectSourceArtifact({ sourceArtifactId }),
        { status: "collected" },
      );

      assert.deepEqual(
        await fileGc.collectDeletedFileContent({
          claimToken: "worker-1:019e9315-6a87-715f-9861-8654df081903",
          fileId: toFileFileId(workbookFileId),
        }),
        { status: "collected" },
      );
      assert.deepEqual(storage.deletedObjects, [
        { bucket: "bucket", key: `${workbookFileId}.xlsx` },
      ]);
    },
  );

  integrationDbIt(
    "promoted standalone workbooks survive source artifact collection and keep file content protected",
    async (db) => {
      const storage = new FakeFileStorage();
      await insertUser(db, ownerUserId);
      await insertFile(db, workbookFileId, ownerUserId, "source.xlsx");
      await markFileDeleting(db, workbookFileId);
      await insertWorkbook(db, workbookSourceWorkbookId, workbookFileId, {
        origin: "standalone",
      });
      await insertSourceDocument(db, sourceDocumentId);
      await insertSourceRevision(db, sourceRevisionId, sourceDocumentId);
      await insertSourceArtifact(
        db,
        sourceArtifactId,
        sourceRevisionId,
        workbookSourceWorkbookId,
        "valid",
      );
      await tombstoneSourceGraph(db);
      const sourceGc = createSourceGarbageCollectionService(db);
      const fileGc = createFileLifecycleService(db, storage);

      assert.deepEqual(
        await sourceGc.collectSourceArtifact({ sourceArtifactId }),
        { status: "collected" },
      );
      const workbook = await db
        .selectFrom("workbooks")
        .select(["origin", "status"])
        .where("id", "=", workbookSourceWorkbookId)
        .executeTakeFirstOrThrow();
      assert.deepEqual(workbook, { origin: "standalone", status: "valid" });

      const result = await fileGc.collectDeletedFileContent({
        claimToken: "worker-1:019e9315-6a87-715f-9861-8654df081904",
        fileId: toFileFileId(workbookFileId),
      });
      assert.deepEqual(result, {
        eligibility: { eligible: false, reason: "protected_reference" },
        status: "skipped",
      });
      assert.deepEqual(storage.deletedObjects, []);
    },
  );

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
          createEditorOutputUpload: async () => {
            throw new Error("unused in edit draft creation");
          },
          completeEditorOutputUpload: async () => {
            throw new Error("unused in edit draft creation");
          },
          getFileMetadata: async () => {
            throw new Error("unused in edit draft creation");
          },
          getUploadMetadata: async () => {
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

  integrationDbIt(
    "saves, validates, and publishes an editor workbook revision without moving old version bindings",
    async (db) => {
      const service = await createEditorRevisionService(db);

      const editDraft = await service.createQuestionBlueprintEditDraft({
        blueprintId: blueprintIdValue,
        currentUser: currentUser(),
      });
      const saved =
        await service.saveQuestionBlueprintDraftWorkbookSourceRevision({
          currentUser: currentUser(),
          draftId: editDraft.draft.id,
          expectedRevision: 1,
          editorOutputFileId: secondWorkbookFileId,
          lineage: rootOperationLineage("019e9315-6a87-715f-9861-8654df081601"),
          sourceId: "sourceA",
        });

      assert.equal(saved.draft.sources[0]?.status, "uploaded");
      assert.equal(
        saved.draft.sources[0]?.sourceRevisionId,
        editorSourceRevisionId,
      );
      const oldVersionBeforeValidation = await db
        .selectFrom("questionBlueprintVersionSources")
        .select(["sourceRevisionId", "sourceArtifactId", "workbookId"])
        .where("blueprintVersionId", "=", versionIdValue)
        .executeTakeFirstOrThrow();
      assert.deepEqual(oldVersionBeforeValidation, {
        sourceArtifactId,
        sourceRevisionId,
        workbookId: workbookSourceWorkbookId,
      });

      await createValidationService(db).applyWorkbookValidationResult({
        occurredAt: at,
        ownerUserId: userId(ownerUserId),
        status: "valid",
        validationError: null,
        workbookId: workbookId(otherWorkbookId),
      });
      const published = await service.publishQuestionBlueprintDraft({
        currentUser: currentUser(),
        draftId: editDraft.draft.id,
        expectedRevision: 2,
        idempotencyKey: "publish-editor-revision",
        lineage: rootOperationLineage("019e9315-6a87-715f-9861-8654df081602"),
      });

      assert.equal(published.questionBlueprintVersion.id, editorVersionIdValue);
      const versionBindings = await db
        .selectFrom("questionBlueprintVersionSources")
        .select([
          "blueprintVersionId",
          "sourceRevisionId",
          "sourceArtifactId",
          "workbookId",
        ])
        .orderBy("blueprintVersionId")
        .execute();
      assert.deepEqual(versionBindings, [
        {
          blueprintVersionId: versionIdValue,
          sourceArtifactId,
          sourceRevisionId,
          workbookId: workbookSourceWorkbookId,
        },
        {
          blueprintVersionId: editorVersionIdValue,
          sourceArtifactId: secondSourceArtifactId,
          sourceRevisionId: editorSourceRevisionId,
          workbookId: otherWorkbookId,
        },
        {
          blueprintVersionId: sharedVersionIdValue,
          sourceArtifactId,
          sourceRevisionId,
          workbookId: workbookSourceWorkbookId,
        },
      ]);
      const revisions = await db
        .selectFrom("sourceRevisions")
        .select(["id", "parentRevisionId", "sourceDocumentId"])
        .where("sourceDocumentId", "=", sourceDocumentId)
        .orderBy("id")
        .execute();
      assert.deepEqual(revisions, [
        {
          id: sourceRevisionId,
          parentRevisionId: null,
          sourceDocumentId,
        },
        {
          id: editorSourceRevisionId,
          parentRevisionId: sourceRevisionId,
          sourceDocumentId,
        },
      ]);
      const artifacts = await db
        .selectFrom("sourceArtifacts")
        .select(["id", "sourceRevisionId", "status", "workbookId"])
        .where("id", "in", [sourceArtifactId, secondSourceArtifactId])
        .orderBy("id")
        .execute();
      assert.deepEqual(artifacts, [
        {
          id: sourceArtifactId,
          sourceRevisionId,
          status: "valid",
          workbookId: workbookSourceWorkbookId,
        },
        {
          id: secondSourceArtifactId,
          sourceRevisionId: editorSourceRevisionId,
          status: "valid",
          workbookId: otherWorkbookId,
        },
      ]);
    },
  );

  integrationDbIt(
    "rolls back editor revision materialization when the source head changed",
    async (db) => {
      const service = await createEditorRevisionService(db);
      const editDraft = await service.createQuestionBlueprintEditDraft({
        blueprintId: blueprintIdValue,
        currentUser: currentUser(),
      });
      await insertSourceRevision(
        db,
        concurrentSourceRevisionId,
        sourceDocumentId,
      );
      await db
        .updateTable("sourceDocuments")
        .set({ currentRevisionId: concurrentSourceRevisionId })
        .where("id", "=", sourceDocumentId)
        .executeTakeFirstOrThrow();
      const publishedSourcesBefore = await db
        .selectFrom("questionBlueprintVersionSources")
        .selectAll()
        .orderBy("blueprintVersionId")
        .execute();

      await assert.rejects(
        () =>
          service.saveQuestionBlueprintDraftWorkbookSourceRevision({
            currentUser: currentUser(),
            draftId: editDraft.draft.id,
            editorOutputFileId: secondWorkbookFileId,
            expectedRevision: 1,
            lineage: rootOperationLineage(
              "019e9315-6a87-715f-9861-8654df081603",
            ),
            sourceId: "sourceA",
          }),
        SourceDocumentRevisionConflictError,
      );

      const document = await db
        .selectFrom("sourceDocuments")
        .select("currentRevisionId")
        .where("id", "=", sourceDocumentId)
        .executeTakeFirstOrThrow();
      assert.equal(document.currentRevisionId, concurrentSourceRevisionId);
      const rolledBackRevision = await db
        .selectFrom("sourceRevisions")
        .select("id")
        .where("id", "=", editorSourceRevisionId)
        .executeTakeFirst();
      const rolledBackArtifact = await db
        .selectFrom("sourceArtifacts")
        .select("id")
        .where("id", "=", secondSourceArtifactId)
        .executeTakeFirst();
      assert.equal(rolledBackRevision, undefined);
      assert.equal(rolledBackArtifact, undefined);
      const draft = await db
        .selectFrom("questionBlueprintDrafts")
        .innerJoin(
          "questionBlueprintDraftSources",
          "questionBlueprintDraftSources.draftId",
          "questionBlueprintDrafts.id",
        )
        .select([
          "questionBlueprintDrafts.revision",
          "questionBlueprintDraftSources.sourceRevisionId",
          "questionBlueprintDraftSources.sourceArtifactId",
          "questionBlueprintDraftSources.workbookId",
        ])
        .where("questionBlueprintDrafts.id", "=", editDraftIdValue)
        .executeTakeFirstOrThrow();
      assert.deepEqual(draft, {
        revision: 1,
        sourceArtifactId,
        sourceRevisionId,
        workbookId: workbookSourceWorkbookId,
      });
      const publishedSourcesAfter = await db
        .selectFrom("questionBlueprintVersionSources")
        .selectAll()
        .orderBy("blueprintVersionId")
        .execute();
      assert.deepEqual(publishedSourcesAfter, publishedSourcesBefore);
    },
  );
});

async function createEditorRevisionService(db: QuestionsTestDatabase) {
  await insertUser(db, ownerUserId);
  await insertFile(db, workbookFileId, ownerUserId, "published.xlsx");
  await insertFile(db, secondWorkbookFileId, ownerUserId, "edited.xlsx");
  await insertWorkbook(db, workbookSourceWorkbookId, workbookFileId);
  await insertWorkbook(db, otherWorkbookId, secondWorkbookFileId, {
    originalName: "edited.xlsx",
  });
  await insertSourceDocument(db, sourceDocumentId);
  await insertSourceRevision(db, sourceRevisionId, sourceDocumentId);
  await db
    .updateTable("sourceDocuments")
    .set({ currentRevisionId: sourceRevisionId })
    .where("id", "=", sourceDocumentId)
    .executeTakeFirstOrThrow();
  await insertSourceArtifact(
    db,
    sourceArtifactId,
    sourceRevisionId,
    workbookSourceWorkbookId,
    "valid",
  );
  await insertBlueprintWithVersion(
    db,
    blueprintIdValue,
    versionIdValue,
    documentUsing("sourceA"),
  );
  await insertVersionSourceRow(db, "sourceA");
  await insertBlueprintWithVersion(
    db,
    sharedBlueprintIdValue,
    sharedVersionIdValue,
    documentUsing("sourceA"),
    "Shared blueprint",
  );
  await insertVersionSourceRow(db, "sourceA", sharedVersionIdValue);

  return new QuestionBlueprintDraftService({
    clock: { now: () => at },
    draftSourceFilePort: {
      createEditorOutputUpload: async () => {
        throw new Error("unused in editor save integration");
      },
      completeEditorOutputUpload: async () => {
        throw new Error("unused in editor save integration");
      },
      getFileMetadata: async () => ({
        byteSize: 2345,
        checksumSha256: checksum,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileId: secondWorkbookFileId,
        metadata: {
          draftId: editDraftIdValue,
          draftRevision: 1,
          ownerUserId,
          sourceArtifactId,
          sourceDocumentId,
          sourceId: "sourceA",
          sourceRevisionId,
          type: WORKBOOK_EDITOR_OUTPUT_FILE_METADATA_TYPE,
          version: WORKBOOK_EDITOR_OUTPUT_FILE_METADATA_VERSION,
        },
        originalName: "edited.xlsx",
        ownerUserId: userId(ownerUserId),
        purpose: "workbook_editor_output",
      }),
      getUploadMetadata: async () => {
        throw new Error("unused in editor save integration");
      },
    },
    // This integration path creates only a new version, source revision, and
    // source artifact; unused ID methods are intentionally omitted.
    idGenerator: {
      questionBlueprintDraftId: () =>
        questionBlueprintDraftId(editDraftIdValue),
      questionBlueprintVersionId: () =>
        questionBlueprintVersionId(editorVersionIdValue),
      sourceArtifactId: () => toSourceArtifactId(secondSourceArtifactId),
      sourceRevisionId: () => toSourceRevisionId(editorSourceRevisionId),
    } as never,
    questionBlueprintDraftTransaction: {
      transaction: (fn) =>
        db.transaction().execute((tx) =>
          fn({
            fileReferenceGuard: {
              assertFileAliasReferenceableForUpdate: async () => {},
            },
            questionsRepository: new KyselyQuestionsRepository(tx),
            workbookRegistrationPort: {
              registerWorkbookFromFile: async () => ({
                status: "pending_validation",
                workbookId: workbookId(otherWorkbookId),
              }),
            },
          }),
        ),
    },
    questionsRepository: new KyselyQuestionsRepository(db),
  });
}

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

function createSourceGarbageCollectionService(db: QuestionsTestDatabase) {
  return new SourceGarbageCollectionService({
    clock: { now: () => new Date("2026-10-01T00:00:00.000Z") },
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

function createFileLifecycleService(
  db: QuestionsTestDatabase,
  fileStorage: FileStorage,
) {
  return new FileLifecycleService({
    clock: { now: () => new Date("2026-10-01T00:00:00.000Z") },
    fileStorage,
    filesRepository: new KyselyFilesRepository(db),
    garbageCollectionTransaction: {
      transaction: (fn) =>
        db.transaction().execute((tx) => fn(new KyselyFilesRepository(tx))),
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

async function markFileDeleting(
  db: QuestionsTestDatabase,
  id: string,
): Promise<void> {
  await db
    .updateTable("files")
    .set({
      deletedAt: new Date("2026-05-01T00:00:00.000Z"),
      retentionExpiresAt: new Date("2026-05-31T00:00:00.000Z"),
      status: "deleting",
    })
    .where("id", "=", id)
    .execute();
}

async function insertWorkbook(
  db: QuestionsTestDatabase,
  id: string,
  fileIdValue: string,
  input?: Partial<{
    origin: "standalone" | "source_artifact";
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
      origin: input?.origin ?? "standalone",
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

async function tombstoneSourceGraph(db: QuestionsTestDatabase): Promise<void> {
  await db
    .updateTable("sourceDocuments")
    .set({
      deletedAt: new Date("2026-06-01T00:00:00.000Z"),
      retentionExpiresAt: new Date("2026-08-30T00:00:00.000Z"),
      status: "deleted",
    })
    .where("id", "=", sourceDocumentId)
    .execute();
  await db
    .updateTable("sourceRevisions")
    .set({
      deletedAt: new Date("2026-06-01T00:00:00.000Z"),
      retentionExpiresAt: new Date("2026-08-30T00:00:00.000Z"),
    })
    .where("id", "=", sourceRevisionId)
    .execute();
  await db
    .updateTable("sourceArtifacts")
    .set({
      deletedAt: new Date("2026-06-01T00:00:00.000Z"),
      retentionExpiresAt: new Date("2026-08-30T00:00:00.000Z"),
    })
    .where("id", "=", sourceArtifactId)
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
  documentOrInput?: Partial<{ name: string }> | QuestionBlueprintDocument,
  nameInput = "Blueprint",
): Promise<void> {
  const document =
    documentOrInput && "schemaVersion" in documentOrInput
      ? documentOrInput
      : emptyDocument();
  const name =
    documentOrInput && !("schemaVersion" in documentOrInput)
      ? (documentOrInput.name ?? nameInput)
      : nameInput;
  await db.transaction().execute(async (tx) => {
    await tx
      .insertInto("questionBlueprints")
      .values({
        archivedAt: null,
        createdByUserId: creatorUserId,
        currentVersionId: versionValue,
        description: questionBlueprintDescription(null),
        document,
        id: blueprintValue,
        name: questionBlueprintName(name),
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
        document,
        id: versionValue,
        name,
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
  input: Partial<{ blueprintVersionId: string }> | string = {},
): Promise<void> {
  const blueprintVersionId =
    typeof input === "string" ? input : input.blueprintVersionId;
  await insertVersionSourceMaterializationRow(db, {
    blueprintVersionId,
    originalName: "published.xlsx",
    sourceId: sourceIdValue,
  });
}

async function insertVersionSourceMaterializationRow(
  db: QuestionsTestDatabase,
  input: Partial<{
    blueprintVersionId: string;
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
      blueprintVersionId: input.blueprintVersionId ?? versionIdValue,
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
    // Focused integration-test user: auth-derived fields outside repository
    // persistence behavior are intentionally omitted.
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

class FakeFileStorage implements FileStorage {
  readonly deletedObjects: { bucket: string; key: string }[] = [];

  async deleteObject(input: { bucket: string; key: string }): Promise<void> {
    this.deletedObjects.push(input);
  }

  async createDownloadUrl(): Promise<never> {
    throw new Error("Not implemented.");
  }

  async createUploadUrl(): Promise<never> {
    throw new Error("Not implemented.");
  }

  async getObjectBytes(): Promise<never> {
    throw new Error("Not implemented.");
  }

  async getObjectMetadata(): Promise<never> {
    throw new Error("Not implemented.");
  }
}

function documentUsing(sourceId: string) {
  const referenceId = `workbook:${sourceId}:cell:Sheet1:A1`;
  return questionBlueprintDocument({
    blocks: [],
    references: [
      {
        id: referenceId,
        label: "Reference",
        required: true,
        source: {
          ref: "Sheet1!A1",
          schemaVersion: 1,
          sourceId,
          type: "workbook_cell",
        },
        value: { referenceId, schemaVersion: 1, type: "reference" },
      },
    ],
    responseFields: [],
    schemaVersion: 1,
  });
}
