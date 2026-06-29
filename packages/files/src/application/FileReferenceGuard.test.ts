import assert from "node:assert/strict";
import test from "node:test";
import {
  createFileFromUpload,
  type File,
  FileAliasUnavailableError,
  fileId,
  markFileDeleted,
  markFileDeleting,
  userId,
} from "../domain/index.js";
import { FileReferenceGuard } from "./FileReferenceGuard.js";
import type { FilesRepository } from "./ports.js";

const at = new Date("2026-06-15T00:00:00.000Z");
const ownerUserId = userId("019f0db0-a3a1-7a61-9101-8947e43c3101");
const targetFileId = fileId("019f0db0-a3a1-7a61-9101-8947e43c3102");

test("file reference guard allows uploaded aliases", async () => {
  const repository = new FakeFilesRepository(uploadedFile());

  await createGuard(repository).assertFileAliasReferenceableForUpdate(
    targetFileId,
  );

  assert.deepEqual(repository.lockedFileIds, [targetFileId]);
});

test("file reference guard rejects missing or unavailable aliases", async () => {
  await assert.rejects(
    () =>
      createGuard(
        new FakeFilesRepository(null),
      ).assertFileAliasReferenceableForUpdate(targetFileId),
    FileAliasUnavailableError,
  );

  for (const file of [
    markFileDeleting(uploadedFile(), at),
    markFileDeleted(uploadedFile(), at),
  ]) {
    await assert.rejects(
      () =>
        createGuard(
          new FakeFilesRepository(file),
        ).assertFileAliasReferenceableForUpdate(targetFileId),
      FileAliasUnavailableError,
    );
  }
});

class FakeFilesRepository {
  readonly lockedFileIds: string[] = [];

  constructor(private readonly file: File | null) {}

  async findFileByIdForUpdate(id: File["id"]): Promise<File | null> {
    this.lockedFileIds.push(id);
    return this.file;
  }
}

function createGuard(repository: FakeFilesRepository): FileReferenceGuard {
  // Focused test fake: implements only the repository method exercised by this
  // guard path.
  return new FileReferenceGuard(repository as unknown as FilesRepository);
}

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
      uploadId: "019f0db0-a3a1-7a61-9101-8947e43c3103",
    },
    at,
  );
}
