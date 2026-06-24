import {
  useWorkbookSnapshotCellsQuery,
  useWorkbookSnapshotRangeQuery,
} from "#/domains/workbooks/hooks";
import type {
  WorkbookSnapshotCells,
  WorkbookSnapshotRange,
  WorkbookSnapshotSheet,
} from "#/domains/workbooks/model";

export type WorkbookPickerCells = WorkbookSnapshotCells;
export type WorkbookPickerRange = WorkbookSnapshotRange;
export type WorkbookPickerSheet = WorkbookSnapshotSheet;

export function useWorkbookPickerCells(input: {
  activeSheet: WorkbookPickerSheet | null;
  columnCount: number;
  open: boolean;
  rowCount: number;
  startColumn: number;
  startRow: number;
  workbookSnapshotId?: string | null;
}) {
  return useWorkbookSnapshotCellsQuery(
    {
      columnCount: input.columnCount,
      rowCount: input.rowCount,
      sheetIndex: input.activeSheet?.sheetIndex ?? 0,
      startColumn: input.startColumn,
      startRow: input.startRow,
      workbookSnapshotId: input.workbookSnapshotId ?? "",
    },
    {
      enabled:
        input.open &&
        Boolean(input.workbookSnapshotId) &&
        Boolean(input.activeSheet),
    },
  );
}

export function useWorkbookPickerRange(input: {
  enabled?: boolean;
  open: boolean;
  ref?: string | null;
  workbookSnapshotId?: string | null;
}) {
  return useWorkbookSnapshotRangeQuery(
    {
      ref: input.ref ?? "",
      workbookSnapshotId: input.workbookSnapshotId ?? "",
    },
    {
      enabled:
        input.enabled !== false &&
        input.open &&
        Boolean(input.workbookSnapshotId) &&
        Boolean(input.ref),
      retry: false,
    },
  );
}
