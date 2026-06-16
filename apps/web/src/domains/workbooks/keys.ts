import type {
  ListWorkbookCalculationsInput,
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
};
