import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CurrentUser } from "@lemma/identity/application";
import { createUser } from "@lemma/identity/domain";
import {
  createFileUploadSession,
  type File,
  type FileUpload,
  fileId,
  fileUploadId,
  userId,
} from "../domain/index.js";
import { FileUploadService } from "./FileUploadService.js";
import type {
  Clock,
  FileStorage,
  FilesRepository,
  IdGenerator,
} from "./ports.js";

const at = new Date("2026-06-15T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df073001");
const nextFileId = fileId("019e9315-6a87-715f-9861-8654df073002");
const targetUploadId = fileUploadId("019e9315-6a87-715f-9861-8654df073003");
const checksumSha256 =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const contentType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

describe("FileUploadService", () => {
  it("verifies uploaded object metadata and creates the file", async () => {
    const harness = createHarness();
    harness.repository.uploads.set(targetUploadId, createUpload());
    harness.storage.metadata = {
      byteSize: 42,
      checksumSha256,
      contentType,
    };

    const result = await harness.service.completeFileUpload({
      currentUser: currentUser(ownerUserId),
      uploadId: targetUploadId,
    });

    assert.equal(result.file.id, nextFileId);
    assert.equal(result.file.status, "uploaded");
    assert.equal(
      harness.repository.uploads.get(targetUploadId)?.status,
      "verified",
    );
  });
});

function createHarness() {
  const repository = new FakeFilesRepository();
  const storage = new FakeFileStorage();
  return {
    repository,
    service: new FileUploadService({
      clock,
      config: {
        bucket: "lemma-files",
        downloadUrlExpiresInSeconds: 900,
        uploadUrlExpiresInSeconds: 900,
      },
      fileStorage: storage,
      filesRepository: repository,
      idGenerator,
    }),
    storage,
  };
}

const clock: Clock = {
  now: () => at,
};

const idGenerator: IdGenerator = {
  fileId: () => nextFileId,
  fileUploadId: () => targetUploadId,
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

function currentUser(id: typeof ownerUserId): CurrentUser {
  return {
    isAdmin: false,
    roles: [],
    user: createUser(
      {
        displayName: "Files User",
        email: "files@example.com",
        id,
        identityId: `oidc:${id}`,
      },
      at,
    ),
  };
}

class FakeFilesRepository implements FilesRepository {
  readonly uploads = new Map<string, FileUpload>();
  readonly files = new Map<string, File>();

  async findFileUploadById(id: FileUpload["id"]): Promise<FileUpload | null> {
    return this.uploads.get(id) ?? null;
  }

  async findFileByUploadId(uploadId: FileUpload["id"]): Promise<File | null> {
    return (
      [...this.files.values()].find((file) => file.uploadId === uploadId) ??
      null
    );
  }

  async createFileFromUpload(input: {
    file: File;
    upload: FileUpload;
  }): Promise<File> {
    this.files.set(input.file.id, input.file);
    this.uploads.set(input.upload.id, input.upload);
    return input.file;
  }

  async listFilesByOwnerUserId(): Promise<File[]> {
    throw new Error("Not implemented.");
  }

  async findFileById(): Promise<File | null> {
    throw new Error("Not implemented.");
  }

  async updateFile(): Promise<File | null> {
    throw new Error("Not implemented.");
  }

  async createFileUpload(): Promise<FileUpload> {
    throw new Error("Not implemented.");
  }

  async updateFileUpload(upload: FileUpload): Promise<FileUpload | null> {
    this.uploads.set(upload.id, upload);
    return upload;
  }
}

class FakeFileStorage implements FileStorage {
  metadata: Awaited<ReturnType<FileStorage["getObjectMetadata"]>> = null;

  async getObjectMetadata(): ReturnType<FileStorage["getObjectMetadata"]> {
    return this.metadata;
  }

  async createUploadUrl(): Promise<string> {
    throw new Error("Not implemented.");
  }

  async createDownloadUrl(): Promise<string> {
    throw new Error("Not implemented.");
  }

  async getObjectBytes(): Promise<Uint8Array> {
    throw new Error("Not implemented.");
  }

  async deleteObject(): Promise<void> {
    throw new Error("Not implemented.");
  }
}
