import { Button } from "@lemma/ui/components/button";
import { cn } from "@lemma/ui/lib/utils";
import { ListPlus, StretchHorizontal } from "lucide-react";
import {
  type PointerEvent,
  type UIEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getPrimaryTableInputBlock,
  type SelectedTableCoordinateSummary,
  type TableEditorModel,
} from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { type TableCellActivation, TableCellView } from "./table-cell-view";
import {
  createTableCellsByCoordinateKey,
  createTableResponseFieldsById,
  ensureTableCell,
  getSelectedTableCoordinateSummary,
} from "./table-editor-operations";
import type {
  TableCellCoordinate,
  TableEditorSelection,
} from "./table-selection";
import {
  addTableRangeToSelection,
  describeTableSelectionFromSummary,
  isTableSelectionEqual,
  normalizeTableSelection,
  selectTableCell,
  selectTableRange,
  tableCoordinateKey,
} from "./table-selection";
import {
  TableSelectionActions,
  type TableSelectionAnswerActionResult,
} from "./table-selection-actions";
import { getVirtualAxisWindow } from "./table-virtualization";

type SelectionTouchMode = "replace" | "add" | "extend";

type DragState = {
  anchor: TableCellCoordinate;
  additive: boolean;
  baseSelection: TableEditorSelection;
};

type SelectionActivation = TableCellActivation;

type ScrollPosition = {
  left: number;
  top: number;
};

const COLUMN_WIDTH = 160;
const ROW_HEIGHT = 56;
const ROW_HEADER_WIDTH = 128;
const COLUMN_HEADER_HEIGHT = 40;
const DEFAULT_VIEWPORT_WIDTH = 920;
const DEFAULT_VIEWPORT_HEIGHT = 560;
const VIRTUAL_OVERSCAN = 3;

