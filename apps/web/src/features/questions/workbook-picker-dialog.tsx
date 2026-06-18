import { Button } from "@lemma/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@lemma/ui/components/dialog";
import { Skeleton } from "@lemma/ui/components/skeleton";
import { Spinner } from "@lemma/ui/components/spinner";
import {
  formatSpreadsheetRange,
  type SpreadsheetCellPoint,
  type SpreadsheetCellRange,
  SpreadsheetGrid,
  SpreadsheetSheetTabs,
  spreadsheetColumnName,
  useSpreadsheetRangeSelection,
  useSpreadsheetSheet,
} from "@lemma/ui/components/spreadsheet";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  WorkbookRangeSelection,
  WorkbookSelectionRequirement,
} from "#/features/questions/table-block-editor";
import {
  useWorkbookPickerCells,
  useWorkbookPickerRange,
  type WorkbookPickerCells,
  type WorkbookPickerRange,
  type WorkbookPickerSheet,
} from "./use-workbook-picker-cells";
import { WorkbookSelectionSummary } from "./workbook-selection-summary";
import {
  buildWorkbookRangeSelection,
  describeWorkbookSelectionRequirement,
  validateWorkbookRangeSelection,
} from "./workbook-validation";

const WORKBOOK_PICKER_ROW_COUNT = 50;
const WORKBOOK_PICKER_COLUMN_COUNT = 20;

type WorkbookPickerCellCache = {
  cellsBySheetIndex: Record<number, WorkbookPickerCells>;
  sourceKey: string;
};

type WorkbookPickerCellWindow = {
  startColumn: number;
  startRow: number;
};

const EMPTY_WORKBOOK_PICKER_CELLS_BY_SHEET_INDEX: Record<
  number,
  WorkbookPickerCells
