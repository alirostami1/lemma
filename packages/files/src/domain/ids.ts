import type { Brand } from "@lemma/domain";
import { assertUuid } from "./primitives.js";

export type FileId = Brand<string, "FileId">;
export type FileUploadId = Brand<string, "FileUploadId">;
export type UserId = Brand<string, "UserId">;

export function fileId(value: string): FileId {
  return assertUuid(value, "fileId") as FileId;
}

export function fileUploadId(value: string): FileUploadId {
  return assertUuid(value, "uploadId") as FileUploadId;
}

export function userId(value: string): UserId {
  return assertUuid(value, "userId") as UserId;
}
