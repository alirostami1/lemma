import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CurrentUser } from "@lemma/identity/application";
import { createUser } from "@lemma/identity/domain";
import {
  createFileFromUpload,
  createFileUploadSession,
  type File,
  FileNotFoundError,
  type FileUpload,
  FileUploadNotFoundError,
  InvalidDomainValueError,
  fileId as toFileId,
  fileUploadId as toFileUploadId,
} from "../domain/index.js";
import {
  type FileStorage,
  type FilesRepository,
  FilesService,
} from "./index.js";

const ownerUserId = "019e9315-6a87-715f-9861-8654df099001";
const fileId = "019e9315-6a87-715f-9861-8654df099002";
const uploadId = "019e9315-6a87-715f-9861-8654df099003";
const nextUploadId = toFileUploadId("019e9315-6a87-715f-9861-8654df099004");
const nextFileId = toFileId("019e9315-6a87-715f-9861-8654df099005");
const checksumSha256 =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const contentType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

describe("FilesService", () => {
  it("lists normal workbook library files by default", async () => {
    const repository = repositoryFixture();
    const service = createService(repository);

    await service.listFiles({ currentUser: currentUser() });

    assert.equal(repository.receivedListPurpose, "workbook");
  });

  it("rejects public listing for workbook editor output purpose", async () => {
    const service = createService();

    await assert.rejects(
      () =>
        service.listFiles({
          currentUser: currentUser(),
          purpose: "workbook_editor_output",
        }),
      InvalidDomainValueError,
    );
  });

  it("rejects public creation of workbook editor output uploads", async () => {
    const service = createService();

    await assert.rejects(
      () =>
        service.createFileUpload({
          byteSize: 1234,
          checksumSha256:
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          currentUser: currentUser(),
          originalName: "source.xlsx",
          purpose: "workbook_editor_output",
        }),
      InvalidDomainValueError,
    );
  });

  it("rejects public direct-ID operations for editor-output files", async () => {
    const repository = repositoryFixture({
      file: fileFixture({ purpose: "workbook_editor_output" }),
    });
    const storage = storageFixture();
    const service = createService(repository, storage);

    await assert.rejects(
      () => service.getFile({ currentUser: currentUser(), fileId }),
      FileNotFoundError,
    );
    await assert.rejects(
      () => service.getFileForOwnerUserId({ ownerUserId, fileId }),
      FileNotFoundError,
    );
    await assert.rejects(
      () =>
        service.updateFile({
          currentUser: currentUser(),
          fileId,
          patch: { originalName: "renamed.xlsx" },
        }),
      FileNotFoundError,
    );
    await assert.rejects(
      () => service.deleteFile({ currentUser: currentUser(), fileId }),
      FileNotFoundError,
    );
    await assert.rejects(
      () => service.createDownloadUrl({ currentUser: currentUser(), fileId }),
      FileNotFoundError,
    );

    assert.equal(repository.updatedFiles.length, 0);
    assert.equal(storage.downloadUrlCalls, 0);
  });

  it("rejects public completion for editor-output uploads", async () => {
    const repository = repositoryFixture({
      upload: uploadFixture({ purpose: "workbook_editor_output" }),
    });
    const storage = storageFixture();
    const service = createService(repository, storage);

    await assert.rejects(
      () =>
        service.completeFileUpload({ currentUser: currentUser(), uploadId }),
      FileUploadNotFoundError,
    );

    assert.equal(repository.createdFiles.length, 0);
    assert.equal(storage.metadataCalls, 0);
  });

  it("deleteFile only tombstones and repeated deletion preserves retention", async () => {
    const repository = repositoryFixture({
      file: fileFixture({ purpose: "workbook" }),
    });
    const storage = storageFixture();
    const service = createService(repository, storage);

    await service.deleteFile({ currentUser: currentUser(), fileId });
    const firstRetention = repository.updatedFiles.at(-1)?.retentionExpiresAt;
    await service.deleteFile({ currentUser: currentUser(), fileId });
    const stored = await repository.findFileById(toFileId(fileId));

    assert.equal(stored?.status, "deleting");
    assert.equal(
      stored?.deletedAt?.toISOString(),
      new Date("2026-06-24T00:00:00.000Z").toISOString(),
    );
    assert.equal(stored?.retentionExpiresAt, firstRetention);
    assert.equal(storage.deletedObjects.length, 0);
  });

  it("collectDeletedFileContent returns collector results through the service facade", async () => {
    const service = createService(repositoryFixture());

    assert.deepEqual(
      await service.collectDeletedFileContent({
        claimToken: "collector-1",
        fileId,
      }),
      { status: "not_found" },
    );
  });

  it("returns upload-specific not found for missing, wrong-owner, and wrong-purpose upload lookups", async () => {
    const wrongOwnerUserId = "019e9315-6a87-715f-9861-8654df099099";

    for (const [name, repository] of [
      ["missing", repositoryFixture()],
      [
        "wrong owner",
        repositoryFixture({
          upload: uploadFixture({
            createdByUserId: wrongOwnerUserId,
            purpose: "workbook_editor_output",
          }),
        }),
      ],
      [
        "wrong purpose",
        repositoryFixture({
          upload: uploadFixture({ purpose: "workbook" }),
        }),
      ],
    ] as const) {
      const service = createService(repository);

      await assert.rejects(
        () =>
          service.getFileUploadForOwnerUserId({
            ownerUserId,
            purpose: "workbook_editor_output",
            uploadId,
          }),
        FileUploadNotFoundError,
        name,
      );
    }
  });

  it("creates and completes internal editor-output uploads", async () => {
    const repository = repositoryFixture();
    const storage = storageFixture();
    const service = createService(repository, storage);

    const created = await service.createInternalFileUpload({
      byteSize: 1234,
      checksumSha256: checksumSha256.toUpperCase(),
      contentType,
      currentUser: currentUser(),
      metadata: { type: "test" },
      originalName: "source.xlsx",
      purpose: "workbook_editor_output",
    });

    assert.equal(created.upload.purpose, "workbook_editor_output");
    assert.equal(created.upload.checksumSha256, checksumSha256);

    storage.metadata = {
      byteSize: 1234,
      checksumSha256,
      contentType,
    };
    const completed = await service.completeInternalFileUpload({
      currentUser: currentUser(),
      purpose: "workbook_editor_output",
      uploadId: created.upload.id,
    });

    assert.equal(completed.file.id, nextFileId);
    assert.equal(completed.file.purpose, "workbook_editor_output");
    assert.equal(completed.file.checksumSha256, checksumSha256);
  });
});

