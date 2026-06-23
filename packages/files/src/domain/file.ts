import { type Timestamped, touch } from "@lemma/domain";
import { FileNotVisibleError, InvalidFileStateError } from "./errors.js";
import {
  type FileBucket,
  type FileChecksumSha256,
  type FileContentType,
  type FileMetadata,
  type FileObjectKey,
  type FilePurpose,
  type FileStatus,
  fileBucket,
  fileByteSize,
  fileChecksumSha256,
  fileContentType,
  fileMetadata,
  fileObjectKey,
  filePurpose,
  fileStatus,
  isVisibleFileStatus,
  type OriginalFileName,
  originalFileName,
} from "./file-values.js";
import { type FileId, fileId, type UserId, userId } from "./ids.js";

export type File = Timestamped & {
  id: FileId;
  ownerUserId: UserId;
  createdByUserId: UserId;
  bucket: FileBucket;
  objectKey: FileObjectKey;
  originalName: OriginalFileName;
  contentType: FileContentType;
  byteSize: number;
  checksumSha256: FileChecksumSha256;
  status: FileStatus;
  purpose: FilePurpose;
  metadata: FileMetadata;
  uploadId: string | null;
  retentionExpiresAt: Date | null;
  deletedAt: Date | null;
};

export function createFileFromUpload(
  input: {
    id: string;
    uploadId: string;
    ownerUserId: string;
    createdByUserId: string;
    bucket: string;
    objectKey: string;
    originalName: string;
    contentType: string;
    byteSize: number;
    checksumSha256: string;
    purpose: string;
    metadata?: Record<string, unknown>;
  },
  at = new Date(),
): File {
  return {
    bucket: fileBucket(input.bucket),
    byteSize: fileByteSize(input.byteSize),
    checksumSha256: fileChecksumSha256(input.checksumSha256),
    contentType: fileContentType(input.contentType),
    createdAt: at,
    createdByUserId: userId(input.createdByUserId),
    deletedAt: null,
    id: fileId(input.id),
    metadata: fileMetadata(input.metadata ?? {}),
    objectKey: fileObjectKey(input.objectKey),
    originalName: originalFileName(input.originalName),
    ownerUserId: userId(input.ownerUserId),
    purpose: filePurpose(input.purpose),
    retentionExpiresAt: null,
    status: "uploaded",
    updatedAt: at,
    uploadId: input.uploadId,
  };
}

export function reconstituteFile(input: {
  id: string;
  ownerUserId: string;
  createdByUserId: string;
  bucket: string;
  objectKey: string;
  originalName: string;
  contentType: string;
  byteSize: number;
  checksumSha256: string;
  status: string;
  purpose: string;
  metadata: Record<string, unknown>;
  uploadId: string | null;
  retentionExpiresAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): File {
  return {
    bucket: fileBucket(input.bucket),
    byteSize: fileByteSize(input.byteSize),
    checksumSha256: fileChecksumSha256(input.checksumSha256),
    contentType: fileContentType(input.contentType),
    createdAt: input.createdAt,
    createdByUserId: userId(input.createdByUserId),
    deletedAt: input.deletedAt,
    id: fileId(input.id),
    metadata: fileMetadata(input.metadata),
    objectKey: fileObjectKey(input.objectKey),
    originalName: originalFileName(input.originalName),
    ownerUserId: userId(input.ownerUserId),
    purpose: filePurpose(input.purpose),
    retentionExpiresAt: input.retentionExpiresAt,
    status: fileStatus(input.status),
    updatedAt: input.updatedAt,
    uploadId: input.uploadId,
  };
}

export function updateFile(
  file: File,
  patch: {
    originalName?: OriginalFileName;
    purpose?: FilePurpose;
    metadata?: FileMetadata;
  },
  at = new Date(),
): File {
  assertFileIsVisible(file);

  return {
    ...touch(file, at),
    metadata: patch.metadata ?? file.metadata,
    originalName: patch.originalName ?? file.originalName,
    purpose: patch.purpose ?? file.purpose,
  };
}

export function markFileDeleting(file: File, at = new Date()): File {
  if (file.status === "deleted") {
    throw new InvalidFileStateError(
      "file cannot be deleted from current state",
    );
  }

  return {
    ...touch(file, at),
    status: "deleting",
  };
}

export function markFileDeleted(file: File, at = new Date()): File {
  if (file.status === "deleted") {
    return file;
  }
  return {
    ...touch(file, at),
    deletedAt: at,
    status: "deleted",
  };
}

export function assertFileIsVisible(file: File): void {
  if (!isVisibleFileStatus(file.status)) {
    throw new FileNotVisibleError();
  }
}

export function assertFileIsOwnedBy(file: File, userId: UserId): void {
  if (file.ownerUserId !== userId) {
    throw new FileNotVisibleError();
  }
}

export function assertFileCanBeDownloaded(file: File): void {
  if (file.status !== "uploaded") {
    throw new InvalidFileStateError(
      "File upload must be completed before download.",
    );
  }
}
