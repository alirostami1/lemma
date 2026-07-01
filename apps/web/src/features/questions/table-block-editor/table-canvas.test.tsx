// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultTableEditorModel,
  richContentFromInlineContent,
  type TableEditorModel,
} from "#/domains/questions/authoring";
import { TableCanvas } from "./table-canvas";
import type { TableEditorSelection } from "./table-selection";

const COLUMN_WIDTH = 160;
const ROW_HEIGHT = 56;
const ROW_HEADER_WIDTH = 128;
const COLUMN_HEADER_HEIGHT = 40;

describe("TableCanvas", () => {
  afterEach(() => cleanup());

  it("does not render a permanent table badge by itself", () => {
    const model = createDefaultTableEditorModel();

    render(
      <TableCanvas
        model={model}
        onModelChange={() => {}}
        onSelectionChange={() => {}}
        referencePreviewCache={{}}
        selection={{ type: "table" }}
      />,
    );

    expect(screen.queryByText("Table")).toBeNull();
    expect(screen.getByRole("button", { name: "Column 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Column 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Row 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Row 2" })).toBeTruthy();
  });

  it("selects an active cell on pointer down", () => {
    const onSelectionChange = vi.fn();

    render(
      <TableCanvas
        model={createDefaultTableEditorModel()}
        onModelChange={() => {}}
        onSelectionChange={onSelectionChange}
        referencePreviewCache={{}}
        selection={{ type: "table" }}
      />,
    );

    fireEvent.pointerDown(cellButton("Row 1", "Column 1"));

    expect(onSelectionChange).toHaveBeenLastCalledWith({
      activeCell: { columnId: "column_1", rowId: "row_1" },
      ranges: [
        {
          end: { columnId: "column_1", rowId: "row_1" },
          start: { columnId: "column_1", rowId: "row_1" },
        },
      ],
      type: "cells",
    });
  });

  it("drag-selects a rectangular range", () => {
    render(<Harness />);

    fireEvent.pointerDown(cellButton("Row 1", "Column 1"));
    fireEvent.pointerEnter(cellButton("Row 2", "Column 2"));

    expect(screen.getByText("4 selected cells")).toBeTruthy();
  });

  it("adds a non-adjacent range with ctrl/cmd selection", () => {
    render(<Harness />);

    fireEvent.pointerDown(cellButton("Row 1", "Column 1"));
    fireEvent.pointerUp(cellButton("Row 1", "Column 1"));
    fireEvent.pointerDown(cellButton("Row 2", "Column 2"), {
      ctrlKey: true,
    });

    expect(screen.getByText("2 selected cells in 2 ranges")).toBeTruthy();
  });

  it("clears pointer suppression on cancel or leave before a later click", () => {
    for (const cancelPointer of [
      fireEvent.pointerLeave,
      fireEvent.pointerCancel,
    ]) {
      cleanup();
      const onSelectionChange = vi.fn();
      render(
        <TableCanvas
          model={createDefaultTableEditorModel()}
          onModelChange={() => {}}
          onSelectionChange={onSelectionChange}
          referencePreviewCache={{}}
          selection={{ type: "table" }}
        />,
      );

      fireEvent.pointerDown(cellButton("Row 1", "Column 1"), { pointerId: 1 });
      cancelPointer(screen.getByRole("group", { name: "Table block editor" }), {
        pointerId: 1,
      });
      fireEvent.click(cellButton("Row 2", "Column 2"));

      expect(onSelectionChange).toHaveBeenLastCalledWith({
        activeCell: { columnId: "column_2", rowId: "row_2" },
        ranges: [
          {
            end: { columnId: "column_2", rowId: "row_2" },
            start: { columnId: "column_2", rowId: "row_2" },
          },
        ],
        type: "cells",
      });
    }
  });

  it("suppresses the final click after pointer drag without blocking keyboard", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    fireEvent.pointerDown(cellButton("Row 1", "Column 1"), { pointerId: 1 });
    fireEvent.pointerEnter(cellButton("Row 2", "Column 2"));
    fireEvent.pointerUp(
      screen.getByRole("group", { name: "Table block editor" }),
      {
        pointerId: 1,
      },
    );
    fireEvent.click(cellButton("Row 1", "Column 1"));

    expect(screen.getByText("4 selected cells")).toBeTruthy();

    cellButton("Row 1", "Column 2").focus();
    await user.keyboard("{Enter}");

    expect(screen.getByText("1 selected cell")).toBeTruthy();
  });

  it("drag-selects through pointer capture using viewport coordinates", () => {
    render(<Harness />);
    const viewport = setTableViewportMetrics({ left: 10, top: 20 });
    const root = installPointerCapture();

    fireEvent.pointerDown(cellButton("Row 1", "Column 1"), { pointerId: 7 });
    fireEvent.pointerMove(root.element, {
      ...clientPointForCell({
        columnIndex: 1,
        rowIndex: 1,
        viewport,
      }),
      pointerId: 7,
    });
    fireEvent.pointerUp(root.element, { pointerId: 7 });

    expect(root.setPointerCapture).toHaveBeenCalledWith(7);
    expect(root.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(screen.getByText("4 selected cells")).toBeTruthy();
  });

  it("drag-selects through pointer capture after virtual scroll", async () => {
    render(<Harness initialModel={createLargeTableModel(100, 100)} />);
    const viewport = setTableViewportMetrics({ left: 10, top: 20 });
    setTableScrollPosition(viewport.element, {
      left: ROW_HEADER_WIDTH + 48 * COLUMN_WIDTH,
      top: COLUMN_HEADER_HEIGHT + 48 * ROW_HEIGHT,
    });
    fireEvent.scroll(viewport.element);
    const root = installPointerCapture();

    fireEvent.pointerDown(
      await screen.findByRole("button", {
        name: "Cell Row 50, Column 50",
      }),
      { pointerId: 9 },
    );
    fireEvent.pointerMove(root.element, {
      ...clientPointForCell({
        columnIndex: 51,
        rowIndex: 51,
        viewport,
      }),
      pointerId: 9,
    });

    expect(screen.getByText("9 selected cells")).toBeTruthy();
  });

  it("drag-selects through pointer capture with headers disabled", () => {
    render(
      <Harness
        initialModel={{
          ...createDefaultTableEditorModel(),
          showColumnNames: false,
          showRowNames: false,
        }}
      />,
    );
    const viewport = setTableViewportMetrics({
      left: 10,
      showColumnNames: false,
      showRowNames: false,
      top: 20,
    });
    const root = installPointerCapture();

    fireEvent.pointerDown(cellButton("Row 1", "Column 1"), { pointerId: 11 });
    fireEvent.pointerMove(root.element, {
      ...clientPointForCell({
        columnIndex: 1,
        rowIndex: 1,
        viewport,
      }),
      pointerId: 11,
    });

    expect(screen.getByText("4 selected cells")).toBeTruthy();
  });

  it("supports mobile-visible add selection mode", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    fireEvent.pointerDown(cellButton("Row 1", "Column 1"));
    await user.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.pointerDown(cellButton("Row 2", "Column 2"));

    expect(screen.getByText("2 selected cells in 2 ranges")).toBeTruthy();
  });

  it("applies toolbar formatting to the selected cell", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();

    render(<Harness onModelChange={onModelChange} />);

    fireEvent.pointerDown(cellButton("Row 1", "Column 1"));
    await user.click(screen.getByRole("button", { name: "Bold" }));

    expect(onModelChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cells: expect.arrayContaining([
          expect.objectContaining({
            formatting: expect.objectContaining({ emphasis: "strong" }),
            id: "cell_1",
          }),
        ]),
      }),
    );
  });

  it("selects cells with Enter and Space", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    cellButton("Row 1", "Column 1").focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("1 selected cell")).toBeTruthy();

    cellButton("Row 2", "Column 2").focus();
    await user.keyboard(" ");
    expect(screen.getByText("1 selected cell")).toBeTruthy();
  });

  it("extends a range with shift keyboard activation", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    cellButton("Row 1", "Column 1").focus();
    await user.keyboard("{Enter}");
    cellButton("Row 2", "Column 2").focus();
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(screen.getByText("4 selected cells")).toBeTruthy();
  });

  it("adds a multi-selection with ctrl keyboard activation", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    cellButton("Row 1", "Column 1").focus();
    await user.keyboard("{Enter}");
    cellButton("Row 2", "Column 2").focus();
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(screen.getByText("2 selected cells in 2 ranges")).toBeTruthy();
  });

  it("supports mobile-visible extend selection mode", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    fireEvent.pointerDown(cellButton("Row 1", "Column 1"));
    await user.click(screen.getByRole("button", { name: "Extend" }));
    fireEvent.pointerDown(cellButton("Row 2", "Column 2"));

    expect(screen.getByText("4 selected cells")).toBeTruthy();
  });

  it("converts selected cells with toolbar Content and Answer actions", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    render(<Harness onModelChange={onModelChange} />);

    fireEvent.pointerDown(cellButton("Row 1", "Column 1"));
    await user.click(screen.getByRole("button", { name: "Answer" }));
    expect(onModelChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        responseFields: expect.arrayContaining([
          expect.objectContaining({ id: "answer_2" }),
        ]),
      }),
    );

    await user.click(screen.getByRole("button", { name: "Content" }));
    expect(onModelChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        responseFields: [expect.objectContaining({ id: "answer_1" })],
      }),
    );
  });

  it("gives icon-only formatting buttons accessible names", () => {
    render(<Harness />);

    expect(screen.getByRole("button", { name: "Align left" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Align center" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Align right" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bold" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Highlight" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Clear formatting" }),
    ).toBeTruthy();
  });

  it("blocks selection and formatting while disabled", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const onSelectionChange = vi.fn();

    render(
      <TableCanvas
        disabled
        model={createDefaultTableEditorModel()}
        onModelChange={onModelChange}
        onSelectionChange={onSelectionChange}
        referencePreviewCache={{}}
        selection={{ type: "table" }}
      />,
    );

    fireEvent.pointerDown(cellButton("Row 1", "Column 1"));
    cellButton("Row 1", "Column 1").focus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Bold" }));

    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(onModelChange).not.toHaveBeenCalled();
  });

  it("blocks table-only Answer conversion for range-backed values without workbook context", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const model = createRangeBackedReferenceModel();

    render(
      <TableCanvas
        model={model}
        onModelChange={onModelChange}
        onSelectionChange={() => {}}
        referencePreviewCache={{}}
        selection={{
          activeCell: { columnId: "column_1", rowId: "row_1" },
          ranges: [
            {
              end: { columnId: "column_1", rowId: "row_1" },
              start: { columnId: "column_1", rowId: "row_1" },
            },
          ],
          type: "cells",
        }}
      />,
    );

    expect(screen.getByRole("note").textContent).toContain(
      "need workbook context",
    );
    expect(screen.queryByText("range_ref")).toBeNull();
    expect(screen.queryByText("{{ .range_ref }}")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Answer" }));

    expect(onModelChange).not.toHaveBeenCalled();
  });

  it("uses composed conversion callback for range-backed Answer conversion", async () => {
    const user = userEvent.setup();
    const onConvertSelectionToAnswer = vi.fn();
    const model = createRangeBackedReferenceModel();

    render(
      <TableCanvas
        model={model}
        onConvertSelectionToAnswer={onConvertSelectionToAnswer}
        onModelChange={() => {}}
        onSelectionChange={() => {}}
        referencePreviewCache={{}}
        selection={{
          activeCell: { columnId: "column_1", rowId: "row_1" },
          ranges: [
            {
              end: { columnId: "column_1", rowId: "row_1" },
              start: { columnId: "column_1", rowId: "row_1" },
            },
          ],
          type: "cells",
        }}
      />,
    );

    expect(screen.getByRole("note").textContent).toContain(
      "convert to direct workbook answer sources",
    );
    await user.click(screen.getByRole("button", { name: "Answer" }));

    expect(onConvertSelectionToAnswer).toHaveBeenCalledTimes(1);
  });

  it("clips rich multi-block content inside fixed-height virtualized cells", () => {
    const model = createOverflowingCellModel();

    render(
      <TableCanvas
        model={model}
        onModelChange={() => {}}
        onSelectionChange={() => {}}
        referencePreviewCache={{}}
        selection={{ type: "table" }}
      />,
    );

    const rowFrame = screen.getByTestId("table-row-frame-row_1");
    const cellFrame = screen.getByTestId("table-cell-frame-row_1-column_1");
    const cell = cellButton("Row 1", "Column 1");

    expect(rowFrame.style.height).toBe("56px");
    expect(rowFrame.className).toContain("overflow-hidden");
    expect(cellFrame.style.height).toBe("56px");
    expect(cellFrame.className).toContain("overflow-hidden");
    expect(cell.className).toContain("overflow-hidden");
    expect(cell.className).toContain("font-semibold");
  });

  it("virtualizes large explicit tables instead of rendering every coordinate", () => {
    const largeModel = createLargeTableModel(200, 200, true);
    const { container } = render(
      <TableCanvas
        model={largeModel}
        onModelChange={() => {}}
        onSelectionChange={() => {}}
        referencePreviewCache={{}}
        selection={{ type: "table" }}
      />,
    );
    const scrollSurface = screen.getByTestId("table-scroll-surface");
    const renderedCells = container.querySelectorAll(
      'button[aria-label^="Cell Row"]',
    );

    expect(scrollSurface.className).toContain("overflow-auto");
    expect(scrollSurface.className).toContain("max-h-[72vh]");
    expect(renderedCells.length).toBeGreaterThan(0);
    expect(renderedCells.length).toBeLessThan(200 * 200);
    expect(
      screen.queryByRole("button", { name: "Cell Row 200, Column 200" }),
    ).toBeNull();
  });

  it("creates exactly one cell when selecting an empty virtualized coordinate", () => {
    const onModelChange = vi.fn();
    render(
      <Harness
        initialModel={createLargeTableModel(200, 200)}
        onModelChange={onModelChange}
      />,
    );

    fireEvent.pointerDown(cellButton("Row 1", "Column 1"));

    expect(onModelChange).toHaveBeenCalledTimes(1);
    expect(onModelChange.mock.calls[0]?.[0].cells).toEqual([
      expect.objectContaining({
        columnId: "column_1",
        rowId: "row_1",
      }),
    ]);
  });

  it("keeps selection stable after scrolling the virtual window", () => {
    const { container } = render(
      <Harness initialModel={createLargeTableModel(200, 200)} />,
    );
    const scrollSurface = container.querySelector(
      '[data-testid="table-scroll-surface"]',
    );
    if (!(scrollSurface instanceof HTMLElement)) {
      throw new Error("Expected table scroll surface.");
    }

    setTableScrollPosition(scrollSurface, { left: 31_968, top: 11_184 });
    fireEvent.scroll(scrollSurface);
    fireEvent.pointerDown(
      requireCellButtonIn(container, "Row 200", "Column 200"),
    );

    expect(container.textContent).toContain("1 selected cell");

    setTableScrollPosition(scrollSurface, { left: 0, top: 0 });
    fireEvent.scroll(scrollSurface);

    expect(requireCellButtonIn(container, "Row 1", "Column 1")).toBeTruthy();
    expect(container.textContent).toContain("1 selected cell");
    expect(queryCellButtonIn(container, "Row 200", "Column 200")).toBeNull();

    setTableScrollPosition(scrollSurface, { left: 31_968, top: 11_184 });
    fireEvent.scroll(scrollSurface);

    expect(
      requireCellButtonIn(container, "Row 200", "Column 200"),
    ).toBeTruthy();
  });
});

