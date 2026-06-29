import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { startTestDatabase, type TestDatabase } from "@lemma/db/testing";
import { fileId } from "../domain/index.js";
import { KyselyFilesRepository } from "./KyselyFilesRepository.js";

const ids = {
  artifact: "019f0db0-a3a1-7a61-9101-8947e43c2001",
  blueprint: "019f0db0-a3a1-7a61-9101-8947e43c2002",
  calculation: "019f0db0-a3a1-7a61-9101-8947e43c2003",
  draft: "019f0db0-a3a1-7a61-9101-8947e43c2004",
  file: "019f0db0-a3a1-7a61-9101-8947e43c2005",
  question: "019f0db0-a3a1-7a61-9101-8947e43c2006",
  revision: "019f0db0-a3a1-7a61-9101-8947e43c2007",
  run: "019f0db0-a3a1-7a61-9101-8947e43c2008",
  set: "019f0db0-a3a1-7a61-9101-8947e43c2009",
  sourceDocument: "019f0db0-a3a1-7a61-9101-8947e43c2010",
  snapshot: "019f0db0-a3a1-7a61-9101-8947e43c2011",
  user: "019f0db0-a3a1-7a61-9101-8947e43c2012",
  version: "019f0db0-a3a1-7a61-9101-8947e43c2013",
  workbook: "019f0db0-a3a1-7a61-9101-8947e43c2014",
} as const;
const checksum = "a".repeat(64);
const document = {
  blocks: [],
  references: [],
  responseFields: [],
  schemaVersion: 1,
};
let database: TestDatabase | null = null;

before(async () => {
  database = await startTestDatabase({
    context: "File persistence integration tests",
  });
});

after(async () => {
  await database?.stop();
});

beforeEach(async () => {
  await database?.reset();
});

test("counts every persisted file protected-root path", async () => {
  assert.ok(database);
  const db = database.db;
  await seedProtectedRootGraph(db);

  const counts = await new KyselyFilesRepository(
    db,
  ).countProtectedFileReferences(fileId(ids.file));

  assert.equal(counts.activeFileAliases, 1);
  assert.equal(counts.activeSourceDocuments, 1);
  assert.equal(counts.uncollectedSourceArtifacts, 1);
  assert.equal(counts.activeDraftSourceBindings, 1);
  assert.equal(counts.publishedBlueprintVersionSources, 1);
  assert.equal(counts.generatedQuestions, 1);
  assert.equal(counts.generatedQuestionSetMembershipsConservativelyRetained, 1);
  assert.equal(counts.generationRunsConservativelyRetained, 1);
  assert.equal(counts.activeWorkbooks, 1);
  assert.equal(counts.workbookCalculationsConservativelyRetained, 1);
  assert.equal(counts.workbookSnapshotsConservativelyRetained, 1);
});

test("does not count deleted aliases, deleted source documents, collected artifacts, or deleted workbooks as active roots", async () => {
  assert.ok(database);
  const db = database.db;
  await seedProtectedRootGraph(db);
  await db
    .updateTable("files")
    .set({
      deletedAt: new Date("2026-06-01T00:00:00.000Z"),
      retentionExpiresAt: new Date("2026-07-01T00:00:00.000Z"),
      status: "deleting",
    })
    .where("id", "=", ids.file)
    .execute();
  await db
    .updateTable("sourceDocuments")
    .set({
      deletedAt: new Date("2026-06-01T00:00:00.000Z"),
      retentionExpiresAt: new Date("2026-09-01T00:00:00.000Z"),
      status: "deleted",
    })
    .where("id", "=", ids.sourceDocument)
    .execute();
  await db
    .updateTable("sourceArtifacts")
    .set({
      collectedAt: new Date("2026-09-02T00:00:00.000Z"),
      deletedAt: new Date("2026-06-01T00:00:00.000Z"),
      retentionExpiresAt: new Date("2026-09-01T00:00:00.000Z"),
      status: "deleted",
    })
    .where("id", "=", ids.artifact)
    .execute();
  await db
    .updateTable("workbooks")
    .set({ status: "deleted" })
    .where("id", "=", ids.workbook)
    .execute();

  const counts = await new KyselyFilesRepository(
    db,
  ).countProtectedFileReferences(fileId(ids.file));

  assert.equal(counts.activeFileAliases, 0);
  assert.equal(counts.activeSourceDocuments, 0);
  assert.equal(counts.uncollectedSourceArtifacts, 0);
  assert.equal(counts.activeWorkbooks, 0);
  assert.equal(counts.publishedBlueprintVersionSources, 1);
  assert.equal(counts.generatedQuestions, 1);
});

