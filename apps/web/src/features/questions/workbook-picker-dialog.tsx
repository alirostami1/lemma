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
import type { LocalWorkbookParseResult } from "#/domains/workbooks/local-xlsx";
import type { WorkbookCellType } from "#/domains/workbooks/model";
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
  localWorkbook?: LocalWorkbookParseResult | null;
  workbookSnapshotId?: string | null;
  workbookSheets?: WorkbookPickerSheet[];
  hasMoreSheets?: boolean;
  isLoadingMoreSheets?: boolean;
  fileName: string;
  sourceId: string | null;
  open: boolean;
  onOpenChange(open: boolean): void;
  onLoadMoreSheets?(): void;
  selectionRequirement: WorkbookSelectionRequirement;
  onSelectRange(selection: WorkbookRangeSelection): void;
};

export function WorkbookPickerDialog({
  localWorkbook,
  workbookSnapshotId,
  workbookSheets = [],
  hasMoreSheets = false,
  isLoadingMoreSheets = false,
  fileName,
  sourceId,
  open,
  onOpenChange,
  onLoadMoreSheets,
  selectionRequirement,
  onSelectRange,
}: WorkbookPickerDialogProps) {
  const localWorkbookSheets = useMemo(
    () =>
      localWorkbook?.sheets.map((sheet, index) => ({
        columnCount: sheet.columnCount,
        name: sheet.name,
        nonEmptyCellCount: 0,
        rowCount: sheet.rowCount,
        sheetIndex: index,
      })) ?? [],
    [localWorkbook],
  );
  const effectiveWorkbookSheets = localWorkbook
    ? localWorkbookSheets
    : workbookSheets;
  const hasSource = Boolean(workbookSnapshotId || localWorkbook);
  const sourceKey =
    workbookSnapshotId ??
    (localWorkbook ? `local:${localWorkbook.fileName}` : "");
  const sheetTabs = useMemo(
    () =>
      effectiveWorkbookSheets.map((sheet) => ({
        columnCount: Math.min(sheet.columnCount, WORKBOOK_PICKER_COLUMN_COUNT),
        name: sheet.name,
        rows: [],
      })),
    [effectiveWorkbookSheets],
  );
  const { activeSheetName, setActiveSheetName } =
    useSpreadsheetSheet(sheetTabs);
  const activeSheetSummary =
    effectiveWorkbookSheets.find((sheet) => sheet.name === activeSheetName) ??
    effectiveWorkbookSheets[0] ??
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
    sourceKey && activeSheetSummary
      ? `${sourceKey}:${activeSheetSummary.name}`
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
    if (localWorkbook && activeSheetSummary) {
      return {
        [activeSheetSummary.sheetIndex]: buildLocalWorkbookPickerCells({
          columnCount: WORKBOOK_PICKER_COLUMN_COUNT,
          rowCount: WORKBOOK_PICKER_ROW_COUNT,
          sheet: activeSheetSummary,
          startColumn: activeCellWindow.startColumn,
          startRow: activeCellWindow.startRow,
          workbook: localWorkbook,
        }),
      };
    }

    if (!cellsQuery.data) {
      return sourceCachedCellsBySheetIndex;
    }

    return {
      ...sourceCachedCellsBySheetIndex,
      [cellsQuery.data.sheetIndex]: cellsQuery.data,
    };
  }, [
    activeCellWindow.startColumn,
    activeCellWindow.startRow,
    activeSheetSummary,
    cellsQuery.data,
    localWorkbook,
    sourceCachedCellsBySheetIndex,
  ]);
  const sheets = useMemo(
    () =>
      effectiveWorkbookSheets.map((sheet) => {
        const sheetKey = sourceKey ? `${sourceKey}:${sheet.name}` : "";
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
          columnCount:
            cells?.columnCount ??
            Math.min(sheet.columnCount, WORKBOOK_PICKER_COLUMN_COUNT),
          name: sheet.name,
          rows: cells?.rows ?? [],
        };
      }),
    [
      cellWindowBySheetKey,
      cellsBySheetIndex,
      effectiveWorkbookSheets,
      sourceKey,
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
    activeSheet && selectionRange && sourceId !== null
      ? buildWorkbookRangeSelection(activeSheet.name, rows, selectionRange, {
          columnStartIndex: activeCellWindow.startColumn - 1,
          rowStartIndex: activeCellWindow.startRow - 1,
          sourceId,
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
        message: "Loading source cells.",
        ok: false,
      }
    : selectedRange
      ? validateWorkbookRangeSelection(selectedRange, selectionRequirement)
      : {
          message: "Select a source range first.",
          ok: false,
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

    const nextSheetSelectionKey = sourceKey ? `${sourceKey}:${sheetName}` : "";
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
    if (sourceId === null) {
      setSelectedRangeErrorMessage(
        "Select a source before selecting this range.",
      );
      return;
    }

    setSelectedRangeErrorMessage(null);
    setIsSelectingRange(true);

    try {
      if (localWorkbook) {
        onSelectRange({
          reference: selectedRange.reference,
          sourceId,
          values: selectedRange.values,
        });
        return;
      }

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
        sourceId,
        values: result.data.rows,
      });
    } catch {
      setSelectedRangeErrorMessage("Selected range could not be loaded.");
    } finally {
      setIsSelectingRange(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="flex h-[92vh] w-[90vw] max-w-[90vw] flex-col overflow-hidden p-0"
        data-workbook-picker-dialog="true"
      >
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Source</DialogTitle>
          <DialogDescription>
            {fileName || "Upload a source before opening the picker."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col bg-muted/20">
          {!hasSource && fileName === "Attached source could not be found." ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-destructive">
              Attached source could not be found.
            </div>
          ) : !hasSource ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              {fileName ? "Loading source..." : "No source selected."}
            </div>
          ) : cellsQuery.isError && !activeSheetCells ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-destructive">
              Source preview could not be loaded.
            </div>
          ) : effectiveWorkbookSheets.length === 0 ? (
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
                    aria-label="Previous rows"
                    disabled={isActiveSheetLoading || !canMoveRowsBackward}
                    onClick={() =>
                      updateActiveCellWindow({
                        rowDelta: -WORKBOOK_PICKER_ROW_COUNT,
                      })
                    }
                    size="icon-sm"
                    title="Previous rows"
                    type="button"
                    variant="outline"
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    aria-label="Next rows"
                    disabled={isActiveSheetLoading || !canMoveRowsForward}
                    onClick={() =>
                      updateActiveCellWindow({
                        rowDelta: WORKBOOK_PICKER_ROW_COUNT,
                      })
                    }
                    size="icon-sm"
                    title="Next rows"
                    type="button"
                    variant="outline"
                  >
                    <ChevronDown />
                  </Button>
                  <Button
                    aria-label="Previous columns"
                    disabled={isActiveSheetLoading || !canMoveColumnsBackward}
                    onClick={() =>
                      updateActiveCellWindow({
                        columnDelta: -WORKBOOK_PICKER_COLUMN_COUNT,
                      })
                    }
                    size="icon-sm"
                    title="Previous columns"
                    type="button"
                    variant="outline"
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    aria-label="Next columns"
                    disabled={isActiveSheetLoading || !canMoveColumnsForward}
                    onClick={() =>
                      updateActiveCellWindow({
                        columnDelta: WORKBOOK_PICKER_COLUMN_COUNT,
                      })
                    }
                    size="icon-sm"
                    title="Next columns"
                    type="button"
                    variant="outline"
                  >
                    <ChevronRight />
                  </Button>
                  <Button
                    disabled={!selectionRange || isActiveSheetLoading}
                    onClick={rangeSelection.clearSelection}
                    size="sm"
                    type="button"
                    variant="ghost"
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

              <div className="flex shrink-0 items-center border-t bg-background">
                <SpreadsheetSheetTabs
                  activeSheetName={activeSheetName}
                  className="min-w-0 flex-1 border-t-0"
                  onActiveSheetNameChange={handleActiveSheetNameChange}
                  sheets={sheets}
                />
                {hasMoreSheets ? (
                  <div className="shrink-0 border-l px-2">
                    <Button
                      disabled={isLoadingMoreSheets}
                      onClick={onLoadMoreSheets}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {isLoadingMoreSheets ? (
                        <Spinner className="size-3" />
                      ) : null}
                      More sheets
                    </Button>
                  </div>
                ) : null}
              </div>
              <WorkbookSelectionSummary
                isSelectingRange={isSelectingRange}
                onSelectRange={handleSelectRange}
                selectedRange={selectedRange}
                selectedRangeErrorMessage={
                  selectedRangeErrorMessage ??
                  (sourceId === null
                    ? "Select a source before selecting this range."
                    : null)
                }
                selectionValidation={selectionValidation}
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
      endColumnIndex: range.startColumn - 1,
      endRowIndex: range.startRow - 1,
      startColumnIndex: range.startColumn - 1,
      startRowIndex: range.startRow - 1,
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

export function buildLocalWorkbookPickerCells(input: {
  workbook: LocalWorkbookParseResult;
  sheet: WorkbookPickerSheet;
  startColumn: number;
  startRow: number;
  columnCount: number;
  rowCount: number;
}): WorkbookPickerCells {
  const rows: string[][] = [];
  const cellTypes: WorkbookCellType[][] = [];

  for (
    let rowIndex = input.startRow;
    rowIndex < input.startRow + input.rowCount;
    rowIndex += 1
  ) {
    const row: string[] = [];
    const rowCellTypes: WorkbookCellType[] = [];

    for (
      let columnIndex = input.startColumn;
      columnIndex < input.startColumn + input.columnCount;
      columnIndex += 1
    ) {
      const address = `${spreadsheetColumnName(columnIndex - 1)}${rowIndex}`;
      const cell =
        input.workbook.cellsByKey.get(
          `${input.sheet.name}::${address.toUpperCase()}`,
        ) ?? null;

      row.push(cell?.displayValue ?? "");
      rowCellTypes.push(mapLocalWorkbookCellType(cell?.type ?? "blank"));
    }

    rows.push(row);
    cellTypes.push(rowCellTypes);
  }

  return {
    cellTypes,
    columnCount: input.columnCount,
    rowCount: input.rowCount,
    rows,
    sheetIndex: input.sheet.sheetIndex,
    sheetName: input.sheet.name,
    startColumn: input.startColumn,
    startRow: input.startRow,
  };
}

function mapLocalWorkbookCellType(
  type:
    | "blank"
    | "string"
    | "number"
    | "boolean"
    | "date"
    | "error"
    | "formula"
    | "unknown",
): WorkbookCellType {
  switch (type) {
    case "blank":
      return "blank";
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "date":
      return "date_like";
    case "error":
      return "error";
    case "formula":
      return "formula_cached";
    case "unknown":
      return "blank";
  }
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
