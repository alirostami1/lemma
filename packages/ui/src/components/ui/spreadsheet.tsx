import { FileSpreadsheet } from "lucide-react";
import {
  type ComponentProps,
  Fragment,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { InputGroup } from "#/components/ui/input-group";
import { cn } from "#/lib/utils";

export type SpreadsheetSheet = {
  name: string;
  rows: string[][];
  columnCount?: number;
};

export type SpreadsheetCellPoint = {
  rowIndex: number;
  columnIndex: number;
};

export type SpreadsheetCellRange = {
  startRowIndex: number;
  endRowIndex: number;
  startColumnIndex: number;
  endColumnIndex: number;
};

type PointerPosition = {
  clientX: number;
  clientY: number;
};

type SpreadsheetRangeSelectionOptions = {
  enabled?: boolean;
  onSelectionChange?: (range: SpreadsheetCellRange | null) => void;
};

export type SpreadsheetCellRenderContext = {
  point: SpreadsheetCellPoint;
  selected: boolean;
  value: string;
};

export type SpreadsheetEditableCellRenderContext =
  SpreadsheetCellRenderContext & {
    onValueChange(value: string): void;
  };

export function useSpreadsheetSheet(
  sheets: SpreadsheetSheet[],
  initialSheetName = "",
) {
  const [activeSheetName, setActiveSheetName] = useState(initialSheetName);
  const activeSheet =
    sheets.find((sheet) => sheet.name === activeSheetName) ?? sheets[0] ?? null;

  useEffect(() => {
    if (!activeSheetName) {
      return;
    }

    if (!sheets.some((sheet) => sheet.name === activeSheetName)) {
      setActiveSheetName(sheets[0]?.name ?? "");
    }
  }, [activeSheetName, sheets]);

  return {
    activeSheet,
    activeSheetName: activeSheet?.name ?? activeSheetName,
    setActiveSheetName,
  };
}

export function useSpreadsheetRangeSelection({
  enabled = true,
  onSelectionChange,
}: SpreadsheetRangeSelectionOptions = {}) {
  const [selectionStart, setSelectionStart] =
    useState<SpreadsheetCellPoint | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<SpreadsheetCellPoint | null>(
    null,
  );
  const [isSelecting, setIsSelecting] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<PointerPosition | null>(null);
  const frameRef = useRef<number | null>(null);

  const selectionRange = useMemo(
    () =>
      selectionStart && selectionEnd
        ? normalizeSpreadsheetRange(selectionStart, selectionEnd)
        : null,
    [selectionEnd, selectionStart],
  );

  useEffect(() => {
    onSelectionChange?.(selectionRange);
  }, [onSelectionChange, selectionRange]);

  useEffect(() => {
    if (!enabled) {
      setSelectionStart(null);
      setSelectionEnd(null);
      setIsSelecting(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!isSelecting) {
      return;
    }

    const stopSelection = () => {
      setIsSelecting(false);
    };

    window.addEventListener("mouseup", stopSelection);
    window.addEventListener("blur", stopSelection);

    return () => {
      window.removeEventListener("mouseup", stopSelection);
      window.removeEventListener("blur", stopSelection);
    };
  }, [isSelecting]);

  useEffect(() => {
    if (!isSelecting) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return;
    }

    const edgeSize = 56;
    const maxScrollSpeed = 28;

    const updateSelectionFromPointer = () => {
      const pointer = pointerRef.current;
      if (!pointer) {
        frameRef.current = requestAnimationFrame(updateSelectionFromPointer);
        return;
      }

      const viewport = viewportRef.current;
      if (viewport) {
        const rect = viewport.getBoundingClientRect();
        const leftDistance = pointer.clientX - rect.left;
        const rightDistance = rect.right - pointer.clientX;
        const topDistance = pointer.clientY - rect.top;
        const bottomDistance = rect.bottom - pointer.clientY;

        const scrollLeft =
          leftDistance < edgeSize
            ? -Math.ceil(
                ((edgeSize - leftDistance) / edgeSize) * maxScrollSpeed,
              )
            : rightDistance < edgeSize
              ? Math.ceil(
                  ((edgeSize - rightDistance) / edgeSize) * maxScrollSpeed,
                )
              : 0;
        const scrollTop =
          topDistance < edgeSize
            ? -Math.ceil(((edgeSize - topDistance) / edgeSize) * maxScrollSpeed)
            : bottomDistance < edgeSize
              ? Math.ceil(
                  ((edgeSize - bottomDistance) / edgeSize) * maxScrollSpeed,
                )
              : 0;

        if (scrollLeft !== 0 || scrollTop !== 0) {
          viewport.scrollBy({ left: scrollLeft, top: scrollTop });
        }
      }

      const cell = document
        .elementFromPoint(pointer.clientX, pointer.clientY)
        ?.closest<HTMLElement>("[data-spreadsheet-cell]");

      if (cell?.dataset.rowIndex && cell.dataset.columnIndex) {
        setSelectionEnd({
          columnIndex: Number(cell.dataset.columnIndex),
          rowIndex: Number(cell.dataset.rowIndex),
        });
      }

      frameRef.current = requestAnimationFrame(updateSelectionFromPointer);
    };

    frameRef.current = requestAnimationFrame(updateSelectionFromPointer);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [isSelecting]);

  const clearSelection = useCallback(() => {
    setSelectionStart(null);
    setSelectionEnd(null);
    setIsSelecting(false);
  }, []);

  const setSelectionRange = useCallback(
    (range: SpreadsheetCellRange | null) => {
      if (!range) {
        clearSelection();
        return;
      }

      setSelectionStart({
        columnIndex: range.startColumnIndex,
        rowIndex: range.startRowIndex,
      });
      setSelectionEnd({
        columnIndex: range.endColumnIndex,
        rowIndex: range.endRowIndex,
      });
      setIsSelecting(false);
    },
    [clearSelection],
  );

  const updatePointer = useCallback(
    (event: MouseEvent) => {
      if (!enabled || !isSelecting) {
        return;
      }

      pointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
    },
    [enabled, isSelecting],
  );

  const getCellProps = useCallback(
    (point: SpreadsheetCellPoint) => ({
      "data-column-index": point.columnIndex,
      "data-row-index": point.rowIndex,
      "data-spreadsheet-cell": true,
      onMouseDown: (event: MouseEvent) => {
        if (
          !enabled ||
          isInteractiveSpreadsheetDescendant(event.target, event.currentTarget)
        ) {
          return;
        }

        event.preventDefault();
        pointerRef.current = {
          clientX: event.clientX,
          clientY: event.clientY,
        };
        setSelectionStart(point);
        setSelectionEnd(point);
        setIsSelecting(true);
      },
      onMouseEnter: (event: MouseEvent) => {
        if (
          !enabled ||
          !isSelecting ||
          isInteractiveSpreadsheetDescendant(event.target, event.currentTarget)
        ) {
          return;
        }

        pointerRef.current = {
          clientX: event.clientX,
          clientY: event.clientY,
        };
        setSelectionEnd(point);
      },
    }),
    [enabled, isSelecting],
  );

  const viewportProps = useMemo(
    () => ({
      onMouseLeave: updatePointer,
      onMouseMove: updatePointer,
      ref: viewportRef,
    }),
    [updatePointer],
  );

  return {
    clearSelection,
    getCellProps,
    isSelecting,
    selectionEnd,
    selectionRange,
    selectionStart,
    setSelectionRange,
    viewportProps,
  };
}

export function useSpreadsheetCellRows(initialRows: string[][] = []) {
  const [rows, setRows] = useState(initialRows);

  const setCellValue = useCallback(
    (point: SpreadsheetCellPoint, value: string) => {
      setRows((currentRows) =>
        updateSpreadsheetCellRows(currentRows, point, value),
      );
    },
    [],
  );

  return {
    rows,
    setCellValue,
    setRows,
  };
}

export function SpreadsheetCellInput({
  className,
  ...props
}: ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn(
        "h-full min-h-9 rounded-none border-0 bg-transparent px-2 py-1.5 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent",
        className,
      )}
      data-slot="spreadsheet-cell-input"
      data-spreadsheet-interactive
      {...props}
    />
  );
}