function createService(
  repository: FilesRepository = repositoryFixture(),
  storage: ReturnType<typeof storageFixture> = storageFixture(),
) {
  return new FilesService({
    clock: { now: () => new Date("2026-06-24T00:00:00.000Z") },
    config: {
      bucket: "files",
      downloadUrlExpiresInSeconds: 900,
      uploadUrlExpiresInSeconds: 900,
    },
    fileStorage: storage,
    filesRepository: repository,
    garbageCollectionTransaction: {
      transaction: async (fn) => fn(repository),
    },
    idGenerator: {
      fileId: () => nextFileId,
      fileUploadId: () => nextUploadId,
    },
  });
}

function repositoryFixture(input: { file?: File; upload?: FileUpload } = {}) {
  const files = new Map<string, File>();
  if (input.file) files.set(input.file.id, input.file);
  const uploads = new Map<string, FileUpload>();
  if (input.upload) uploads.set(input.upload.id, input.upload);
  const fixture = {
    createdFiles: [] as File[],
    updatedFiles: [] as File[],
    async createFileFromUpload(input: {
      file: File;
      upload: FileUpload;
    }): Promise<File> {
      fixture.createdFiles.push(input.file);
      files.set(input.file.id, input.file);
      uploads.set(input.upload.id, input.upload);
      return input.file;
    },
    async createFileUpload(upload: FileUpload): Promise<FileUpload> {
      uploads.set(upload.id, upload);
      return upload;
    },
    async countProtectedFileReferences() {
      return {
        activeDraftSourceBindings: 0,
        activeFileAliases: 0,
        activeSourceDocuments: 0,
        activeWorkbooks: 0,
        generatedQuestionSetMembershipsConservativelyRetained: 0,
        generatedQuestions: 0,
        generationRunsConservativelyRetained: 0,
        publishedBlueprintVersionSources: 0,
        sourceRevisionsWithoutArtifactsConservativelyRetained: 0,
        uncollectedSourceArtifacts: 0,
        workbookCalculationsConservativelyRetained: 0,
        workbookSnapshotsConservativelyRetained: 0,
      };
    },
    async findFileById(id: File["id"]): Promise<File | null> {
      return files.get(id) ?? null;
    },
    async findFileByIdForUpdate(id: File["id"]): Promise<File | null> {
      return files.get(id) ?? null;
    },
    async findFileByUploadId(id: FileUpload["id"]): Promise<File | null> {
      return [...files.values()].find((file) => file.uploadId === id) ?? null;
    },
    async findFileUploadById(id: FileUpload["id"]): Promise<FileUpload | null> {
      return uploads.get(id) ?? null;
    },
    async listFilesByOwnerUserId(input: { purpose?: string }): Promise<File[]> {
      fixture.receivedListPurpose = input.purpose;
      return [];
    },
    receivedListPurpose: undefined as string | undefined,
    async updateFile(file: File): Promise<File | null> {
      fixture.updatedFiles.push(file);
      files.set(file.id, file);
      return file;
    },
    async updateFileForGarbageCollection(): Promise<File | null> {
      return null;
    },
    async updateFileUpload(upload: FileUpload): Promise<FileUpload | null> {
      uploads.set(upload.id, upload);
      return upload;
    },
    async updateFileWithExpectedStatus(input: {
      file: File;
    }): Promise<File | null> {
      fixture.updatedFiles.push(input.file);
      files.set(input.file.id, input.file);
      return input.file;
    },
  } satisfies FilesRepository & {
    createdFiles: File[];
    receivedListPurpose?: string;
    updatedFiles: File[];
  };
  return fixture;
}

