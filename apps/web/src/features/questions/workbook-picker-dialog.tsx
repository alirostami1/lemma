import { Button } from "@lemma/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@lemma/ui/components/dialog";
import {
  formatSpreadsheetRange,
  SpreadsheetGrid,
  SpreadsheetSheetTabs,
  useSpreadsheetRangeSelection,
  useSpreadsheetSheet,
} from "@lemma/ui/components/spreadsheet";
import { useEffect, useMemo } from "react";
import type {
  WorkbookRangeSelection,
  WorkbookSelectionRequirement,
} from "#/features/questions/table-block-editor";
import {
  useWorkbookPickerCells,
  type WorkbookPickerSheet,
} from "./use-workbook-picker-cells";
import { WorkbookSelectionSummary } from "./workbook-selection-summary";
import {
  buildWorkbookRangeSelection,
  describeWorkbookSelectionRequirement,
  validateWorkbookRangeSelection,
} from "./workbook-validation";

const WORKBOOK_PICKER_ROW_COUNT = 50;

type WorkbookPickerDialogProps = {
  workbookSnapshotId?: string | null;
  workbookSheets?: WorkbookPickerSheet[];
  fileName: string;
  open: boolean;
  onOpenChange(open: boolean): void;
  selectionRequirement: WorkbookSelectionRequirement;
  onSelectRange(selection: WorkbookRangeSelection): void;
};

export function WorkbookPickerDialog({
  workbookSnapshotId,
  workbookSheets = [],
  fileName,
  open,
  onOpenChange,
  selectionRequirement,
  onSelectRange,
}: WorkbookPickerDialogProps) {
  const hasSource = Boolean(workbookSnapshotId);
  const sheetTabs = useMemo(
    () =>
      workbookSheets.map((sheet) => ({
        name: sheet.name,
        rows: [],
        columnCount: Math.min(sheet.columnCount, 20),
      })),
    [workbookSheets],
  );
  const { activeSheetName, setActiveSheetName } =
    useSpreadsheetSheet(sheetTabs);
  const activeSheetSummary =
    workbookSheets.find((sheet) => sheet.name === activeSheetName) ??
    workbookSheets[0] ??
    null;
  const cellsQuery = useWorkbookPickerCells({
    activeSheet: activeSheetSummary,
    open,
    workbookSnapshotId,
  });
  const sheets = useMemo(
    () =>
      workbookSheets.map((sheet) => ({
        name: sheet.name,
        rows:
          sheet.sheetIndex === cellsQuery.data?.sheetIndex
            ? cellsQuery.data.rows
            : [],
        columnCount:
          sheet.sheetIndex === cellsQuery.data?.sheetIndex
            ? cellsQuery.data.columnCount
            : Math.min(sheet.columnCount, 20),
      })),
    [cellsQuery.data, workbookSheets],
  );
  const activeSheet =
    sheets.find((sheet) => sheet.name === activeSheetName) ?? sheets[0] ?? null;
  const rangeSelection = useSpreadsheetRangeSelection();
  const workbookSelectionResetKey = `${fileName}:${activeSheetName}:${
    sheets.length
  }`;

  useEffect(() => {
    if (workbookSelectionResetKey) {
      rangeSelection.clearSelection();
    }
  }, [rangeSelection.clearSelection, workbookSelectionResetKey]);

  const columnCount = Math.max(activeSheet?.columnCount ?? 0, 1);
  const placeholderRows = useMemo(
    () =>
      Array.from({ length: WORKBOOK_PICKER_ROW_COUNT }, () =>
        Array.from({ length: columnCount }, () => ""),
      ),
    [columnCount],
  );
  const isActiveSheetLoading =
    activeSheet !== null && cellsQuery.isPending && !cellsQuery.data;
  const rows =
    activeSheet && activeSheet.rows.length > 0
      ? activeSheet.rows
      : placeholderRows;
  const selectionRange = rangeSelection.selectionRange;
  const selectionLabel =
    activeSheet && selectionRange
      ? formatSpreadsheetRange(activeSheet.name, selectionRange)
      : "No range selected";
  const selectedRange =
    activeSheet && selectionRange
      ? buildWorkbookRangeSelection(activeSheet.name, rows, selectionRange)
      : null;
  const selectionValidation = isActiveSheetLoading
    ? {
        ok: false,
        message: "Loading source cells.",
      }
    : selectedRange
      ? validateWorkbookRangeSelection(selectedRange, selectionRequirement)
      : {
          ok: false,
          message: "Select a source range first.",
        };
  const selectionRequirementLabel =
    describeWorkbookSelectionRequirement(selectionRequirement);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-workbook-picker-dialog="true"
        className="flex h-fit max-h-[92vh] w-fit max-w-[90vw] flex-col overflow-hidden p-0"
      >
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Source</DialogTitle>
          <DialogDescription>
            {fileName || "Upload a source before opening the picker."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col bg-muted/20">
          {!hasSource && fileName === "Selected source could not be found." ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-destructive">
              Selected source could not be found.
            </div>
          ) : !hasSource ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              {fileName ? "Loading source..." : "No source selected."}
            </div>
          ) : cellsQuery.isError ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-destructive">
              Source preview could not be loaded.
            </div>
          ) : activeSheet ? (
            <>
              <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-background px-5 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    Selected range
                  </p>
                  <p className="truncate font-mono text-sm">{selectionLabel}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Required: {selectionRequirementLabel}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!selectionRange}
                  onClick={rangeSelection.clearSelection}
                >
                  Clear
                </Button>
              </div>
              <SpreadsheetGrid
                columnCount={columnCount}
                rangeSelection={rangeSelection}
                rows={rows}
              />

              <SpreadsheetSheetTabs
                activeSheetName={activeSheetName}
                onActiveSheetNameChange={(sheetName) => {
                  setActiveSheetName(sheetName);
                  rangeSelection.clearSelection();
                }}
                sheets={sheets}
              />
              <WorkbookSelectionSummary
                selectedRange={selectedRange}
                selectionValidation={selectionValidation}
                onSelectRange={onSelectRange}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              This source has no sheets to preview.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
