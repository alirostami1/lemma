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
import { SelectedElementInspector } from "./selected-element-inspector";

describe("SelectedElementInspector table conversion", () => {
  afterEach(() => cleanup());

  it("converts a nested table selection through composed conversion", async () => {
    const user = userEvent.setup();
    const model = nestedRangeBackedComposedModel();
    const onModelChange = vi.fn();

    render(
      <SelectedElementInspector
        model={model}
        onModelChange={onModelChange}
        onSelectionChange={() => {}}
        referencePreviewCache={{}}
        selectedBlock={requireTableBlock(model)}
        selection={{
          blockId: "table_1",
          selection: selectTableCell({ columnId: "column_1", rowId: "row_1" }),
          type: "table_cells",
        }}
        sources={[]}
        workbookEnabled
      />,
    );

    await user.click(screen.getByRole("button", { name: "Answer" }));

    const nextModel = lastChangedModel(onModelChange);
    expect(getPrimaryTableInputBlock(requireTableCell(nextModel))).toEqual(
      expect.objectContaining({
        correctValueSource: {
          referenceId: requireWorkbookCellReferenceId(nextModel, "Sheet1!A1"),
          type: "reference",
        },
        type: "input",
      }),
    );
    expect(requireNestedContainer(nextModel).blocks[0]).toEqual(
      nestedSiblingBlock(),
    );
  });
});

function nestedRangeBackedComposedModel(): ComposedEditorModel {
  return {
    blocks: [
      {
        blocks: [
          nestedSiblingBlock(),
          { id: "table_1", table: rangeBackedTableModel(), type: "table" },
        ],
        containerType: "step",
        id: "step_1",
        title: "Step",
        type: "container",
      },
    ],
    references: [
      {
        id: "range_ref",
        source: {
          ref: "Sheet1!A1:B2",
          sourceId: "source_1",
          type: "workbook_range",
        },
      },
    ],
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

function requireTableBlock(
  model: ComposedEditorModel,
): Extract<ComposedEditorBlock, { type: "table" }> {
  const block = findComposedBlockById(model.blocks, "table_1");
  if (block?.type !== "table") {
    throw new Error("Expected table block.");
  }
  return block;
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
  const table = requireTableBlock(model);
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
