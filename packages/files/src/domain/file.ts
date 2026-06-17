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
    id: fileId(input.id),
    ownerUserId: userId(input.ownerUserId),
    createdByUserId: userId(input.createdByUserId),
    bucket: fileBucket(input.bucket),
    objectKey: fileObjectKey(input.objectKey),
    originalName: originalFileName(input.originalName),
    contentType: fileContentType(input.contentType),
    byteSize: fileByteSize(input.byteSize),
    checksumSha256: fileChecksumSha256(input.checksumSha256),
    status: "uploaded",
    purpose: filePurpose(input.purpose),
    metadata: fileMetadata(input.metadata ?? {}),
    uploadId: input.uploadId,
    retentionExpiresAt: null,
    deletedAt: null,
    createdAt: at,
    updatedAt: at,
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
    id: fileId(input.id),
    ownerUserId: userId(input.ownerUserId),
    createdByUserId: userId(input.createdByUserId),
    bucket: fileBucket(input.bucket),
    objectKey: fileObjectKey(input.objectKey),
    originalName: originalFileName(input.originalName),
    contentType: fileContentType(input.contentType),
    byteSize: fileByteSize(input.byteSize),
    checksumSha256: fileChecksumSha256(input.checksumSha256),
    status: fileStatus(input.status),
    purpose: filePurpose(input.purpose),
    metadata: fileMetadata(input.metadata),
    uploadId: input.uploadId,
    retentionExpiresAt: input.retentionExpiresAt,
    deletedAt: input.deletedAt,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
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
    originalName: patch.originalName ?? file.originalName,
    purpose: patch.purpose ?? file.purpose,
    metadata: patch.metadata ?? file.metadata,
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
    status: "deleted",
    deletedAt: at,
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
