import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createFileFromUpload,
  createFileUploadSession,
  type File,
  type FileUpload,
  fileId,
  fileUploadId,
  markFileDeleted,
  userId,
} from "../domain/index.js";
import { FileLifecycleService } from "./FileLifecycleService.js";
import type { Clock, FileStorage, FilesRepository } from "./ports.js";

const at = new Date("2026-06-15T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df072001");
const targetFileId = fileId("019e9315-6a87-715f-9861-8654df072002");
const targetUploadId = fileUploadId("019e9315-6a87-715f-9861-8654df072003");
const checksumSha256 =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const contentType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

describe("FileLifecycleService", () => {
  it("deletes storage object and marks file deleted", async () => {
    const harness = createHarness();
    harness.repository.files.set(targetFileId, createUploadedFile());

    await harness.service.handleFileDeletion({ fileId: targetFileId });

    assert.deepEqual(harness.storage.deletedObjects, [
      { bucket: "lemma-files", key: "files/workbook.xlsx" },
    ]);
    assert.equal(harness.repository.files.get(targetFileId)?.status, "deleted");
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

    await harness.service.handleFileDeletion({ fileId: targetFileId });

    assert.deepEqual(harness.storage.deletedObjects, []);
  });
});

function createHarness() {
  const repository = new FakeFilesRepository();
  const storage = new FakeFileStorage();
  return {
    repository,
    storage,
    service: new FileLifecycleService({
      filesRepository: repository,
      fileStorage: storage,
      clock,
    }),
  };
}

const clock: Clock = {
  now: () => at,
};

function createUpload(): FileUpload {
  return createFileUploadSession(
    {
      id: targetUploadId,
      createdByUserId: ownerUserId,
      bucket: "lemma-files",
      objectKey: "files/workbook.xlsx",
      originalName: "workbook.xlsx",
      contentType,
      expectedByteSize: 42,
      checksumSha256,
      purpose: "workbook",
    },
    at,
  );
}

function createUploadedFile(): File {
  return createFileFromUpload(
    {
      id: targetFileId,
      uploadId: targetUploadId,
      ownerUserId,
      createdByUserId: ownerUserId,
      bucket: "lemma-files",
      objectKey: "files/workbook.xlsx",
      originalName: "workbook.xlsx",
      contentType,
      byteSize: 42,
      checksumSha256,
      purpose: "workbook",
    },
    at,
  );
}

class FakeFilesRepository implements FilesRepository {
  readonly files = new Map<string, File>();
  readonly uploads = new Map<string, FileUpload>();

  async findFileById(id: File["id"]): Promise<File | null> {
    return this.files.get(id) ?? null;
  }

  async updateFile(file: File): Promise<File | null> {
    this.files.set(file.id, file);
    return file;
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