> = {};
const DEFAULT_WORKBOOK_PICKER_CELL_WINDOW = {
  startColumn: 1,
  startRow: 1,
} satisfies WorkbookPickerCellWindow;

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
  const sourceKey = workbookSnapshotId ?? "";
  const sheetTabs = useMemo(
    () =>
      workbookSheets.map((sheet) => ({
        name: sheet.name,
        rows: [],
        columnCount: Math.min(sheet.columnCount, WORKBOOK_PICKER_COLUMN_COUNT),
      })),
    [workbookSheets],
  );
  const { activeSheetName, setActiveSheetName } =
    useSpreadsheetSheet(sheetTabs);
  const activeSheetSummary =
    workbookSheets.find((sheet) => sheet.name === activeSheetName) ??
    workbookSheets[0] ??
    null;
  const [cachedCellsCache, setCachedCellsCache] =
    useState<WorkbookPickerCellCache>({
      cellsBySheetIndex: {},
      sourceKey: "",
    });
  const [cellWindowBySheetKey, setCellWindowBySheetKey] = useState<
    Record<string, WorkbookPickerCellWindow>
  >({});
  const sheetSelectionKey =
    workbookSnapshotId && activeSheetSummary
      ? `${workbookSnapshotId}:${activeSheetSummary.name}`
      : "";
  const activeSheetRowCount = Math.max(activeSheetSummary?.rowCount ?? 1, 1);
  const activeSheetColumnCount = Math.max(
    activeSheetSummary?.columnCount ?? 1,
    1,
  );
  const maxRowStart = Math.max(
    1,
    activeSheetRowCount - WORKBOOK_PICKER_ROW_COUNT + 1,
  );
  const maxColumnStart = Math.max(
    1,
    activeSheetColumnCount - WORKBOOK_PICKER_COLUMN_COUNT + 1,
  );
  const storedActiveCellWindow = getWorkbookPickerCellWindow(
    cellWindowBySheetKey,
    sheetSelectionKey,
  );
  const activeCellWindow = clampWorkbookPickerCellWindow(
    storedActiveCellWindow,
    activeSheetRowCount,
    activeSheetColumnCount,
  );
  const sourceCachedCellsBySheetIndex =
    cachedCellsCache.sourceKey === sourceKey
      ? cachedCellsCache.cellsBySheetIndex
      : EMPTY_WORKBOOK_PICKER_CELLS_BY_SHEET_INDEX;
  const cellsQuery = useWorkbookPickerCells({
    activeSheet: activeSheetSummary,
    columnCount: WORKBOOK_PICKER_COLUMN_COUNT,
    open,
    rowCount: WORKBOOK_PICKER_ROW_COUNT,
    startColumn: activeCellWindow.startColumn,
    startRow: activeCellWindow.startRow,
    workbookSnapshotId,
  });
  const cellsBySheetIndex = useMemo(() => {
    if (!cellsQuery.data) {
      return sourceCachedCellsBySheetIndex;
    }

    return {
      ...sourceCachedCellsBySheetIndex,
      [cellsQuery.data.sheetIndex]: cellsQuery.data,
    };
  }, [cellsQuery.data, sourceCachedCellsBySheetIndex]);
  const sheets = useMemo(
    () =>
      workbookSheets.map((sheet) => {
        const sheetKey = workbookSnapshotId
          ? `${workbookSnapshotId}:${sheet.name}`
          : "";
        const sheetWindow = clampWorkbookPickerCellWindow(
          getWorkbookPickerCellWindow(cellWindowBySheetKey, sheetKey),
          sheet.rowCount,
          sheet.columnCount,
        );
        const cachedCells = cellsBySheetIndex[sheet.sheetIndex];
        const cells = workbookPickerCellsMatchWindow(cachedCells, sheetWindow)
          ? cachedCells
          : undefined;

        return {
          name: sheet.name,
          rows: cells?.rows ?? [],
          columnCount:
            cells?.columnCount ??
            Math.min(sheet.columnCount, WORKBOOK_PICKER_COLUMN_COUNT),
        };
      }),
    [
      cellWindowBySheetKey,
      cellsBySheetIndex,
      workbookSheets,
      workbookSnapshotId,
    ],
  );
  const activeSheet =
    sheets.find((sheet) => sheet.name === activeSheetName) ?? sheets[0] ?? null;
  const rangeSelection = useSpreadsheetRangeSelection();
  const selectionBySheetKeyRef = useRef<
    Record<string, SpreadsheetCellRange | null>
  >({});
  const skipNextSelectionSaveRef = useRef(false);
  const cachedActiveSheetCells =
    activeSheetSummary === null
      ? undefined
      : cellsBySheetIndex[activeSheetSummary.sheetIndex];
  const activeSheetCells = workbookPickerCellsMatchWindow(
    cachedActiveSheetCells,
    activeCellWindow,
  )
    ? cachedActiveSheetCells
    : undefined;

  useEffect(() => {
    skipNextSelectionSaveRef.current = true;
    selectionBySheetKeyRef.current = {};
    setCachedCellsCache({
      cellsBySheetIndex: {},
      sourceKey,
    });
    setCellWindowBySheetKey({});
    rangeSelection.clearSelection();
  }, [rangeSelection.clearSelection, sourceKey]);

  useEffect(() => {
    if (!cellsQuery.data) {
      return;
    }

    setCachedCellsCache((currentCache) => {
      const currentCells =
        currentCache.sourceKey === sourceKey
          ? currentCache.cellsBySheetIndex
          : {};

      if (currentCells[cellsQuery.data.sheetIndex] === cellsQuery.data) {
        return currentCache;
      }

      return {
        cellsBySheetIndex: {
          ...currentCells,
          [cellsQuery.data.sheetIndex]: cellsQuery.data,
        },
        sourceKey,
      };
    });
  }, [cellsQuery.data, sourceKey]);

  useEffect(() => {
    if (!sheetSelectionKey) {
      return;
    }

    if (skipNextSelectionSaveRef.current) {
      skipNextSelectionSaveRef.current = false;
      return;
    }

    const currentSelection =
      selectionBySheetKeyRef.current[sheetSelectionKey] ?? null;
    if (
      areSpreadsheetRangesEqual(currentSelection, rangeSelection.selectionRange)
    ) {
      return;
    }

    selectionBySheetKeyRef.current = {
      ...selectionBySheetKeyRef.current,
      [sheetSelectionKey]: rangeSelection.selectionRange,
    };
  }, [rangeSelection.selectionRange, sheetSelectionKey]);

  const columnCount = Math.max(activeSheet?.columnCount ?? 0, 1);
  const placeholderRows = useMemo(
    () =>
      Array.from({ length: WORKBOOK_PICKER_ROW_COUNT }, () =>
        Array.from({ length: columnCount }, () => ""),
      ),
    [columnCount],
  );
  const isActiveSheetLoading =
    activeSheetSummary !== null && !activeSheetCells && cellsQuery.isPending;
  const isActiveSheetBusy =
    activeSheetSummary !== null &&
    cellsQuery.isFetching &&
    !cellsQuery.isError &&
    (!cellsQuery.data ||
      cellsQuery.data.sheetIndex === activeSheetSummary.sheetIndex);
  const rows =
    activeSheet && activeSheet.rows.length > 0
      ? activeSheet.rows
      : placeholderRows;
  const selectionRange = rangeSelection.selectionRange;
  const previewSelectedRange =
    activeSheet && selectionRange
      ? buildWorkbookRangeSelection(activeSheet.name, rows, selectionRange, {
          columnStartIndex: activeCellWindow.startColumn - 1,
          rowStartIndex: activeCellWindow.startRow - 1,
        })
      : null;
  const selectedRangeReference = previewSelectedRange?.reference ?? null;
  const selectedRangeQuery = useWorkbookPickerRange({
    enabled: false,
    open,
    ref: selectedRangeReference,
    workbookSnapshotId,
  });
  const [selectedRangeErrorMessage, setSelectedRangeErrorMessage] = useState<
    string | null
  >(null);
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const selectedRange = previewSelectedRange;
  const selectionLabel = selectedRangeReference ?? "No range selected";
  const visibleWindowEndRow = Math.min(
    activeSheetRowCount,
    activeCellWindow.startRow + WORKBOOK_PICKER_ROW_COUNT - 1,
  );
  const visibleWindowEndColumnIndex =
    Math.min(
      activeSheetColumnCount,
      activeCellWindow.startColumn + WORKBOOK_PICKER_COLUMN_COUNT - 1,
    ) - 1;
  const visibleWindowLabel = `Rows ${
    activeCellWindow.startRow
  }-${visibleWindowEndRow} · Columns ${spreadsheetColumnName(
    activeCellWindow.startColumn - 1,
  )}-${spreadsheetColumnName(visibleWindowEndColumnIndex)}`;
  const canMoveRowsBackward =
    activeSheetSummary !== null && activeCellWindow.startRow > 1;
  const canMoveRowsForward =
    activeSheetSummary !== null && activeCellWindow.startRow < maxRowStart;
  const canMoveColumnsBackward =
    activeSheetSummary !== null && activeCellWindow.startColumn > 1;
  const canMoveColumnsForward =
    activeSheetSummary !== null &&
    activeCellWindow.startColumn < maxColumnStart;
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

  useEffect(() => {
    setSelectedRangeErrorMessage(null);
  }, [selectedRangeReference]);

  const updateActiveCellWindow = ({
    columnDelta = 0,
    rowDelta = 0,
  }: {
    columnDelta?: number;
    rowDelta?: number;
  }) => {
    if (!sheetSelectionKey) {
      return;
    }

    const nextWindow = {
      startColumn: clampNumber(
        activeCellWindow.startColumn + columnDelta,
        1,
        maxColumnStart,
      ),
      startRow: clampNumber(
        activeCellWindow.startRow + rowDelta,
        1,
        maxRowStart,
      ),
    };

    if (
      nextWindow.startColumn === activeCellWindow.startColumn &&
      nextWindow.startRow === activeCellWindow.startRow
    ) {
      return;
    }

    selectionBySheetKeyRef.current = {
      ...selectionBySheetKeyRef.current,
      [sheetSelectionKey]: null,
    };
    rangeSelection.clearSelection();
    setCellWindowBySheetKey((currentWindows) => ({
      ...currentWindows,
      [sheetSelectionKey]: nextWindow,
    }));
  };
  const handleActiveSheetNameChange = (sheetName: string) => {
    if (sheetSelectionKey) {
      selectionBySheetKeyRef.current = {
        ...selectionBySheetKeyRef.current,
        [sheetSelectionKey]: rangeSelection.selectionRange,
      };
    }

    const nextSheetSelectionKey = workbookSnapshotId
      ? `${workbookSnapshotId}:${sheetName}`
      : "";
    rangeSelection.setSelectionRange(
      nextSheetSelectionKey
        ? (selectionBySheetKeyRef.current[nextSheetSelectionKey] ?? null)
        : null,
    );
    setActiveSheetName(sheetName);
  };
  const handleSelectRange = async () => {
    if (!selectedRange) {
      return;
    }

    setSelectedRangeErrorMessage(null);
    setIsSelectingRange(true);

    try {
      const result = await selectedRangeQuery.refetch();

      if (!result.data) {
        setSelectedRangeErrorMessage("Selected range could not be loaded.");
        return;
      }

      onSelectRange({
        reference: getWorkbookPickerSelectionReference(
          result.data,
          selectionRequirement,
        ),
        values: result.data.rows,
      });
    } catch {
      setSelectedRangeErrorMessage("Selected range could not be loaded.");
    } finally {
      setIsSelectingRange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-workbook-picker-dialog="true"
        className="flex h-[92vh] w-[90vw] max-w-[90vw] flex-col overflow-hidden p-0"
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
          ) : cellsQuery.isError && !activeSheetCells ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-destructive">
              Source preview could not be loaded.
            </div>
          ) : workbookSheets.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              Loading source...
            </div>
          ) : activeSheet ? (
            <>
              <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-background px-5 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Selected range
                    </p>
                    {isActiveSheetBusy && (
                      <Spinner className="size-3 text-muted-foreground" />
                    )}
                  </div>
                  <p className="truncate font-mono text-sm">{selectionLabel}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Required: {selectionRequirementLabel}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {visibleWindowLabel}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Previous rows"
                    title="Previous rows"
                    disabled={isActiveSheetLoading || !canMoveRowsBackward}
                    onClick={() =>
                      updateActiveCellWindow({
                        rowDelta: -WORKBOOK_PICKER_ROW_COUNT,
                      })
                    }
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Next rows"
                    title="Next rows"
                    disabled={isActiveSheetLoading || !canMoveRowsForward}
                    onClick={() =>
                      updateActiveCellWindow({
                        rowDelta: WORKBOOK_PICKER_ROW_COUNT,
                      })
                    }
                  >
                    <ChevronDown />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Previous columns"
                    title="Previous columns"
                    disabled={isActiveSheetLoading || !canMoveColumnsBackward}
                    onClick={() =>
                      updateActiveCellWindow({
                        columnDelta: -WORKBOOK_PICKER_COLUMN_COUNT,
                      })
                    }
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Next columns"
                    title="Next columns"
                    disabled={isActiveSheetLoading || !canMoveColumnsForward}
                    onClick={() =>
                      updateActiveCellWindow({
                        columnDelta: WORKBOOK_PICKER_COLUMN_COUNT,
                      })
                    }
                  >
                    <ChevronRight />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!selectionRange || isActiveSheetLoading}
                    onClick={rangeSelection.clearSelection}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <SpreadsheetGrid
                columnCount={columnCount}
                columnStartIndex={activeCellWindow.startColumn - 1}
                rangeSelection={
                  isActiveSheetLoading ? undefined : rangeSelection
                }
                renderCell={(_, point) =>
                  isActiveSheetLoading ? (
                    <WorkbookPickerCellSkeleton point={point} />
                  ) : undefined
                }
                rowStartIndex={activeCellWindow.startRow - 1}
                rows={rows}
              />

              <SpreadsheetSheetTabs
                activeSheetName={activeSheetName}
                onActiveSheetNameChange={handleActiveSheetNameChange}
                sheets={sheets}
              />
              <WorkbookSelectionSummary
                isSelectingRange={isSelectingRange}
                selectedRangeErrorMessage={selectedRangeErrorMessage}
                selectedRange={selectedRange}
                selectionValidation={selectionValidation}
                onSelectRange={handleSelectRange}
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

