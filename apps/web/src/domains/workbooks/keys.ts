import type {
  GetWorkbookSnapshotCellsInput,
  GetWorkbookSnapshotRangeBatchInput,
  GetWorkbookSnapshotRangeInput,
  ListWorkbookCalculationsInput,
  ListWorkbookSnapshotSheetsInput,
  ListWorkbookSnapshotsInput,
  ListWorkbooksInput,
} from "./model";

type ListCalculationsKeyInput = Omit<
  ListWorkbookCalculationsInput,
  "workbookId"
>;
type ListSnapshotsKeyInput = Omit<
  ListWorkbookSnapshotsInput,
  "workbookCalculationId"
>;
type SnapshotSheetsKeyInput = Omit<
  ListWorkbookSnapshotSheetsInput,
  "workbookSnapshotId"
>;
type SnapshotCellsKeyInput = Omit<
  GetWorkbookSnapshotCellsInput,
  "workbookSnapshotId"
>;
type SnapshotRangeKeyInput = Omit<
  GetWorkbookSnapshotRangeInput,
  "workbookSnapshotId"
>;
type SnapshotRangeBatchKeyInput = Omit<
  GetWorkbookSnapshotRangeBatchInput,
  "workbookSnapshotId"
>;

export const workbookKeys = {
  all: ["workbooks"] as const,
  lists: () => [...workbookKeys.all, "list"] as const,
  list: (input?: ListWorkbooksInput) =>
    [...workbookKeys.lists(), input ?? {}] as const,
  infiniteList: (input?: Omit<ListWorkbooksInput, "cursor">) =>
    [...workbookKeys.lists(), "infinite", input ?? {}] as const,
  details: () => [...workbookKeys.all, "detail"] as const,
  detail: (workbookId: string) =>
    [...workbookKeys.details(), workbookId] as const,
  calculations: (workbookId: string) =>
    [...workbookKeys.detail(workbookId), "calculations"] as const,
  calculationsList: (workbookId: string, input?: ListCalculationsKeyInput) =>
    [...workbookKeys.calculations(workbookId), input ?? {}] as const,
  snapshots: (workbookCalculationId: string) =>
    [
      ...workbookKeys.all,
      "calculation",
      workbookCalculationId,
      "snapshots",
    ] as const,
  snapshotsList: (
    workbookCalculationId: string,
    input?: ListSnapshotsKeyInput,
  ) => [...workbookKeys.snapshots(workbookCalculationId), input ?? {}] as const,
  snapshotMetadata: (workbookSnapshotId: string) =>
    [...workbookKeys.all, "snapshot", workbookSnapshotId, "metadata"] as const,
  snapshotSheets: (
    workbookSnapshotId: string,
    input?: SnapshotSheetsKeyInput,
  ) =>
    [
      ...workbookKeys.all,
      "snapshot",
      workbookSnapshotId,
      "sheets",
      input ?? {},
    ] as const,
  snapshotCells: (workbookSnapshotId: string, input: SnapshotCellsKeyInput) =>
    [
      ...workbookKeys.all,
      "snapshot",
      workbookSnapshotId,
      "cells",
      input,
    ] as const,
  snapshotRange: (workbookSnapshotId: string, input?: SnapshotRangeKeyInput) =>
    [
      ...workbookKeys.all,
      "snapshot",
      workbookSnapshotId,
      "range",
      input ?? {},
    ] as const,
  snapshotRangeBatch: (
    workbookSnapshotId: string,
    input?: SnapshotRangeBatchKeyInput,
  ) =>
    [
      ...workbookKeys.all,
      "snapshot",
      workbookSnapshotId,
      "ranges",
      input ?? {},
    ] as const,
};
