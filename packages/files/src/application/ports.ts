import type { CurrentUser } from "@lemma/identity/application";
import type {
  File,
  FileGarbageCollectionClaimToken,
  FileId,
  FileStatus,
  FileUpload,
  FileUploadId,
  UserId,
} from "../domain/index.js";

export interface FilesRepository {
  countProtectedFileReferences(
    fileId: FileId,
  ): Promise<ProtectedFileReferenceCounts>;
  createFileFromUpload(input: {
    file: File;
    upload: FileUpload;
  }): Promise<File>;
  createFileUpload(upload: FileUpload): Promise<FileUpload>;
  findFileById(fileId: FileId): Promise<File | null>;
  findFileByIdForUpdate(fileId: FileId): Promise<File | null>;
  findFileByUploadId(uploadId: FileUploadId): Promise<File | null>;
  findFileUploadById(uploadId: FileUploadId): Promise<FileUpload | null>;
  listFilesByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses: readonly FileStatus[];
    purpose?: string;
    limit: number;
    cursor?: Date;
  }): Promise<File[]>;
  updateFile(file: File): Promise<File | null>;
  updateFileForGarbageCollection(input: {
    file: File;
    claimToken: FileGarbageCollectionClaimToken;
  }): Promise<File | null>;
  updateFileUpload(upload: FileUpload): Promise<FileUpload | null>;
  updateFileWithExpectedStatus(input: {
    file: File;
    expectedStatus: FileStatus;
  }): Promise<File | null>;
}

export type ProtectedFileReferenceCounts = {
  activeDraftSourceBindings: number;
  activeFileAliases: number;
  activeSourceDocuments: number;
  activeWorkbooks: number;
  generatedQuestions: number;
  generatedQuestionSetMembershipsConservativelyRetained: number;
  generationRunsConservativelyRetained: number;
  publishedBlueprintVersionSources: number;
  uncollectedSourceArtifacts: number;
  sourceRevisionsWithoutArtifactsConservativelyRetained: number;
  workbookCalculationsConservativelyRetained: number;
  workbookSnapshotsConservativelyRetained: number;
};

export interface FileGarbageCollectionTransactionPort {
  transaction<T>(fn: (repository: FilesRepository) => Promise<T>): Promise<T>;
}

export interface FileReferenceGuardPort {
  assertFileAliasReferenceableForUpdate(fileId: string): Promise<void>;
}

export interface FileStorage {
  createDownloadUrl(input: { bucket: string; key: string }): Promise<string>;
  createUploadUrl(input: {
    bucket: string;
    key: string;
    contentType: string;
    checksumSha256: string;
  }): Promise<string>;
  deleteObject(input: { bucket: string; key: string }): Promise<void>;
  getObjectBytes(input: { bucket: string; key: string }): Promise<Uint8Array>;
  getObjectMetadata(input: { bucket: string; key: string }): Promise<{
    byteSize?: number;
    checksumSha256?: string;
    contentType?: string;
  } | null>;
}

export type FileContentMetadataQuery = {
  currentUser: CurrentUser;
  fileId: FileId;
};

export type FileContentMetadataForOwnerQuery = {
  ownerUserId: UserId;
  fileId: FileId;
};

export type FileContentMetadata = {
  fileId: FileId;
  ownerUserId: UserId;
  originalName: string;
  contentType: string;
  byteSize: number;
  checksumSha256: string;
  purpose: string;
  metadata: Record<string, unknown>;
};

export type FileContent = FileContentMetadata & {
  bytes: Uint8Array;
};

export type FileContentReaderPort = {
  getFileContentMetadata(
    input: FileContentMetadataQuery,
  ): Promise<FileContentMetadata>;
  getFileContentMetadataForOwnerUserId(
    input: FileContentMetadataForOwnerQuery,
  ): Promise<FileContentMetadata>;
  readFileContent(input: FileContentMetadataQuery): Promise<FileContent>;
  readFileContentForOwnerUserId(
    input: FileContentMetadataForOwnerQuery,
  ): Promise<FileContent>;
};

export interface IdGenerator {
  fileId(): FileId;
  fileUploadId(): FileUploadId;
}

export interface Clock {
  now(): Date;
}

export type FilesServiceConfig = {
  bucket: string;
  uploadUrlExpiresInSeconds: number;
  downloadUrlExpiresInSeconds: number;
};
