import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  claimFileGarbageCollection,
  createFileFromUpload,
  createFileUploadSession,
  type File,
  type FileGarbageCollectionClaimToken,
  type FileUpload,
  fileGarbageCollectionClaimToken,
  fileId,
  fileUploadId,
  markFileDeleted,
  markFileDeleting,
  userId,
} from "../domain/index.js";
import { FileLifecycleService } from "./FileLifecycleService.js";
import type {
  Clock,
  FileStorage,
  FilesRepository,
  ProtectedFileReferenceCounts,
} from "./ports.js";

const at = new Date("2026-06-15T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df072001");
const targetFileId = fileId("019e9315-6a87-715f-9861-8654df072002");
const targetUploadId = fileUploadId("019e9315-6a87-715f-9861-8654df072003");
const checksumSha256 =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const contentType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

describe("FileLifecycleService", () => {
  it("tombstones deleted aliases for 30 days without deleting content", () => {
    const deleted = markFileDeleting(createUploadedFile(), at);

    assert.equal(deleted.status, "deleting");
    assert.equal(deleted.deletedAt?.toISOString(), at.toISOString());
    assert.equal(
      deleted.retentionExpiresAt?.toISOString(),
      "2026-07-15T00:00:00.000Z",
    );
    assert.equal(
      markFileDeleting(deleted, new Date("2026-06-20T00:00:00.000Z")),
      deleted,
    );
  });

  it("collects retained file content only after references disappear", async () => {
    const harness = createHarness();
    harness.repository.files.set(
      targetFileId,
      markFileDeleting(
        createUploadedFile(),
        new Date("2026-05-01T00:00:00.000Z"),
      ),
    );
    harness.repository.protectedReferences.publishedBlueprintVersionSources = 1;

    const blocked = await harness.service.collectDeletedFileContent({
      claimToken: "collector-1",
      fileId: targetFileId,
    });

    assert.equal(blocked.status, "skipped");
    assert.deepEqual(harness.storage.deletedObjects, []);
    assert.equal(
      harness.repository.files.get(targetFileId)?.status,
      "deleting",
    );

    harness.repository.protectedReferences.publishedBlueprintVersionSources = 0;

    const collected = await harness.service.collectDeletedFileContent({
      claimToken: "collector-1",
      fileId: targetFileId,
    });

    assert.deepEqual(collected, { status: "collected" });
    assert.deepEqual(harness.storage.deletedObjects, [
      { bucket: "lemma-files", key: "files/workbook.xlsx" },
    ]);
    assert.equal(harness.repository.files.get(targetFileId)?.status, "deleted");
  });

  it("does not collect unreferenced file content before retention expires", async () => {
    const harness = createHarness();
    harness.repository.files.set(
      targetFileId,
      markFileDeleting(createUploadedFile(), at),
    );

    const result = await harness.service.collectDeletedFileContent({
      claimToken: "collector-1",
      fileId: targetFileId,
    });

    assert.equal(result.status, "skipped");
    assert.deepEqual(harness.storage.deletedObjects, []);
  });

  it("rejects blank garbage collection claim tokens", async () => {
    const harness = createHarness();
    harness.repository.files.set(
      targetFileId,
      markFileDeleting(
        createUploadedFile(),
        new Date("2026-05-01T00:00:00.000Z"),
      ),
    );

    await assert.rejects(
      () =>
        harness.service.collectDeletedFileContent({
          claimToken: "  ",
          fileId: targetFileId,
        }),
      /claim token must not be blank/,
    );
  });

  it("retries idempotent storage deletion after DB finalization fails", async () => {
    const harness = createHarness();
    harness.repository.files.set(
      targetFileId,
      markFileDeleting(
        createUploadedFile(),
        new Date("2026-05-01T00:00:00.000Z"),
      ),
    );
    harness.repository.failFinalization = true;

    const first = await harness.service.collectDeletedFileContent({
      claimToken: "collector-1",
      fileId: targetFileId,
    });
    harness.repository.failFinalization = false;
    const retry = await harness.service.collectDeletedFileContent({
      claimToken: "collector-1",
      fileId: targetFileId,
    });

    assert.deepEqual(first, { status: "finalize_pending" });
    assert.deepEqual(retry, { status: "collected" });
    assert.equal(harness.storage.deletedObjects.length, 2);
  });

  it("does not steal an unexpired collector claim", async () => {
    const harness = createHarness();
    const tombstoned = markFileDeleting(
      createUploadedFile(),
      new Date("2026-05-01T00:00:00.000Z"),
    );
    harness.repository.files.set(
      targetFileId,
      claimFileGarbageCollection(
        tombstoned,
        fileGarbageCollectionClaimToken("collector-1"),
        at,
      ),
    );

    const result = await harness.service.collectDeletedFileContent({
      claimToken: "collector-2",
      fileId: targetFileId,
    });

    assert.deepEqual(result, { status: "claimed_by_another_collector" });
    assert.deepEqual(harness.storage.deletedObjects, []);
  });

  it("expires initiated upload and deletes uploaded object", async () => {
    const harness = createHarness();
    harness.repository.uploads.set(targetUploadId, createUpload());

    await harness.service.handleFileUploadExpiration({
      uploadId: targetUploadId,
    });

    assert.deepEqual(harness.storage.deletedObjects, [
      { bucket: "lemma-files", key: "files/workbook.xlsx" },
    ]);
    assert.equal(
      harness.repository.uploads.get(targetUploadId)?.status,
      "expired",
    );
  });

  it("ignores already deleted files", async () => {
    const harness = createHarness();
    harness.repository.files.set(
      targetFileId,
      markFileDeleted(createUploadedFile(), at),
    );

    const result = await harness.service.collectDeletedFileContent({
      claimToken: "collector-1",
      fileId: targetFileId,
    });

    assert.equal(result.status, "skipped");
    assert.deepEqual(harness.storage.deletedObjects, []);
  });

  it("returns not_found when the file candidate no longer exists", async () => {
    const harness = createHarness();

    assert.deepEqual(
      await harness.service.collectDeletedFileContent({
        claimToken: "collector-1",
        fileId: targetFileId,
      }),
      { status: "not_found" },
    );
  });
});

