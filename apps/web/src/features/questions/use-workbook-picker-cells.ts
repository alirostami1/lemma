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
      workbookSnapshotId: input.workbookSnapshotId ?? "",
      sheetIndex: input.activeSheet?.sheetIndex ?? 0,
      startRow: input.startRow,
      startColumn: input.startColumn,
      rowCount: input.rowCount,
      columnCount: input.columnCount,
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
      workbookSnapshotId: input.workbookSnapshotId ?? "",
      ref: input.ref ?? "",
    },
    {
      retry: false,
      enabled:
        input.enabled !== false &&
        input.open &&
        Boolean(input.workbookSnapshotId) &&
        Boolean(input.ref),
    },
  );
}
