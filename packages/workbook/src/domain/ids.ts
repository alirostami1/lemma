import type { Brand } from "@lemma/domain";
import { assertUuid } from "./primitives.js";

export type WorkbookId = Brand<string, "WorkbookId">;
export type WorkbookCalculationId = Brand<string, "WorkbookCalculationId">;
export type WorkbookSnapshotId = Brand<string, "WorkbookSnapshotId">;
export type UserId = Brand<string, "UserId">;
export type FileId = Brand<string, "FileId">;

export function workbookId(value: string): WorkbookId {
  return assertUuid(value, "workbookId") as WorkbookId;
}

export function workbookCalculationId(value: string): WorkbookCalculationId {
  return assertUuid(value, "workbookCalculationId") as WorkbookCalculationId;
}

export function workbookSnapshotId(value: string): WorkbookSnapshotId {
  return assertUuid(value, "workbookSnapshotId") as WorkbookSnapshotId;
}

export function userId(value: string): UserId {
  return assertUuid(value, "userId") as UserId;
}

export function fileId(value: string): FileId {
  return assertUuid(value, "fileId") as FileId;
}
