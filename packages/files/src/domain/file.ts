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
  gcClaimedAt: Date | null;
  gcClaimToken: string | null;
};

export const DELETED_FILE_RETENTION_DAYS = 30;
export type FileGarbageCollectionClaimToken = string & {
  readonly __brand: "FileGarbageCollectionClaimToken";
};

export function fileGarbageCollectionClaimToken(
  value: string,
): FileGarbageCollectionClaimToken {
  if (value.trim().length === 0) {
    throw new InvalidFileStateError(
      "file garbage collection claim token must not be blank",
    );
  }
  return value as FileGarbageCollectionClaimToken;
}

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
    gcClaimedAt: null,
    gcClaimToken: null,
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
  gcClaimedAt: Date | null;
  gcClaimToken: string | null;
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
    gcClaimedAt: input.gcClaimedAt,
    gcClaimToken: input.gcClaimToken,
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
    metadata?: FileMetadata;
  },
  at = new Date(),
): File {
  assertFileIsVisible(file);

  return {
    ...touch(file, at),
    metadata: patch.metadata ?? file.metadata,
    originalName: patch.originalName ?? file.originalName,
  };
}

export function markFileDeleting(file: File, at = new Date()): File {
  if (file.status === "deleting") {
    return file;
  }
  if (file.status === "deleted") {
    throw new InvalidFileStateError(
      "file cannot be deleted from current state",
    );
  }

  return {
    ...touch(file, at),
    deletedAt: at,
    retentionExpiresAt: new Date(
      at.getTime() + DELETED_FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ),
    status: "deleting",
  };
}

export function markFileDeleted(file: File, at = new Date()): File {
  if (file.status === "deleted") {
    return file;
  }
  return {
    ...touch(file, at),
    deletedAt: file.deletedAt ?? at,
    gcClaimedAt: null,
    gcClaimToken: null,
    status: "deleted",
  };
}

export function claimFileGarbageCollection(
  file: File,
  claimToken: FileGarbageCollectionClaimToken,
  at: Date,
): File {
  if (file.status !== "deleting") {
    throw new InvalidFileStateError("only tombstoned files can be claimed");
  }
  return {
    ...touch(file, at),
    gcClaimedAt: at,
    gcClaimToken: claimToken,
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
