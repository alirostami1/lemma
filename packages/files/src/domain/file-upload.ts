import { type Timestamped, touch } from "@lemma/domain";
import { FileUploadExpiredError, InvalidFileStateError } from "./errors.js";
import {
  type FileBucket,
  type FileChecksumSha256,
  type FileContentType,
  type FileMetadata,
  type FileObjectKey,
  type FilePurpose,
  type FileUploadStatus,
  fileBucket,
  fileByteSize,
  fileChecksumSha256,
  fileContentType,
  fileMetadata,
  fileObjectKey,
  filePurpose,
  fileUploadStatus,
  type OriginalFileName,
  originalFileName,
  uploadExpiresAt,
} from "./file-values.js";
import { type FileUploadId, fileUploadId, type UserId, userId } from "./ids.js";

export type FileUpload = Timestamped & {
  id: FileUploadId;
  createdByUserId: UserId;
  bucket: FileBucket;
  objectKey: FileObjectKey;
  originalName: OriginalFileName;
  contentType: FileContentType;
  expectedByteSize: number;
  checksumSha256: FileChecksumSha256;
  purpose: FilePurpose;
  status: FileUploadStatus;
  metadata: FileMetadata;
  uploadExpiresAt: Date;
  completedAt: Date | null;
  lastError: string | null;
};

export function createFileUploadSession(
  input: {
    id: string;
    createdByUserId: string;
    bucket: string;
    objectKey: string;
    originalName: string;
    contentType: string;
    expectedByteSize: number;
    checksumSha256: string;
    purpose: string;
    metadata?: Record<string, unknown>;
    uploadExpiresAt?: Date;
  },
  at = new Date(),
): FileUpload {
  const expiresAt = input.uploadExpiresAt ?? uploadExpiresAt(at);
  if (expiresAt <= at) {
    throw new FileUploadExpiredError("file uploads must expire in future");
  }

  return {
    id: fileUploadId(input.id),
    createdByUserId: userId(input.createdByUserId),
    bucket: fileBucket(input.bucket),
    objectKey: fileObjectKey(input.objectKey),
    originalName: originalFileName(input.originalName),
    contentType: fileContentType(input.contentType),
    expectedByteSize: fileByteSize(input.expectedByteSize),
    checksumSha256: fileChecksumSha256(input.checksumSha256),
    purpose: filePurpose(input.purpose),
    status: "initiated",
    metadata: fileMetadata(input.metadata ?? {}),
    uploadExpiresAt: expiresAt,
    completedAt: null,
    lastError: null,
    createdAt: at,
    updatedAt: at,
  };
}

export function reconstituteFileUpload(input: {
  id: string;
  createdByUserId: string;
  bucket: string;
  objectKey: string;
  originalName: string;
  contentType: string;
  expectedByteSize: number;
  checksumSha256: string;
  purpose: string;
  status: string;
  metadata: Record<string, unknown>;
  uploadExpiresAt: Date;
  completedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}): FileUpload {
  return {
    id: fileUploadId(input.id),
    createdByUserId: userId(input.createdByUserId),
    bucket: fileBucket(input.bucket),
    objectKey: fileObjectKey(input.objectKey),
    originalName: originalFileName(input.originalName),
    contentType: fileContentType(input.contentType),
    expectedByteSize: fileByteSize(input.expectedByteSize),
    checksumSha256: fileChecksumSha256(input.checksumSha256),
    purpose: filePurpose(input.purpose),
    status: fileUploadStatus(input.status),
    metadata: fileMetadata(input.metadata),
    uploadExpiresAt: input.uploadExpiresAt,
    completedAt: input.completedAt,
    lastError: input.lastError,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export function completeFileUploadSession(
  upload: FileUpload,
  at = new Date(),
): FileUpload {
  assertFileUploadCanBeCompleted(upload, at);
  return {
    ...touch(upload, at),
    status: "verified",
    completedAt: at,
    lastError: null,
  };
}

export function markFileUploadExpired(
  upload: FileUpload,
  reason: string,
  at = new Date(),
): FileUpload {
  if (upload.status !== "initiated" && upload.status !== "expired") {
    return upload;
  }

  return {
    ...touch(upload, at),
    status: "expired",
    lastError: reason,
  };
}

export function assertFileUploadCanBeCompleted(
  upload: FileUpload,
  at = new Date(),
): void {
  if (upload.status !== "initiated") {
    throw new InvalidFileStateError(
      "File upload cannot be completed from current status.",
    );
  }
  if (upload.uploadExpiresAt <= at) {
    throw new FileUploadExpiredError();
  }
}
