// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ComposedEditorModel,
  TableEditorModel,
} from "#/domains/questions/authoring";
import { getPrimaryTableInputBlock } from "#/domains/questions/authoring/table-model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { TableCellInspector } from "./table-cell-inspector";

describe("TableCellInspector", () => {
  afterEach(() => cleanup());

  it("creates a matching answer field when switching a content cell to answer", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn<(model: TableEditorModel) => void>();
    const onEditorModelChange = vi.fn<(model: ComposedEditorModel) => void>();
    const referencePreviewCache: ReferencePreviewCache = {};

    renderTableCellInspector({
      model: createContentModel(),
      onEditorModelChange,
      onModelChange,
      referencePreviewCache,
      workbookEnabled: false,
    });

    await user.click(screen.getByRole("combobox", { name: "Type" }));
    await user.click(await screen.findByRole("option", { name: "Answer" }));

    const nextModel = onModelChange.mock.calls.at(-1)?.[0];
    if (!nextModel) {
      throw new Error("Expected updated table model.");
    }
    const responseCell = nextModel.cells.find((cell) => cell.id === "cell_1");
    const inputBlock = responseCell
      ? getPrimaryTableInputBlock(responseCell)
      : null;

    expect(inputBlock).toMatchObject({
      responseFieldId: "answer_1",
      type: "input",
    });
    expect(nextModel.responseFields).toEqual([
      expect.objectContaining({
        id: "answer_1",
        type: "number",
      }),
    ]);
  });

  it("shows a repair action when the answer field is missing", () => {
    renderTableCellInspector({
      model: createBrokenAnswerModel(),
      referencePreviewCache: {},
      workbookEnabled: false,
    });

    expect(
      screen.getByRole("button", { name: "Repair answer field" }),
    ).toBeTruthy();
    expect(screen.getByText("Missing answer field")).toBeTruthy();
  });

  it("updates the answer cell label", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn<(model: TableEditorModel) => void>();

    renderTableCellInspector({
      model: createAnswerModel(),
      onModelChange,
      referencePreviewCache: {},
      workbookEnabled: false,
    });

    const labelInput = screen.getByDisplayValue("Answer");
    await user.clear(labelInput);
    await user.type(labelInput, "Score");

    const nextModel = onModelChange.mock.calls.at(-1)?.[0];
    if (!nextModel) {
      throw new Error("Expected updated table model.");
    }
    const cell = nextModel.cells[0];
    if (!cell) {
      throw new Error("Expected updated cell.");
    }
    expect(getPrimaryTableInputBlock(cell)).toMatchObject({
      label: "Score",
      type: "input",
    });
  });

  it("updates the correct answer source", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn<(model: TableEditorModel) => void>();

    renderTableCellInspector({
      model: createAnswerModel(),
      onModelChange,
      referencePreviewCache: {},
      workbookEnabled: false,
    });

    await user.clear(screen.getByLabelText("Value"));
    await user.type(screen.getByLabelText("Value"), "42");

    const nextModel = onModelChange.mock.calls.at(-1)?.[0];
    if (!nextModel) {
      throw new Error("Expected updated table model.");
    }
    const cell = nextModel.cells[0];
    if (!cell) {
      throw new Error("Expected updated cell.");
    }
    expect(getPrimaryTableInputBlock(cell)).toMatchObject({
      correctValueSource: { type: "literal", value: 42 },
      type: "input",
    });
  });

  it("shows a correct-answer repair path for non-manual input missing a source", () => {
    renderTableCellInspector({
      model: {
        ...createAnswerModel(),
        cells: [
          {
            blocks: [
              {
                grading: { mode: "exact" },
                id: "cell_1_input",
                points: 1,
                responseFieldId: "answer_1",
                type: "input",
              },
            ],
            columnId: "column_1",
            id: "cell_1",
            rowId: "row_1",
          },
        ],
      },
      referencePreviewCache: {},
      workbookEnabled: false,
    });

    expect(screen.getByText("Correct answer")).toBeTruthy();
    expect(screen.getByLabelText("Value")).toBeTruthy();
  });
});

function renderTableCellInspector(input: {
  model: TableEditorModel;
  cellId?: string;
  editorModel?: ComposedEditorModel;
  referencePreviewCache?: ReferencePreviewCache;
  workbookEnabled?: boolean;
  onModelChange?: (model: TableEditorModel) => void;
  onEditorModelChange?: (model: ComposedEditorModel) => void;
}) {
  const tableBlockId = "table_1";
  const handleModelChange = input.onModelChange ?? (() => undefined);
  const handleEditorModelChange =
    input.onEditorModelChange ?? (() => undefined);

  function InspectorHarness() {
    const [model, setModel] = useState(input.model);
    const [editorModel, setEditorModel] = useState(
      input.editorModel ??
        createEditorModelWithTable(tableBlockId, input.model),
    );

    return (
      <TableCellInspector
        cellId={input.cellId ?? "cell_1"}
        editorModel={editorModel}
        model={model}
        onEditorModelChange={(nextModel) => {
          handleEditorModelChange(nextModel);
          setEditorModel(nextModel);
        }}
        onModelChange={(nextModel) => {
          handleModelChange(nextModel);
          setModel(nextModel);
        }}
        referencePreviewCache={input.referencePreviewCache ?? {}}
        sources={[]}
        tableBlockId={tableBlockId}
        workbookEnabled={input.workbookEnabled ?? false}
        workbookSheetNamesBySourceId={{}}
      />
    );
  }

  return render(<InspectorHarness />);
}

function createEditorModelWithTable(
  tableBlockId: string,
  tableModel: TableEditorModel,
): ComposedEditorModel {
  return {
    blocks: [
      {
        id: tableBlockId,
        table: tableModel,
        type: "table",
      },
    ],
    references: [],
    responseFields: [],
    schemaVersion: 2,
  };
}

function createContentModel(): TableEditorModel {
  return {
    cells: [
      {
        blocks: [
          {
            content: [{ text: "42", type: "text" }],
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
    prompt: "Prompt",
    responseFields: [],
    rows: [{ id: "row_1", label: "Row 1" }],
    showColumnNames: true,
    showRowNames: true,
  };
}

function createAnswerModel(): TableEditorModel {
  return {
    ...createContentModel(),
    cells: [
      {
        blocks: [
          {
            correctValueSource: { type: "literal", value: 7 },
            grading: { mode: "exact" },
            id: "cell_1_input",
            label: "Answer",
            placeholder: "Student answer",
            points: 1,
            responseFieldId: "answer_1",
            type: "input",
          },
        ],
        columnId: "column_1",
        id: "cell_1",
        rowId: "row_1",
      },
    ],
    responseFields: [
      { id: "answer_1", label: "Answer", required: true, type: "number" },
    ],
  };
}

function createBrokenAnswerModel(): TableEditorModel {
  return {
    ...createAnswerModel(),
    responseFields: [],
  };
}