function Harness({
  initialModel,
  onModelChange,
}: {
  initialModel?: TableEditorModel;
  onModelChange?: (model: TableEditorModel) => void;
}) {
  const [model, setModel] = useState(
    initialModel ?? createDefaultTableEditorModel(),
  );
  const [selection, setSelection] = useState<TableEditorSelection>({
    type: "table",
  });
  return (
    <TableCanvas
      model={model}
      onModelChange={(nextModel) => {
        setModel(nextModel);
        onModelChange?.(nextModel);
      }}
      onSelectionChange={setSelection}
      referencePreviewCache={{}}
      selection={selection}
    />
  );
}

function createLargeTableModel(
  rowCount: number,
  columnCount: number,
  withExplicitCells = false,
): TableEditorModel {
  const model: TableEditorModel = {
    ...createDefaultTableEditorModel(),
    cells: [],
    columns: Array.from({ length: columnCount }, (_, index) => ({
      id: `column_${index + 1}`,
      label: `Column ${index + 1}`,
    })),
    rows: Array.from({ length: rowCount }, (_, index) => ({
      id: `row_${index + 1}`,
      label: `Row ${index + 1}`,
    })),
  };
  return withExplicitCells
    ? {
        ...model,
        cells: model.rows.flatMap((row, rowIndex) =>
          model.columns.map((column, columnIndex) => ({
            blocks: [],
            columnId: column.id,
            id: `cell_${rowIndex + 1}_${columnIndex + 1}`,
            rowId: row.id,
          })),
        ),
      }
    : model;
}

