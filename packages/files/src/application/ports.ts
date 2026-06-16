import type { CurrentUser } from "@lemma/identity/application";
import type {
  File,
  FileId,
  FileStatus,
  FileUpload,
  FileUploadId,
  UserId,
} from "../domain/index.js";

export interface FilesRepository {
  listFilesByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses: readonly FileStatus[];
    purpose?: string;
    limit: number;
    cursor?: Date;
  }): Promise<File[]>;
  findFileById(fileId: FileId): Promise<File | null>;
  findFileByUploadId(uploadId: FileUploadId): Promise<File | null>;
  createFileFromUpload(input: {
    file: File;
    upload: FileUpload;
  }): Promise<File>;
  updateFile(file: File): Promise<File | null>;
  createFileUpload(upload: FileUpload): Promise<FileUpload>;
  findFileUploadById(uploadId: FileUploadId): Promise<FileUpload | null>;
  updateFileUpload(upload: FileUpload): Promise<FileUpload | null>;
}

export interface FileStorage {
  createUploadUrl(input: {
    bucket: string;
    key: string;
    contentType: string;
    checksumSha256: string;
  }): Promise<string>;
  createDownloadUrl(input: { bucket: string; key: string }): Promise<string>;
  getObjectMetadata(input: { bucket: string; key: string }): Promise<{
    byteSize?: number;
    checksumSha256?: string;
    contentType?: string;
  } | null>;
  getObjectBytes(input: { bucket: string; key: string }): Promise<Uint8Array>;
  deleteObject(input: { bucket: string; key: string }): Promise<void>;
}

export type FileContentReaderPort = {
  getFileContentMetadata(input: {
    currentUser: CurrentUser;
    fileId: FileId;
  }): Promise<{
    fileId: FileId;
    ownerUserId: UserId;
    originalName: string;
    contentType: string;
    byteSize: number;
    checksumSha256: string;
  }>;
  getFileContentMetadataForOwnerUserId(input: {
    ownerUserId: UserId;
    fileId: FileId;
  }): Promise<{
    fileId: FileId;
    ownerUserId: UserId;
    originalName: string;
    contentType: string;
    byteSize: number;
    checksumSha256: string;
  }>;
  readFileContent(input: {
    currentUser: CurrentUser;
    fileId: FileId;
  }): Promise<{
    fileId: FileId;
    ownerUserId: UserId;
    originalName: string;
    contentType: string;
    byteSize: number;
    checksumSha256: string;
    bytes: Uint8Array;
  }>;
  readFileContentForOwnerUserId(input: {
    ownerUserId: UserId;
    fileId: FileId;
  }): Promise<{
    fileId: FileId;
    ownerUserId: UserId;
    originalName: string;
    contentType: string;
    byteSize: number;
    checksumSha256: string;
    bytes: Uint8Array;
  }>;
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