test("counts artifactless source revisions as explicit conservative file roots", async () => {
  assert.ok(database);
  const db = database.db;
  await insertUserAndFile(db);
  await db
    .insertInto("sourceDocuments")
    .values({
      id: ids.sourceDocument,
      kind: "workbook",
      name: "Source",
      ownerUserId: ids.user,
      status: "active",
    })
    .execute();
  await db
    .insertInto("sourceRevisions")
    .values({
      byteSize: 42,
      checksumSha256: checksum,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      createdByUserId: ids.user,
      editorMetadata: {},
      fileId: ids.file,
      id: ids.revision,
      kind: "workbook",
      ownerUserId: ids.user,
      sourceDocumentId: ids.sourceDocument,
    })
    .execute();

  const counts = await new KyselyFilesRepository(
    db,
  ).countProtectedFileReferences(fileId(ids.file));

  assert.equal(counts.sourceRevisionsWithoutArtifactsConservativelyRetained, 1);
});

test("does not count inactive draft, deleted question, or deleted set roots", async () => {
  assert.ok(database);
  const db = database.db;
  await seedProtectedRootGraph(db);
  await db
    .updateTable("questionBlueprintDrafts")
    .set({ status: "discarded" })
    .where("id", "=", ids.draft)
    .execute();
  await db
    .updateTable("questions")
    .set({ status: "deleted" })
    .where("id", "=", ids.question)
    .execute();
  await db
    .updateTable("questionSets")
    .set({ status: "deleted" })
    .where("id", "=", ids.set)
    .execute();

  const counts = await new KyselyFilesRepository(
    db,
  ).countProtectedFileReferences(fileId(ids.file));

  assert.equal(counts.activeDraftSourceBindings, 0);
  assert.equal(counts.generatedQuestions, 0);
  assert.equal(counts.generatedQuestionSetMembershipsConservativelyRetained, 0);
  assert.equal(counts.publishedBlueprintVersionSources, 1);
});

test("counts active generated question-set memberships conservatively even when the question is deleted", async () => {
  assert.ok(database);
  const db = database.db;
  await seedProtectedRootGraph(db);
  await db
    .updateTable("questions")
    .set({ status: "deleted" })
    .where("id", "=", ids.question)
    .execute();

  const counts = await new KyselyFilesRepository(
    db,
  ).countProtectedFileReferences(fileId(ids.file));

  assert.equal(counts.generatedQuestions, 0);
  assert.equal(counts.generatedQuestionSetMembershipsConservativelyRetained, 1);
});

test("rejects invalid file lifecycle rows at the database boundary", async () => {
  assert.ok(database);
  const db = database.db;
  await db
    .insertInto("users")
    .values({
      displayName: "GC User",
      email: "gc@example.com",
      id: ids.user,
      identityId: "oidc:gc-user",
      status: "active",
    })
    .execute();

  await assert.rejects(() =>
    db
      .insertInto("files")
      .values({
        bucket: "files",
        byteSize: 42,
        checksumSha256: checksum,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        createdByUserId: ids.user,
        deletedAt: new Date("2026-06-01T00:00:00.000Z"),
        id: ids.file,
        metadata: {},
        objectKey: "source.xlsx",
        originalName: "source.xlsx",
        ownerUserId: ids.user,
        purpose: "workbook",
        retentionExpiresAt: null,
        status: "uploaded",
      })
      .execute(),
  );

  await assert.rejects(() =>
    db
      .insertInto("files")
      .values({
        bucket: "files",
        byteSize: 42,
        checksumSha256: checksum,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        createdByUserId: ids.user,
        gcClaimedAt: new Date("2026-06-01T00:00:00.000Z"),
        gcClaimToken: "worker-1",
        id: "019f0db0-a3a1-7a61-9101-8947e43c2020",
        metadata: {},
        objectKey: "source-2.xlsx",
        originalName: "source-2.xlsx",
        ownerUserId: ids.user,
        purpose: "workbook",
        status: "uploaded",
      })
      .execute(),
  );
});