function WorkbookPickerCellSkeleton({
  point,
}: {
  point: SpreadsheetCellPoint;
}) {
  const widthClassNames = ["w-4/5", "w-2/3", "w-1/2", "w-3/4"];
  const widthClassName =
    widthClassNames[
      (point.rowIndex + point.columnIndex) % widthClassNames.length
    ] ?? "w-2/3";

  return <Skeleton className={`h-3 ${widthClassName}`} />;
}

function getWorkbookPickerSelectionReference(
  range: WorkbookPickerRange,
  requirement: WorkbookSelectionRequirement,
) {
  if (
    requirement.selectionType === "cell" &&
    range.rowCount === 1 &&
    range.columnCount === 1
  ) {
    return formatSpreadsheetRange(range.sheetName, {
      startRowIndex: range.startRow - 1,
      endRowIndex: range.startRow - 1,
      startColumnIndex: range.startColumn - 1,
      endColumnIndex: range.startColumn - 1,
    });
  }

  return range.ref;
}

function areSpreadsheetRangesEqual(
  left: SpreadsheetCellRange | null,
  right: SpreadsheetCellRange | null,
) {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return (
    left.startRowIndex === right.startRowIndex &&
    left.endRowIndex === right.endRowIndex &&
    left.startColumnIndex === right.startColumnIndex &&
    left.endColumnIndex === right.endColumnIndex
  );
}