export function TableCanvas({
  model,
  selection,
  referencePreviewCache,
  disabled,
  onConvertSelectionToAnswer,
  onModelChange,
  onSelectionChange,
}: {
  model: TableEditorModel;
  selection: TableEditorSelection;
  referencePreviewCache?: ReferencePreviewCache;
  disabled?: boolean;
  onConvertSelectionToAnswer?: () =>
    | TableSelectionAnswerActionResult
    | undefined;
  onModelChange(model: TableEditorModel): void;
  onSelectionChange(selection: TableEditorSelection): void;
}) {
  const [touchMode, setTouchMode] = useState<SelectionTouchMode>("replace");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [scrollPosition, setScrollPosition] = useState<ScrollPosition>({
    left: 0,
    top: 0,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const suppressNextCellClickKeyRef = useRef<string | null>(null);
  const pointerCleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // Virtual windows stay cheap even when imported tables contain every cell.
  const cellsByCoordinateKey = useMemo(
    () => createTableCellsByCoordinateKey(model),
    [model],
  );
  const responseFieldsById = useMemo(
    () => createTableResponseFieldsById(model),
    [model],
  );
  const selectedCoordinateSummary = useMemo(
    () =>
      getSelectedTableCoordinateSummary(model, selection, cellsByCoordinateKey),
    [cellsByCoordinateKey, model, selection],
  );
  const activeCellKey =
    selection.type === "cells"
      ? tableCoordinateKey(selection.activeCell)
      : null;
  const rowHeaderWidth = model.showRowNames ? ROW_HEADER_WIDTH : 0;
  const columnHeaderHeight = model.showColumnNames ? COLUMN_HEADER_HEIGHT : 0;
  const viewportWidth =
    viewportRef.current?.clientWidth && viewportRef.current.clientWidth > 0
      ? viewportRef.current.clientWidth
      : DEFAULT_VIEWPORT_WIDTH;
  const viewportHeight =
    viewportRef.current?.clientHeight && viewportRef.current.clientHeight > 0
      ? viewportRef.current.clientHeight
      : DEFAULT_VIEWPORT_HEIGHT;
  const virtualRows = getVirtualAxisWindow({
    itemSize: ROW_HEIGHT,
    items: model.rows,
    overscan: VIRTUAL_OVERSCAN,
    scrollOffset: Math.max(0, scrollPosition.top - columnHeaderHeight),
    viewportSize: Math.max(ROW_HEIGHT, viewportHeight - columnHeaderHeight),
  });
  const virtualColumns = getVirtualAxisWindow({
    itemSize: COLUMN_WIDTH,
    items: model.columns,
    overscan: VIRTUAL_OVERSCAN,
    scrollOffset: Math.max(0, scrollPosition.left - rowHeaderWidth),
    viewportSize: Math.max(COLUMN_WIDTH, viewportWidth - rowHeaderWidth),
  });
  const canvasWidth = rowHeaderWidth + virtualColumns.totalSize;
  const canvasHeight = columnHeaderHeight + virtualRows.totalSize;

  useEffect(() => {
    return () => {
      if (pointerCleanupTimerRef.current) {
        clearTimeout(pointerCleanupTimerRef.current);
      }
    };
  }, []);

  function commitSelection(nextSelection: TableEditorSelection) {
    onSelectionChange(normalizeTableSelection(model, nextSelection));
  }

  function selectCoordinate(
    coordinate: TableCellCoordinate,
    activation: SelectionActivation,
    startDrag: boolean,
  ) {
    if (disabled) {
      return;
    }

    const ensured = ensureTableCell(
      model,
      coordinate.rowId,
      coordinate.columnId,
    );
    if (ensured.model !== model) {
      onModelChange(ensured.model);
    }

    const isAdditive =
      activation.metaKey || activation.ctrlKey || touchMode === "add";
    const isExtending = activation.shiftKey || touchMode === "extend";
    const nextSelection = selectionForPointerDown({
      coordinate,
      isAdditive,
      isExtending,
      selection,
    });

    commitSelection(nextSelection);
    if (!startDrag) {
      return;
    }

    setDragState({
      additive: isAdditive || isExtending,
      anchor:
        isExtending && selection.type === "cells"
          ? selection.activeCell
          : coordinate,
      baseSelection: isExtending
        ? selectionWithoutLastRange(selection)
        : isAdditive
          ? selection
          : { type: "table" },
    });
  }

  function extendDragSelection(coordinate: TableCellCoordinate) {
    if (!dragState || disabled) {
      return;
    }

    const range = { end: coordinate, start: dragState.anchor };
    commitSelection(
      dragState.additive
        ? addTableRangeToSelection(dragState.baseSelection, range)
        : selectTableRange(dragState.anchor, coordinate),
    );
  }

  function applySelectionUpdate(nextModel: TableEditorModel) {
    onModelChange(nextModel);
  }

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    setScrollPosition({
      left: event.currentTarget.scrollLeft,
      top: event.currentTarget.scrollTop,
    });
  }

  function clearPointerInteraction() {
    setDragState(null);
    suppressNextCellClickKeyRef.current = null;
    if (pointerCleanupTimerRef.current) {
      clearTimeout(pointerCleanupTimerRef.current);
      pointerCleanupTimerRef.current = null;
    }
  }

  function schedulePointerInteractionCleanup(coordinateKey: string) {
    setDragState(null);
    if (pointerCleanupTimerRef.current) {
      clearTimeout(pointerCleanupTimerRef.current);
    }
    pointerCleanupTimerRef.current = setTimeout(() => {
      if (suppressNextCellClickKeyRef.current === coordinateKey) {
        suppressNextCellClickKeyRef.current = null;
      }
      pointerCleanupTimerRef.current = null;
    }, 0);
  }

  function releasePointerCapture(event: PointerEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    if (target.hasPointerCapture?.(event.pointerId)) {
      target.releasePointerCapture?.(event.pointerId);
    }
  }

  function beginPointerSelection(
    event: PointerEvent<HTMLDivElement>,
    coordinate: TableCellCoordinate,
  ) {
    event.stopPropagation();
    if (disabled) {
      return;
    }

    rootRef.current?.setPointerCapture?.(event.pointerId);
    const coordinateKey = tableCoordinateKey(coordinate);
    suppressNextCellClickKeyRef.current = coordinateKey;
    if (pointerCleanupTimerRef.current) {
      clearTimeout(pointerCleanupTimerRef.current);
      pointerCleanupTimerRef.current = null;
    }
    selectCoordinate(coordinate, activationFromPointerEvent(event), true);
  }

  function coordinateFromPointerEvent(
    event: PointerEvent<HTMLDivElement>,
  ): TableCellCoordinate | null {
    const viewport = viewportRef.current;
    if (!viewport) {
      return null;
    }
    const rect = viewport.getBoundingClientRect();
    const x = event.clientX - rect.left + viewport.scrollLeft - rowHeaderWidth;
    const y =
      event.clientY - rect.top + viewport.scrollTop - columnHeaderHeight;
    if (x < 0 || y < 0) {
      return null;
    }

    const row = model.rows[Math.floor(y / ROW_HEIGHT)];
    const column = model.columns[Math.floor(x / COLUMN_WIDTH)];
    return row && column ? { columnId: column.id, rowId: row.id } : null;
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: This is a programmatic editor focus surface, not a form group.
    <div
      aria-label="Table block editor"
      className="group relative min-w-0 rounded-md border bg-background transition"
      data-studio-primary-editor-focus
      data-studio-shortcut-scope="editing"
      onPointerCancel={(event) => {
        releasePointerCapture(event);
        clearPointerInteraction();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (disabled) {
          return;
        }
        if (event.target === event.currentTarget) {
          onSelectionChange({ type: "table" });
        }
      }}
      onPointerLeave={(event) => {
        releasePointerCapture(event);
        clearPointerInteraction();
      }}
      onPointerMove={(event) => {
        if (!dragState || disabled) {
          return;
        }
        const coordinate = coordinateFromPointerEvent(event);
        if (coordinate) {
          extendDragSelection(coordinate);
        }
      }}
      onPointerUp={(event) => {
        releasePointerCapture(event);
        const key = suppressNextCellClickKeyRef.current;
        if (key) {
          schedulePointerInteractionCleanup(key);
          return;
        }
        clearPointerInteraction();
      }}
      ref={rootRef}
      role="group"
      tabIndex={-1}
    >
      <SelectionToolbar
        disabled={disabled}
        model={model}
        onConvertSelectionToAnswer={onConvertSelectionToAnswer}
        onModelChange={applySelectionUpdate}
        onTouchModeChange={setTouchMode}
        selectedCoordinateSummary={selectedCoordinateSummary}
        selection={selection}
        touchMode={touchMode}
      />
      <section
        aria-label="Table grid viewport"
        className="max-h-[72vh] min-w-0 overflow-auto overscroll-contain p-3"
        data-testid="table-scroll-surface"
        onScroll={handleScroll}
        ref={viewportRef}
      >
        <div
          className="relative min-w-max text-sm"
          style={{ height: canvasHeight, width: canvasWidth }}
        >
          {model.showColumnNames ? (
            <div
              className="sticky top-0 z-30 bg-background"
              style={{ height: COLUMN_HEADER_HEIGHT, width: canvasWidth }}
            >
              {model.showRowNames ? (
                <div
                  className="sticky left-0 top-0 z-40 bg-background p-0.5"
                  style={{
                    height: COLUMN_HEADER_HEIGHT,
                    width: ROW_HEADER_WIDTH,
                  }}
                />
              ) : null}
              {virtualColumns.items.map((virtualColumn) => {
                const column = virtualColumn.item;
                return (
                  <div
                    className="absolute top-0 p-0.5"
                    key={column.id}
                    style={{
                      height: COLUMN_HEADER_HEIGHT,
                      left: rowHeaderWidth + virtualColumn.offset,
                      width: virtualColumn.size,
                    }}
                  >
                    <button
                      className={cn(
                        "h-full w-full rounded-md border border-border/70 bg-muted/40 px-3 text-left text-xs font-medium transition hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring",
                        isTableSelectionEqual(selection, {
                          columnId: column.id,
                          type: "column",
                        }) && "border-primary ring-2 ring-primary/20",
                      )}
                      disabled={disabled}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!disabled) {
                          onSelectionChange({
                            columnId: column.id,
                            type: "column",
                          });
                        }
                      }}
                      type="button"
                    >
                      {column.label}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          {virtualRows.items.map((virtualRow) => {
            const row = virtualRow.item;
            return (
              <div
                className="absolute left-0 overflow-hidden"
                data-testid={`table-row-frame-${row.id}`}
                key={row.id}
                style={{
                  height: virtualRow.size,
                  top: columnHeaderHeight + virtualRow.offset,
                  width: canvasWidth,
                }}
              >
                {model.showRowNames ? (
                  <div
                    className="sticky left-0 z-20 bg-background p-0.5"
                    style={{ height: ROW_HEIGHT, width: ROW_HEADER_WIDTH }}
                  >
                    <button
                      className={cn(
                        "h-full w-full rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-left text-xs font-medium transition hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring",
                        isTableSelectionEqual(selection, {
                          rowId: row.id,
                          type: "row",
                        }) && "border-primary ring-2 ring-primary/20",
                      )}
                      disabled={disabled}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!disabled) {
                          onSelectionChange({ rowId: row.id, type: "row" });
                        }
                      }}
                      type="button"
                    >
                      {row.label}
                    </button>
                  </div>
                ) : null}

                {virtualColumns.items.map((virtualColumn) => {
                  const column = virtualColumn.item;
                  const coordinate = { columnId: column.id, rowId: row.id };
                  const coordinateKey = tableCoordinateKey(coordinate);
                  const cell = cellsByCoordinateKey.get(coordinateKey) ?? null;
                  const inputBlock = cell
                    ? getPrimaryTableInputBlock(cell)
                    : null;
                  const responseField = inputBlock
                    ? responseFieldsById.get(inputBlock.responseFieldId)
                    : undefined;
                  const isSelected =
                    selectedCoordinateSummary.coordinateKeys.has(coordinateKey);
                  const isActive = activeCellKey === coordinateKey;

                  return (
                    <div
                      className="absolute overflow-hidden p-0.5"
                      data-testid={`table-cell-frame-${row.id}-${column.id}`}
                      key={column.id}
                      onPointerDown={(event) =>
                        beginPointerSelection(event, coordinate)
                      }
                      onPointerEnter={() => extendDragSelection(coordinate)}
                      style={{
                        height: ROW_HEIGHT,
                        left: rowHeaderWidth + virtualColumn.offset,
                        top: 0,
                        width: virtualColumn.size,
                      }}
                    >
                      <TableCellView
                        ariaLabel={`Cell ${row.label}, ${column.label}`}
                        cell={cell}
                        disabled={disabled}
                        isActive={isActive}
                        isSelected={isSelected}
                        onSelect={(activation) => {
                          if (
                            activation.source === "click" &&
                            suppressNextCellClickKeyRef.current ===
                              coordinateKey
                          ) {
                            suppressNextCellClickKeyRef.current = null;
                            return;
                          }
                          selectCoordinate(coordinate, activation, false);
                        }}
                        referencePreviewCache={referencePreviewCache ?? {}}
                        responseField={responseField}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SelectionToolbar({
  model,
  selection,
  touchMode,
  selectedCoordinateSummary,
  disabled,
  onTouchModeChange,
  onConvertSelectionToAnswer,
  onModelChange,
}: {
  model: TableEditorModel;
  selection: TableEditorSelection;
  touchMode: SelectionTouchMode;
  selectedCoordinateSummary: SelectedTableCoordinateSummary;
  disabled?: boolean;
  onTouchModeChange(mode: SelectionTouchMode): void;
  onConvertSelectionToAnswer?: () =>
    | TableSelectionAnswerActionResult
    | undefined;
  onModelChange(model: TableEditorModel): void;
}) {
  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b bg-background/95 p-2 backdrop-blur">
      <span className="min-w-28 text-xs text-muted-foreground">
        {describeTableSelectionFromSummary(
          selection,
          selectedCoordinateSummary,
        )}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          disabled={disabled}
          onClick={() =>
            onTouchModeChange(touchMode === "add" ? "replace" : "add")
          }
          size="sm"
          type="button"
          variant={touchMode === "add" ? "secondary" : "outline"}
        >
          <ListPlus />
          Add
        </Button>
        <Button
          disabled={disabled}
          onClick={() =>
            onTouchModeChange(touchMode === "extend" ? "replace" : "extend")
          }
          size="sm"
          type="button"
          variant={touchMode === "extend" ? "secondary" : "outline"}
        >
          <StretchHorizontal />
          Extend
        </Button>
      </div>
      <TableSelectionActions
        disabled={disabled}
        model={model}
        onConvertSelectionToAnswer={onConvertSelectionToAnswer}
        onModelChange={onModelChange}
        selectedCoordinateSummary={selectedCoordinateSummary}
        selection={selection}
      />
    </div>
  );
}

function activationFromPointerEvent(event: PointerEvent): SelectionActivation {
  return {
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    source: "pointer",
  };
}

function selectionForPointerDown(input: {
  selection: TableEditorSelection;
  coordinate: TableCellCoordinate;
  isAdditive: boolean;
  isExtending: boolean;
}): TableEditorSelection {
  if (input.isExtending) {
    return input.selection.type === "cells"
      ? addTableRangeToSelection(selectionWithoutLastRange(input.selection), {
          end: input.coordinate,
          start: input.selection.activeCell,
        })
      : selectTableCell(input.coordinate);
  }

  if (input.isAdditive) {
    return addTableRangeToSelection(input.selection, {
      end: input.coordinate,
      start: input.coordinate,
    });
  }

  return selectTableCell(input.coordinate);
}

function selectionWithoutLastRange(
  selection: TableEditorSelection,
): TableEditorSelection {
  if (selection.type !== "cells" || selection.ranges.length <= 1) {
    return { type: "table" };
  }

  const ranges = selection.ranges.slice(0, -1);
  const activeCell = ranges.at(-1)?.end ?? selection.activeCell;
  return {
    activeCell,
    ranges,
    type: "cells",
  };
}
