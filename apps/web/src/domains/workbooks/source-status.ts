import type { Workbook } from "./model";

export type WorkbookSourceStatus =
  | "ready"
  | "pending_validation"
  | "invalid"
  | "archived"
  | "deleted"
  | "unknown";

export function getWorkbookSourceStatus(
  workbook: Workbook,
): WorkbookSourceStatus {
  switch (workbook.status) {
    case "valid":
      return "ready";
    case "pending_validation":
    case "invalid":
    case "archived":
    case "deleted":
      return workbook.status;
    default:
      return "unknown";
  }
}

export function isWorkbookUsableAsSource(workbook: Workbook): boolean {
  return getWorkbookSourceStatus(workbook) === "ready";
}
