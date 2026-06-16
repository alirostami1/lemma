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
import { useEffect } from "react";
import type {
  WorkbookRangeSelection,
  WorkbookSelectionRequirement,
} from "#/features/questions/table-block-editor";
import { useWorkbookPreview } from "./use-workbook-preview";
import { WorkbookSelectionSummary } from "./workbook-selection-summary";
import {
  buildWorkbookRangeSelection,
  describeWorkbookSelectionRequirement,
  validateWorkbookRangeSelection,
} from "./workbook-validation";

type WorkbookPickerDialogProps = {
  file: File | null;
  fileName: string;
  open: boolean;
  onOpenChange(open: boolean): void;
  selectionRequirement: WorkbookSelectionRequirement;
  onSelectRange(selection: WorkbookRangeSelection): void;
};

export function WorkbookPickerDialog({
  file,
  fileName,
  open,
  onOpenChange,
  selectionRequirement,
  onSelectRange,
}: WorkbookPickerDialogProps) {
  const { workbook, status } = useWorkbookPreview(file, open);
  const sheets = workbook?.sheets ?? [];
  const { activeSheet, activeSheetName, setActiveSheetName } =
    useSpreadsheetSheet(sheets);
  const rangeSelection = useSpreadsheetRangeSelection();
  const workbookSelectionResetKey = `${status}:${workbook?.fileName ?? ""}:${
    sheets.length
  }`;

  useEffect(() => {
    if (workbookSelectionResetKey) {
      rangeSelection.clearSelection();
    }
  }, [rangeSelection.clearSelection, workbookSelectionResetKey]);

  const columnCount = Math.max(activeSheet?.columnCount ?? 0, 1);
  const rows = activeSheet?.rows ?? [];
  const selectionRange = rangeSelection.selectionRange;
  const selectionLabel =
    activeSheet && selectionRange
      ? formatSpreadsheetRange(activeSheet.name, selectionRange)
      : "No range selected";
  const selectedRange =
    activeSheet && selectionRange
      ? buildWorkbookRangeSelection(activeSheet.name, rows, selectionRange)
      : null;
  const selectionValidation = selectedRange
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
          {!file && fileName === "Selected source could not be found." ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-destructive">
              Selected source could not be found.
            </div>
          ) : !file ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              {fileName ? "Loading source..." : "No source selected."}
            </div>
          ) : status === "loading" ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              Loading source...
            </div>
          ) : status === "error" ? (
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
