import { useWorkbookSnapshotCellsQuery } from "#/domains/workbooks/hooks";
import type { WorkbookSnapshotSheet } from "#/domains/workbooks/model";

export type WorkbookPickerSheet = WorkbookSnapshotSheet;

export function useWorkbookPickerCells(input: {
  activeSheet: WorkbookPickerSheet | null;
  open: boolean;
  workbookSnapshotId?: string | null;
}) {
  return useWorkbookSnapshotCellsQuery(
    {
      workbookSnapshotId: input.workbookSnapshotId ?? "",
      sheetIndex: input.activeSheet?.sheetIndex ?? 0,
      startRow: 1,
      startColumn: 1,
      rowCount: 50,
      columnCount: 20,
    },
    {
      enabled:
        input.open &&
        Boolean(input.workbookSnapshotId) &&
        Boolean(input.activeSheet),
    },
  );
}