export function SpreadsheetCellInputGroup({
  className,
  ...props
}: ComponentProps<typeof InputGroup>) {
  return (
    <InputGroup
      className={cn(
        "h-full min-h-9 rounded-none border-0 bg-transparent shadow-none dark:bg-transparent",
        className,
      )}
      data-slot="spreadsheet-cell-input-group"
      data-spreadsheet-interactive
      {...props}
    />
  );
}

export function SpreadsheetGrid({
  className,
  columnCount,
  columnStartIndex = 0,
  rangeSelection,
  renderCell,
  rowStartIndex = 0,
  rows,
  viewportClassName,
}: {
  className?: string;
  columnCount?: number;
  columnStartIndex?: number;
  rangeSelection?: ReturnType<typeof useSpreadsheetRangeSelection>;
  renderCell?: (value: string, point: SpreadsheetCellPoint) => ReactNode;
  rowStartIndex?: number;
  rows: string[][];
  viewportClassName?: string;
}) {
  return (
    <SpreadsheetGridFrame
      cellMode="button"
      className={className}
      columnCount={columnCount}
      columnStartIndex={columnStartIndex}
      rangeSelection={rangeSelection}
      renderCell={({ value, point }) => renderCell?.(value, point) ?? value}
      rowStartIndex={rowStartIndex}
      rows={rows}
      viewportClassName={viewportClassName}
    />
  );
}