type ViewportMetrics = {
  element: HTMLElement;
  left: number;
  top: number;
  showColumnNames: boolean;
  showRowNames: boolean;
};

function setTableViewportMetrics(input: {
  left: number;
  top: number;
  showColumnNames?: boolean;
  showRowNames?: boolean;
}): ViewportMetrics {
  const element = screen.getByTestId("table-scroll-surface");
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    value: 520,
  });
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: 320,
  });
  element.getBoundingClientRect = () => ({
    bottom: input.top + 320,
    height: 320,
    left: input.left,
    right: input.left + 520,
    toJSON: () => ({}),
    top: input.top,
    width: 520,
    x: input.left,
    y: input.top,
  });

  return {
    element,
    left: input.left,
    showColumnNames: input.showColumnNames ?? true,
    showRowNames: input.showRowNames ?? true,
    top: input.top,
  };
}

function clientPointForCell(input: {
  viewport: ViewportMetrics;
  rowIndex: number;
  columnIndex: number;
}) {
  const rowHeaderWidth = input.viewport.showRowNames ? ROW_HEADER_WIDTH : 0;
  const columnHeaderHeight = input.viewport.showColumnNames
    ? COLUMN_HEADER_HEIGHT
    : 0;
  return {
    clientX:
      input.viewport.left +
      rowHeaderWidth +
      input.columnIndex * COLUMN_WIDTH +
      COLUMN_WIDTH / 2 -
      input.viewport.element.scrollLeft,
    clientY:
      input.viewport.top +
      columnHeaderHeight +
      input.rowIndex * ROW_HEIGHT +
      ROW_HEIGHT / 2 -
      input.viewport.element.scrollTop,
  };
}