async function seedProtectedRootGraph(db: TestDatabase["db"]): Promise<void> {
  await insertUserAndFile(db);
  await db
    .insertInto("workbooks")
    .values({
      checksumSha256: checksum,
      createdByUserId: ids.user,
      engine: "libreoffice",
      fileId: ids.file,
      id: ids.workbook,
      name: "Workbook",
      originalName: "source.xlsx",
      ownerUserId: ids.user,
      status: "valid",
    })
    .execute();
  await db
    .insertInto("sourceDocuments")
    .values({
      id: ids.sourceDocument,
      kind: "workbook",
      name: "Source",
      ownerUserId: ids.user,
      status: "active",
    })
    .execute();
  await db
    .insertInto("sourceRevisions")
    .values({
      byteSize: 42,
      checksumSha256: checksum,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      createdByUserId: ids.user,
      editorMetadata: {},
      fileId: ids.file,
      id: ids.revision,
      kind: "workbook",
      ownerUserId: ids.user,
      sourceDocumentId: ids.sourceDocument,
    })
    .execute();
  await db
    .updateTable("sourceDocuments")
    .set({ currentRevisionId: ids.revision })
    .where("id", "=", ids.sourceDocument)
    .execute();
  await db
    .insertInto("sourceArtifacts")
    .values({
      artifactMetadata: {},
      id: ids.artifact,
      kind: "workbook",
      ownerUserId: ids.user,
      processor: "lemma-workbook",
      processorVersion: "1",
      sourceRevisionId: ids.revision,
      status: "valid",
      workbookId: ids.workbook,
    })
    .execute();
  await db.transaction().execute(async (tx) => {
    await tx
      .insertInto("questionBlueprints")
      .values({
        createdByUserId: ids.user,
        currentVersionId: ids.version,
        document,
        id: ids.blueprint,
        name: "Blueprint",
        ownerUserId: ids.user,
        status: "active",
        visibility: "private",
      })
      .execute();
    await tx
      .insertInto("questionBlueprintVersions")
      .values({
        blueprintId: ids.blueprint,
        createdByUserId: ids.user,
        document,
        id: ids.version,
        name: "Blueprint",
        ownerUserId: ids.user,
        versionNumber: 1,
      })
      .execute();
  });
  await db
    .insertInto("questionBlueprintVersionSources")
    .values(sourceBinding(ids.version))
    .execute();
  await db
    .insertInto("questionBlueprintDrafts")
    .values({
      createdByUserId: ids.user,
      document,
      id: ids.draft,
      lastSavedAt: new Date(),
      name: "Draft",
      ownerUserId: ids.user,
      status: "draft",
    })
    .execute();
  await db
    .insertInto("questionBlueprintDraftSources")
    .values({
      byteSize: 42,
      checksumSha256: checksum,
      draftId: ids.draft,
      fileId: ids.file,
      name: "Source",
      originalName: "source.xlsx",
      sourceArtifactId: ids.artifact,
      sourceDocumentId: ids.sourceDocument,
      sourceId: "sourceA",
      sourceRevisionId: ids.revision,
      status: "validated",
      type: "workbook",
      workbookId: ids.workbook,
    })
    .execute();
  await db
    .insertInto("questionSets")
    .values({
      createdByUserId: ids.user,
      id: ids.set,
      name: "Set",
      ownerUserId: ids.user,
      status: "active",
    })
    .execute();
  await db
    .insertInto("workbookCalculations")
    .values({
      createdByUserId: ids.user,
      id: ids.calculation,
      ownerUserId: ids.user,
      requestedCount: 1,
      status: "succeeded",
    })
    .execute();
  await db
    .insertInto("workbookCalculationSources")
    .values({
      calculationId: ids.calculation,
      position: 0,
      sourceId: "sourceA",
      workbookId: ids.workbook,
    })
    .execute();
  await db
    .insertInto("workbookSnapshots")
    .values({
      calculationId: ids.calculation,
      id: ids.snapshot,
      questionIndex: 0,
      snapshotIndex: 0,
      sourceId: "sourceA",
      values: {},
      workbookId: ids.workbook,
    })
    .execute();
  await db
    .insertInto("questionGenerationRuns")
    .values({
      blueprintId: ids.blueprint,
      blueprintSnapshot: {
        blueprintId: ids.blueprint,
        blueprintVersionId: ids.version,
        capturedAt: new Date().toISOString(),
        description: null,
        document,
        documentHash: "hash",
        name: "Blueprint",
        schemaVersion: 1,
        sources: [],
      },
      blueprintVersionId: ids.version,
      createdByUserId: ids.user,
      id: ids.run,
      ownerUserId: ids.user,
      requestedCount: 1,
      status: "succeeded",
      targetQuestionSetId: ids.set,
      workbookCalculationId: ids.calculation,
    })
    .execute();
  await db
    .insertInto("questions")
    .values({
      blueprintId: ids.blueprint,
      body: document,
      createdByUserId: ids.user,
      generationRunId: ids.run,
      id: ids.question,
      ownerUserId: ids.user,
      producer: { schemaVersion: 1 },
      solution: { schemaVersion: 1 },
      sourceEvidence: { schemaVersion: 1, sources: [] },
      sourcePlan: { schemaVersion: 1 },
      status: "active",
    })
    .execute();
  await db
    .insertInto("questionSetQuestions")
    .values({
      addedByUserId: ids.user,
      position: 0,
      questionId: ids.question,
      questionSetId: ids.set,
    })
    .execute();
}

async function insertUserAndFile(db: TestDatabase["db"]): Promise<void> {
  await db
    .insertInto("users")
    .values({
      displayName: "GC User",
      email: "gc@example.com",
      id: ids.user,
      identityId: "oidc:gc-user",
      status: "active",
    })
    .execute();
  await db
    .insertInto("files")
    .values({
      bucket: "files",
      byteSize: 42,
      checksumSha256: checksum,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      createdByUserId: ids.user,
      id: ids.file,
      metadata: {},
      objectKey: "source.xlsx",
      originalName: "source.xlsx",
      ownerUserId: ids.user,
      purpose: "workbook",
      status: "uploaded",
    })
    .execute();
}

function sourceBinding(parentId: string) {
  return {
    blueprintVersionId: parentId,
    byteSize: 42,
    checksumSha256: checksum,
    fileId: ids.file,
    name: "Source",
    originalName: "source.xlsx",
    sourceArtifactId: ids.artifact,
    sourceDocumentId: ids.sourceDocument,
    sourceId: "sourceA",
    sourceRevisionId: ids.revision,
    type: "workbook",
    workbookId: ids.workbook,
  };
}