export function SpreadsheetEditableGrid({
  className,
  columnCount,
  onCellValueChange,
  rangeSelection,
  renderCell,
  rows,
  viewportClassName,
}: {
  className?: string;
  columnCount?: number;
  onCellValueChange?: (point: SpreadsheetCellPoint, value: string) => void;
  rangeSelection?: ReturnType<typeof useSpreadsheetRangeSelection>;
  renderCell?: (context: SpreadsheetEditableCellRenderContext) => ReactNode;
  rows: string[][];
  viewportClassName?: string;
}) {
  return (
    <SpreadsheetGridFrame
      cellMode="editable"
      className={className}
      columnCount={columnCount}
      rangeSelection={rangeSelection}
      renderCell={(context) => {
        const onValueChange = (value: string) => {
          onCellValueChange?.(context.point, value);
        };

        return (
          renderCell?.({ ...context, onValueChange }) ?? (
            <SpreadsheetCellInput
              aria-label={`Cell ${spreadsheetColumnName(
                context.point.columnIndex,
              )}${context.point.rowIndex + 1}`}
              onChange={(event) => onValueChange(event.currentTarget.value)}
              readOnly={!onCellValueChange}
              value={context.value}
            />
          )
        );
      }}
      rows={rows}
      viewportClassName={viewportClassName}
    />
  );
}

