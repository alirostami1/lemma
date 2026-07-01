// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ComposedEditorBlock,
  ComposedEditorModel,
  TableEditorModel,
} from "#/domains/questions/authoring";
import {
  findComposedBlockById,
  getPrimaryTableInputBlock,
} from "#/domains/questions/authoring";
import { selectTableCell } from "#/features/questions/table-block-editor";
import { BlockEditor } from "./block-editor";

describe("BlockEditor table conversion", () => {
  afterEach(() => cleanup());

  it("converts a page-nested range-backed table selection through composed conversion", async () => {
    const user = userEvent.setup();
    const model = nestedRangeBackedComposedModel({
      includeRangeReference: true,
    });
    const onModelChange = vi.fn();

    renderBlockEditor(model, onModelChange);

    await user.click(screen.getByRole("button", { name: "Answer" }));

    const nextModel = lastChangedModel(onModelChange);
    const inputBlock = getPrimaryTableInputBlock(requireTableCell(nextModel));
    expect(inputBlock?.correctValueSource).toEqual({
      referenceId: requireWorkbookCellReferenceId(nextModel, "Sheet1!A1"),
      type: "reference",
    });
    expect(requireNestedContainer(nextModel).blocks[0]).toEqual(
      nestedSiblingBlock(),
    );
  });

  it("shows safe copy when nested range-backed conversion is blocked", async () => {
    const user = userEvent.setup();
    const model = nestedRangeBackedComposedModel({
      includeRangeReference: false,
    });
    const onModelChange = vi.fn();

    renderBlockEditor(model, onModelChange);

    await user.click(screen.getByRole("button", { name: "Answer" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "could not be converted",
    );
    expect(screen.queryByText("range_ref")).toBeNull();
    expect(screen.queryByText("source_1")).toBeNull();
    expect(
      getPrimaryTableInputBlock(
        requireTableCell(lastChangedModel(onModelChange)),
      ),
    ).toBeNull();
  });
});

function renderBlockEditor(
  model: ComposedEditorModel,
  onModelChange: (model: ComposedEditorModel) => void,
) {
  const block = model.blocks[0];
  if (!block) {
    throw new Error("Expected root block.");
  }
  render(
    <BlockEditor
      block={block}
      getTableSelectionForBlock={() =>
        selectTableCell({ columnId: "column_1", rowId: "row_1" })
      }
      model={model}
      onModelChange={onModelChange}
      onSelectReference={() => {}}
      onTableSelectionChange={() => {}}
      referencePreviewCache={{}}
      sources={[]}
      workbookEnabled
    />,
  );
}

function nestedRangeBackedComposedModel(input: {
  includeRangeReference: boolean;
}): ComposedEditorModel {
  return {
    blocks: [
      {
        blocks: [
          nestedSiblingBlock(),
          { id: "table_1", table: rangeBackedTableModel(), type: "table" },
        ],
        containerType: "page",
        id: "page_1",
        title: "Page",
        type: "container",
      },
    ],
    references: input.includeRangeReference
      ? [
          {
            id: "range_ref",
            source: {
              ref: "Sheet1!A1:B2",
              sourceId: "source_1",
              type: "workbook_range",
            },
          },
        ]
      : [],
    responseFields: [],
    schemaVersion: 2,
  };
}

function rangeBackedTableModel(): TableEditorModel {
  return {
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
            id: "text_1",
            type: "text",
          },
        ],
        columnId: "column_1",
        id: "cell_1",
        rowId: "row_1",
      },
    ],
    columns: [{ id: "column_1", label: "Column 1" }],
    prompt: "",
    responseFields: [],
    rows: [{ id: "row_1", label: "Row 1" }],
    showColumnNames: true,
    showRowNames: true,
  };
}

function nestedSiblingBlock(): ComposedEditorBlock {
  return {
    content: [{ text: "Keep", type: "text" }],
    id: "text_1",
    type: "text",
  };
}

function lastChangedModel(
  onModelChange: ReturnType<typeof vi.fn>,
): ComposedEditorModel {
  const model = onModelChange.mock.lastCall?.[0];
  if (!model) {
    throw new Error("Expected model change.");
  }
  return model;
}

function requireTableCell(model: ComposedEditorModel) {
  const table = findComposedBlockById(model.blocks, "table_1");
  if (table?.type !== "table") {
    throw new Error("Expected table block.");
  }
  const cell = table.table.cells[0];
  if (!cell) {
    throw new Error("Expected table cell.");
  }
  return cell;
}

function requireNestedContainer(
  model: ComposedEditorModel,
): Extract<ComposedEditorBlock, { type: "container" }> {
  const block = model.blocks[0];
  if (block?.type !== "container") {
    throw new Error("Expected container.");
  }
  return block;
}

function requireWorkbookCellReferenceId(
  model: ComposedEditorModel,
  ref: string,
) {
  const reference = model.references.find(
    (item) => item.source.type === "workbook_cell" && item.source.ref === ref,
  );
  if (!reference) {
    throw new Error("Expected workbook cell reference.");
  }
  return reference.id;
}
