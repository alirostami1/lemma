import type { Brand } from "@lemma/domain";
import { InvalidDomainValueError } from "./errors.js";
import {
  assertJsonObjectCompatible,
  assertMaxLength,
  assertNonEmptyString,
} from "./primitives.js";

export const MAX_ORIGINAL_FILE_NAME_LENGTH = 500;
export const MAX_FILE_BYTE_SIZE = 25 * 1024 * 1024;
export const UPLOAD_EXPIRES_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export const FILE_PURPOSE_ACCEPTED_VALUES = [
  "workbook",
  "workbook_editor_output",
] as const;

export const PUBLIC_FILE_PURPOSE_ACCEPTED_VALUES = ["workbook"] as const;

export const FILE_CONTENT_TYPE_ACCEPTED_VALUES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const FILE_STATUS_ACCEPTED_VALUES = [
  "uploaded",
  "deleting",
  "deleted",
] as const;

export const FILE_UPLOAD_STATUS_ACCEPTED_VALUES = [
  "initiated",
  "verified",
  "failed",
  "expired",
  "cancelled",
] as const;

export const VISIBLE_FILE_STATUSES = ["uploaded"] as const;
export const ACTIVE_FILE_STATUSES = ["uploaded", "deleting"] as const;

export type FileObjectKey = Brand<string, "FileObjectKey">;
export type FileBucket = Brand<string, "FileBucket">;
export type OriginalFileName = Brand<string, "OriginalFileName">;
export type FileContentType =
  (typeof FILE_CONTENT_TYPE_ACCEPTED_VALUES)[number];
export type FilePurpose = (typeof FILE_PURPOSE_ACCEPTED_VALUES)[number];
export type PublicFilePurpose =
  (typeof PUBLIC_FILE_PURPOSE_ACCEPTED_VALUES)[number];
export type FileStatus = (typeof FILE_STATUS_ACCEPTED_VALUES)[number];
export type FileUploadStatus =
  (typeof FILE_UPLOAD_STATUS_ACCEPTED_VALUES)[number];
export type FileChecksumSha256 = Brand<string, "FileChecksumSha256">;
export type FileMetadata = Brand<Record<string, unknown>, "FileMetadata">;

export function fileObjectKey(value: string): FileObjectKey {
  return assertNonEmptyString(value, "objectKey") as FileObjectKey;
}

export function fileBucket(value: string): FileBucket {
  return assertNonEmptyString(value, "bucket") as FileBucket;
}

export function originalFileName(value: string): OriginalFileName {
  const normalized = assertNonEmptyString(value, "originalName");
  return assertMaxLength(
    normalized,
    MAX_ORIGINAL_FILE_NAME_LENGTH,
    "originalName",
  ) as OriginalFileName;
}

export function fileContentType(value: string): FileContentType {
  if (!FILE_CONTENT_TYPE_ACCEPTED_VALUES.includes(value as FileContentType)) {
    throw new InvalidDomainValueError(
      `contentType should be one of ${FILE_CONTENT_TYPE_ACCEPTED_VALUES}`,
    );
  }
  return value as FileContentType;
}

export function filePurpose(value: string): FilePurpose {
  if (!FILE_PURPOSE_ACCEPTED_VALUES.includes(value as FilePurpose)) {
    throw new InvalidDomainValueError(
      `purpose should be one of ${FILE_PURPOSE_ACCEPTED_VALUES}`,
    );
  }
  return value as FilePurpose;
}

export function fileStatus(value: string): FileStatus {
  if (!FILE_STATUS_ACCEPTED_VALUES.includes(value as FileStatus)) {
    throw new InvalidDomainValueError(
      `file status should be one of ${FILE_STATUS_ACCEPTED_VALUES}`,
    );
  }
  return value as FileStatus;
}

export function fileUploadStatus(value: string): FileUploadStatus {
  if (!FILE_UPLOAD_STATUS_ACCEPTED_VALUES.includes(value as FileUploadStatus)) {
    throw new InvalidDomainValueError(
      `file upload status should be one of ${FILE_UPLOAD_STATUS_ACCEPTED_VALUES}`,
    );
  }
  return value as FileUploadStatus;
}

export function fileChecksumSha256(value: string): FileChecksumSha256 {
  const normalized = assertNonEmptyString(
    value,
    "checksumSha256",
  ).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new InvalidDomainValueError(
      "checksumSha256 must be a valid SHA-256 hex string.",
    );
  }
  return normalized as FileChecksumSha256;
}

export function fileMetadata(value: Record<string, unknown>): FileMetadata {
  return assertJsonObjectCompatible(value, "metadata") as FileMetadata;
}

export function fileByteSize(value: number): number {
  if (!Number.isInteger(value) || value <= 0 || value > MAX_FILE_BYTE_SIZE) {
    throw new InvalidDomainValueError(
      `byteSize must be > 0 and <= ${MAX_FILE_BYTE_SIZE}.`,
    );
  }
  return value;
}

export function uploadExpiresAt(at = new Date()): Date {
  return new Date(at.getTime() + UPLOAD_EXPIRES_IN_MILLISECONDS);
}

export function isVisibleFileStatus(status: FileStatus): boolean {
  return VISIBLE_FILE_STATUSES.includes(
    status as (typeof VISIBLE_FILE_STATUSES)[number],
  );
}