function SpreadsheetGridFrame({
  cellMode,
  className,
  columnCount,
  columnStartIndex = 0,
  rangeSelection,
  renderCell,
  rowStartIndex = 0,
  rows,
  viewportClassName,
}: {
  cellMode: "button" | "editable";
  className?: string;
  columnCount?: number;
  columnStartIndex?: number;
  rangeSelection?: ReturnType<typeof useSpreadsheetRangeSelection>;
  renderCell: (context: SpreadsheetCellRenderContext) => ReactNode;
  rowStartIndex?: number;
  rows: string[][];
  viewportClassName?: string;
}) {
  const resolvedColumnCount = Math.max(
    columnCount ?? rows.reduce((max, row) => Math.max(max, row.length), 0),
    1,
  );

  return (
    <div
      className={cn("min-h-0 flex-1 overflow-auto", viewportClassName)}
      {...rangeSelection?.viewportProps}
    >
      <div className={cn("grid gap-px p-3", className)}>
        <div
          className="grid gap-px"
          style={{
            gridTemplateColumns: `3.25rem repeat(${resolvedColumnCount}, minmax(8rem, 1fr))`,
          }}
        >
          <div className="sticky top-0 left-0 z-30 border bg-background px-2 py-2 text-xs font-medium text-muted-foreground">
            #
          </div>
          {Array.from({ length: resolvedColumnCount }, (_, index) => (
            <div
              className="sticky top-0 z-20 border bg-background px-2 py-2 text-xs font-medium text-muted-foreground"
              key={spreadsheetColumnName(columnStartIndex + index)}
            >
              {spreadsheetColumnName(columnStartIndex + index)}
            </div>
          ))}
          {rows.map((row, rowIndex) => (
            <Fragment key={rowIndex}>
              <div className="sticky left-0 z-10 border bg-background px-2 py-2 text-xs font-medium text-muted-foreground">
                {rowStartIndex + rowIndex + 1}
              </div>
              {Array.from({ length: resolvedColumnCount }, (_, columnIndex) => {
                const point = { columnIndex, rowIndex };
                const value = row[columnIndex] ?? "";
                const selected = Boolean(
                  rangeSelection?.selectionRange &&
                    isSpreadsheetCellSelected(
                      rangeSelection.selectionRange,
                      point,
                    ),
                );
                const cellClassName = cn(
                  "min-h-9 overflow-hidden border bg-background text-left text-sm outline-none transition-colors",
                  cellMode === "button"
                    ? "px-2 py-1.5 select-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60"
                    : "flex items-stretch hover:bg-muted/60 focus-within:ring-2 focus-within:ring-ring/60",
                  selected &&
                    "border-primary/40 bg-primary/10 text-primary ring-1 ring-primary/30",
                );
                const cellContent = renderCell({ point, selected, value });

                if (cellMode === "editable") {
                  return (
                    <div
                      className={cellClassName}
                      key={spreadsheetColumnName(columnIndex)}
                      {...rangeSelection?.getCellProps(point)}
                    >
                      {cellContent}
                    </div>
                  );
                }

                return (
                  <button
                    className={cellClassName}
                    key={spreadsheetColumnName(columnIndex)}
                    type="button"
                    {...rangeSelection?.getCellProps(point)}
                  >
                    {cellContent}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SpreadsheetSheetTabs({
  activeSheetName,
  className,
  icon = <FileSpreadsheet />,
  onActiveSheetNameChange,
  sheets,
}: {
  activeSheetName: string;
  className?: string;
  icon?: ReactNode;
  onActiveSheetNameChange(sheetName: string): void;
  sheets: Pick<SpreadsheetSheet, "name">[];
}) {
  return (
    <div
      className={cn(
        "flex items-center shrink-0 gap-2 p-2 overflow-x-auto border-t",
        className,
      )}
    >
      {icon}
      {sheets.map((sheet) => (
        <Button
          className="cursor-pointer"
          key={sheet.name}
          onClick={() => onActiveSheetNameChange(sheet.name)}
          type="button"
          variant={sheet.name === activeSheetName ? "default" : "outline"}
        >
          {sheet.name}
        </Button>
      ))}
    </div>
  );
}

export function normalizeSpreadsheetRange(
  start: SpreadsheetCellPoint,
  end: SpreadsheetCellPoint,
): SpreadsheetCellRange {
  return {
    endColumnIndex: Math.max(start.columnIndex, end.columnIndex),
    endRowIndex: Math.max(start.rowIndex, end.rowIndex),
    startColumnIndex: Math.min(start.columnIndex, end.columnIndex),
    startRowIndex: Math.min(start.rowIndex, end.rowIndex),
  };
}

export function isSpreadsheetCellSelected(
  range: SpreadsheetCellRange | null,
  point: SpreadsheetCellPoint,
) {
  if (!range) {
    return false;
  }
  return (
    point.rowIndex >= range.startRowIndex &&
    point.rowIndex <= range.endRowIndex &&
    point.columnIndex >= range.startColumnIndex &&
    point.columnIndex <= range.endColumnIndex
  );
}

export function updateSpreadsheetCellRows(
  rows: string[][],
  point: SpreadsheetCellPoint,
  value: string,
) {
  if (rows[point.rowIndex]?.[point.columnIndex] === value) {
    return rows;
  }

  const nextRows = rows.map((row) => [...row]);

  while (nextRows.length <= point.rowIndex) {
    nextRows.push([]);
  }

  const row = nextRows[point.rowIndex] ?? [];
  nextRows[point.rowIndex] = row;

  while (row.length < point.columnIndex) {
    row.push("");
  }

  row[point.columnIndex] = value;
  return nextRows;
}

function isInteractiveSpreadsheetDescendant(
  target: EventTarget | null,
  currentTarget: EventTarget | null,
) {
  if (!(target instanceof Element) || !(currentTarget instanceof Element)) {
    return false;
  }

  if (target === currentTarget) {
    return false;
  }

  const interactiveTarget = target.closest(
    "[data-spreadsheet-interactive],button,input,textarea,select,a,[contenteditable='true']",
  );

  return Boolean(
    interactiveTarget &&
      interactiveTarget !== currentTarget &&
      currentTarget.contains(interactiveTarget),
  );
}

export function formatSpreadsheetRange(
  sheetName: string,
  range: SpreadsheetCellRange,
) {
  const escapedSheetName = sheetName.replace(/'/g, "''");
  const quotedSheetName = `'${escapedSheetName}'`;
  const start = `${spreadsheetColumnName(range.startColumnIndex)}${
    range.startRowIndex + 1
  }`;
  const end = `${spreadsheetColumnName(range.endColumnIndex)}${
    range.endRowIndex + 1
  }`;

  if (start === end) {
    return `${quotedSheetName}!${start}`;
  }

  return `${quotedSheetName}!${start}:${end}`;
}

export function spreadsheetColumnName(columnIndex: number) {
  let index = columnIndex + 1;
  let label = "";
  while (index > 0) {
    const remainder = (index - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    index = Math.floor((index - 1) / 26);
  }
  return label;
}