function createHarness() {
  const repository = new FakeFilesRepository();
  const storage = new FakeFileStorage();
  return {
    repository,
    service: new FileLifecycleService({
      clock,
      fileStorage: storage,
      filesRepository: repository,
      garbageCollectionTransaction: {
        transaction: (fn) => fn(repository),
      },
    }),
    storage,
  };
}

const clock: Clock = {
  now: () => at,
};

function createUpload(): FileUpload {
  return createFileUploadSession(
    {
      bucket: "lemma-files",
      checksumSha256,
      contentType,
      createdByUserId: ownerUserId,
      expectedByteSize: 42,
      id: targetUploadId,
      objectKey: "files/workbook.xlsx",
      originalName: "workbook.xlsx",
      purpose: "workbook",
    },
    at,
  );
}

function createUploadedFile(): File {
  return createFileFromUpload(
    {
      bucket: "lemma-files",
      byteSize: 42,
      checksumSha256,
      contentType,
      createdByUserId: ownerUserId,
      id: targetFileId,
      objectKey: "files/workbook.xlsx",
      originalName: "workbook.xlsx",
      ownerUserId,
      purpose: "workbook",
      uploadId: targetUploadId,
    },
    at,
  );
}

class FakeFilesRepository implements FilesRepository {
  readonly files = new Map<string, File>();
  readonly uploads = new Map<string, FileUpload>();
  readonly protectedReferences: ProtectedFileReferenceCounts = {
    activeDraftSourceBindings: 0,
    activeFileAliases: 0,
    activeSourceDocuments: 0,
    activeWorkbooks: 0,
    generatedQuestions: 0,
    generatedQuestionSetMembershipsConservativelyRetained: 0,
    generationRunsConservativelyRetained: 0,
    publishedBlueprintVersionSources: 0,
    uncollectedSourceArtifacts: 0,
    sourceRevisionsWithoutArtifactsConservativelyRetained: 0,
    workbookCalculationsConservativelyRetained: 0,
    workbookSnapshotsConservativelyRetained: 0,
  };
  failFinalization = false;

  async countProtectedFileReferences(): Promise<ProtectedFileReferenceCounts> {
    return this.protectedReferences;
  }

  async findFileById(id: File["id"]): Promise<File | null> {
    return this.files.get(id) ?? null;
  }

  async findFileByIdForUpdate(id: File["id"]): Promise<File | null> {
    return this.findFileById(id);
  }

  async updateFile(file: File): Promise<File | null> {
    this.files.set(file.id, file);
    return file;
  }

  async updateFileForGarbageCollection(input: {
    file: File;
    claimToken: FileGarbageCollectionClaimToken;
  }): Promise<File | null> {
    if (this.failFinalization) return null;
    const current = this.files.get(input.file.id);
    if (current?.gcClaimToken !== input.claimToken) return null;
    return this.updateFile(input.file);
  }

  async updateFileWithExpectedStatus(input: {
    file: File;
    expectedStatus: File["status"];
  }): Promise<File | null> {
    const current = this.files.get(input.file.id);
    if (current?.status !== input.expectedStatus) return null;
    return this.updateFile(input.file);
  }

  async findFileUploadById(id: FileUpload["id"]): Promise<FileUpload | null> {
    return this.uploads.get(id) ?? null;
  }

  async updateFileUpload(upload: FileUpload): Promise<FileUpload | null> {
    this.uploads.set(upload.id, upload);
    return upload;
  }

  async listFilesByOwnerUserId(): Promise<File[]> {
    throw new Error("Not implemented.");
  }

  async findFileByUploadId(): Promise<File | null> {
    throw new Error("Not implemented.");
  }

  async createFileFromUpload(): Promise<File> {
    throw new Error("Not implemented.");
  }

  async createFileUpload(): Promise<FileUpload> {
    throw new Error("Not implemented.");
  }
}

class FakeFileStorage implements FileStorage {
  readonly deletedObjects: { bucket: string; key: string }[] = [];

  async deleteObject(input: { bucket: string; key: string }): Promise<void> {
    this.deletedObjects.push(input);
  }

  async createUploadUrl(): Promise<string> {
    throw new Error("Not implemented.");
  }

  async createDownloadUrl(): Promise<string> {
    throw new Error("Not implemented.");
  }

  async getObjectMetadata(): Promise<null> {
    throw new Error("Not implemented.");
  }

  async getObjectBytes(): Promise<Uint8Array> {
    throw new Error("Not implemented.");
  }
}