function installPointerCapture() {
  const element = screen.getByRole("group", { name: "Table block editor" });
  const setPointerCapture = vi.fn();
  const releasePointerCapture = vi.fn();
  Object.defineProperty(element, "setPointerCapture", {
    configurable: true,
    value: setPointerCapture,
  });
  Object.defineProperty(element, "hasPointerCapture", {
    configurable: true,
    value: () => true,
  });
  Object.defineProperty(element, "releasePointerCapture", {
    configurable: true,
    value: releasePointerCapture,
  });
  return { element, releasePointerCapture, setPointerCapture };
}

function setTableScrollPosition(
  element: HTMLElement,
  position: { left: number; top: number },
) {
  element.scrollLeft = position.left;
  element.scrollTop = position.top;
}

function cellButton(rowLabel: string, columnLabel: string) {
  return screen.getByRole("button", {
    name: `Cell ${rowLabel}, ${columnLabel}`,
  });
}

function queryCellButtonIn(
  container: HTMLElement,
  rowLabel: string,
  columnLabel: string,
) {
  return container.querySelector(
    `button[aria-label="Cell ${rowLabel}, ${columnLabel}"]`,
  );
}

function requireCellButtonIn(
  container: HTMLElement,
  rowLabel: string,
  columnLabel: string,
) {
  const button = queryCellButtonIn(container, rowLabel, columnLabel);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected cell ${rowLabel}, ${columnLabel}.`);
  }
  return button;
}

function createOverflowingCellModel(): TableEditorModel {
  return {
    ...createDefaultTableEditorModel(),
    cells: [
      {
        blocks: [
          {
            content: [
              {
                text: "A long text block that stays clipped in the virtualized cell",
                type: "text",
              },
            ],
            id: "text_1",
            type: "text",
          },
          {
            content: richContentFromInlineContent([
              { text: "Rich detail", type: "text" },
            ]),
            id: "rich_1",
            type: "rich_text",
          },
          { id: "separator_1", type: "separator" },
        ],
        columnId: "column_1",
        formatting: { emphasis: "strong" },
        id: "cell_1",
        rowId: "row_1",
      },
    ],
  };
}

function createRangeBackedReferenceModel(): TableEditorModel {
  return {
    ...createDefaultTableEditorModel(),
    cells: [
      {
        blocks: [
          {
            content: [
              {
                fallbackText: "A1",
                rangeCell: { columnOffset: 0, rowOffset: 0 },
                referenceId: "range_ref",
                type: "reference",
              },
            ],
            id: "range_text",
            type: "text",
          },
        ],
        columnId: "column_1",
        id: "cell_1",
        rowId: "row_1",
      },
    ],
    responseFields: [],
  };
}