function fileFixture(input: {
  purpose: "workbook" | "workbook_editor_output";
}) {
  return createFileFromUpload(
    {
      bucket: "files",
      byteSize: 1234,
      checksumSha256,
      contentType,
      createdByUserId: ownerUserId,
      id: fileId,
      objectKey: "object",
      originalName: "source.xlsx",
      ownerUserId,
      purpose: input.purpose,
      uploadId,
    },
    new Date("2026-06-24T00:00:00.000Z"),
  );
}

function uploadFixture(input: {
  createdByUserId?: string;
  purpose: "workbook" | "workbook_editor_output";
}) {
  return createFileUploadSession(
    {
      bucket: "files",
      checksumSha256,
      contentType,
      createdByUserId: input.createdByUserId ?? ownerUserId,
      expectedByteSize: 1234,
      id: uploadId,
      objectKey: "object",
      originalName: "source.xlsx",
      purpose: input.purpose,
    },
    new Date("2026-06-24T00:00:00.000Z"),
  );
}

function storageFixture(): FileStorage & {
  deletedObjects: { bucket: string; key: string }[];
  downloadUrlCalls: number;
  metadata: Awaited<ReturnType<FileStorage["getObjectMetadata"]>>;
  metadataCalls: number;
} {
  return {
    deletedObjects: [],
    downloadUrlCalls: 0,
    metadata: null,
    metadataCalls: 0,
    async createDownloadUrl() {
      this.downloadUrlCalls += 1;
      return "https://storage.example/download";
    },
    async createUploadUrl() {
      return "https://storage.example/upload";
    },
    async deleteObject(input) {
      this.deletedObjects.push(input);
    },
    async getObjectBytes() {
      throw new Error("unused in test");
    },
    async getObjectMetadata() {
      this.metadataCalls += 1;
      return this.metadata;
    },
  };
}

function currentUser(): CurrentUser {
  return {
    isAdmin: false,
    roles: [],
    user: createUser(
      {
        displayName: "Owner",
        email: "owner@example.com",
        id: ownerUserId,
        identityId: "keycloak|owner",
      },
      new Date("2026-06-24T00:00:00.000Z"),
    ),
  };
}