function workbookPickerCellsMatchWindow(
  cells: WorkbookPickerCells | undefined,
  window: WorkbookPickerCellWindow,
): cells is WorkbookPickerCells {
  return (
    cells !== undefined &&
    cells.startRow === window.startRow &&
    cells.startColumn === window.startColumn
  );
}

function getWorkbookPickerCellWindow(
  windowsBySheetKey: Record<string, WorkbookPickerCellWindow>,
  sheetKey: string,
) {
  return sheetKey
    ? (windowsBySheetKey[sheetKey] ?? DEFAULT_WORKBOOK_PICKER_CELL_WINDOW)
    : DEFAULT_WORKBOOK_PICKER_CELL_WINDOW;
}

function clampWorkbookPickerCellWindow(
  window: WorkbookPickerCellWindow,
  rowCount: number,
  columnCount: number,
) {
  const maxRowStart = Math.max(
    1,
    Math.max(rowCount, 1) - WORKBOOK_PICKER_ROW_COUNT + 1,
  );
  const maxColumnStart = Math.max(
    1,
    Math.max(columnCount, 1) - WORKBOOK_PICKER_COLUMN_COUNT + 1,
  );

  return {
    startColumn: clampNumber(window.startColumn, 1, maxColumnStart),
    startRow: clampNumber(window.startRow, 1, maxRowStart),
  };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
