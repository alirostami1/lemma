import assert from "node:assert/strict";
import test from "node:test";
import { createUser } from "@lemma/identity/domain";
import {
  createFileFromUpload,
  type File,
  fileId,
  fileUploadId,
  userId,
} from "../domain/index.js";
import { FilesService } from "./FilesService.js";
import type { FileStorage, FilesRepository } from "./ports.js";

const at = new Date("2026-06-15T00:00:00.000Z");
const ownerUserId = userId("019f0db0-a3a1-7a61-9101-8947e43c3001");
const targetFileId = fileId("019f0db0-a3a1-7a61-9101-8947e43c3002");

test("deleteFile only tombstones and repeated deletion preserves retention", async () => {
  let stored = uploadedFile();
  const deletedObjects: string[] = [];
  const repository = {
    async findFileById() {
      return stored;
    },
    async updateFileWithExpectedStatus(input: { file: File }) {
      stored = input.file;
      return stored;
    },
    // Focused repository fake: implements only the methods exercised by this
    // delete-file tombstone path.
  } as unknown as FilesRepository;
  const storage = {
    async deleteObject(input: { key: string }) {
      deletedObjects.push(input.key);
    },
    // Focused storage fake: only deleteObject is relevant to proving this
    // user-facing delete path does not delete physical content.
  } as unknown as FileStorage;
  const service = new FilesService({
    clock: { now: () => at },
    config: {
      bucket: "files",
      downloadUrlExpiresInSeconds: 60,
      uploadUrlExpiresInSeconds: 60,
    },
    fileStorage: storage,
    filesRepository: repository,
    garbageCollectionTransaction: {
      transaction: async (fn) => fn(repository),
    },
    idGenerator: {
      fileId: () => targetFileId,
      fileUploadId: () => fileUploadId("019f0db0-a3a1-7a61-9101-8947e43c3003"),
    },
  });
  const command = {
    currentUser: {
      isAdmin: false,
      roles: [],
      user: createUser(
        {
          displayName: "Owner",
          email: "owner@example.com",
          id: ownerUserId,
          identityId: `oidc:${ownerUserId}`,
        },
        at,
      ),
    },
    fileId: targetFileId,
  };

  await service.deleteFile(command);
  const firstRetention = stored.retentionExpiresAt;
  await service.deleteFile(command);

  assert.equal(stored.status, "deleting");
  assert.equal(stored.deletedAt?.toISOString(), at.toISOString());
  assert.equal(stored.retentionExpiresAt, firstRetention);
  assert.deepEqual(deletedObjects, []);
});

test("collectDeletedFileContent returns collector results through the service facade", async () => {
  const repository = {
    async findFileByIdForUpdate() {
      return null;
    },
    // Focused repository fake: implements only the collector lookup used by
    // this facade result test.
  } as unknown as FilesRepository;
  const service = new FilesService({
    clock: { now: () => at },
    config: {
      bucket: "files",
      downloadUrlExpiresInSeconds: 60,
      uploadUrlExpiresInSeconds: 60,
    },
    fileStorage: {} as FileStorage,
    filesRepository: repository,
    garbageCollectionTransaction: {
      transaction: async (fn) => fn(repository),
    },
    idGenerator: {
      fileId: () => targetFileId,
      fileUploadId: () => fileUploadId("019f0db0-a3a1-7a61-9101-8947e43c3003"),
    },
  });

  assert.deepEqual(
    await service.collectDeletedFileContent({
      claimToken: "collector-1",
      fileId: targetFileId,
    }),
    { status: "not_found" },
  );
});

function uploadedFile(): File {
  return createFileFromUpload(
    {
      bucket: "files",
      byteSize: 42,
      checksumSha256: "a".repeat(64),
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      createdByUserId: ownerUserId,
      id: targetFileId,
      objectKey: "source.xlsx",
      originalName: "source.xlsx",
      ownerUserId,
      purpose: "workbook",
      uploadId: "019f0db0-a3a1-7a61-9101-8947e43c3003",
    },
    at,
  );
}
