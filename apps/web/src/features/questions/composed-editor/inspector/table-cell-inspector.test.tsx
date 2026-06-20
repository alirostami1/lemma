// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ComposedEditorModel,
  TableEditorModel,
} from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { TableCellInspector } from "./table-cell-inspector";

describe("TableCellInspector", () => {
  afterEach(() => cleanup());

  it("creates a matching answer field when switching a content cell to answer", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const onEditorModelChange = vi.fn();
    const referencePreviewCache: ReferencePreviewCache = {};

    renderTableCellInspector({
      model: createContentModel(),
      referencePreviewCache,
      workbookEnabled: false,
      onModelChange,
      onEditorModelChange,
    });

    await user.click(screen.getByRole("combobox", { name: "Type" }));
    await user.click(await screen.findByRole("option", { name: "Answer" }));

    const nextModel = onModelChange.mock.calls.at(-1)?.[0] as TableEditorModel;
    const responseCell = nextModel.cells.find((cell) => cell.id === "cell_1");

    expect(responseCell).toMatchObject({
      type: "response",
      responseFieldId: "answer_1",
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
    const onModelChange = vi.fn();

    renderTableCellInspector({
      model: createAnswerModel(),
      referencePreviewCache: {},
      workbookEnabled: false,
      onModelChange,
    });

    const labelInput = screen.getByDisplayValue("Answer");
    await user.clear(labelInput);
    await user.type(labelInput, "Score");

    const nextModel = onModelChange.mock.calls.at(-1)?.[0] as TableEditorModel;
    expect(nextModel.cells[0]).toMatchObject({
      type: "response",
      label: "Score",
    });
  });

  it("updates the correct answer source", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();

    renderTableCellInspector({
      model: createAnswerModel(),
      referencePreviewCache: {},
      workbookEnabled: false,
      onModelChange,
    });

    await user.clear(screen.getByLabelText("Literal value"));
    await user.type(screen.getByLabelText("Literal value"), "42");

    const nextModel = onModelChange.mock.calls.at(-1)?.[0] as TableEditorModel;
    expect(nextModel.cells[0]).toMatchObject({
      type: "response",
      correctValueSource: { type: "literal", value: 42 },
    });
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
        model={model}
        tableBlockId={tableBlockId}
        cellId={input.cellId ?? "cell_1"}
        editorModel={editorModel}
        referencePreviewCache={input.referencePreviewCache ?? {}}
        workbookEnabled={input.workbookEnabled ?? false}
        activeSourceId={null}
        onModelChange={(nextModel) => {
          handleModelChange(nextModel);
          setModel(nextModel);
        }}
        onEditorModelChange={(nextModel) => {
          handleEditorModelChange(nextModel);
          setEditorModel(nextModel);
        }}
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
    schemaVersion: 1,
    blocks: [
      {
        id: tableBlockId,
        type: "table",
        table: tableModel,
      },
    ],
    responseFields: [],
    references: [],
  };
}

function createContentModel(): TableEditorModel {
  return {
    prompt: "Prompt",
    columns: [{ id: "column_1", label: "Column 1" }],
    rows: [{ id: "row_1", label: "Row 1" }],
    showColumnNames: true,
    showRowNames: true,
    responseFields: [],
    cells: [
      {
        id: "cell_1",
        rowId: "row_1",
        columnId: "column_1",
        type: "content",
        content: [{ type: "text", text: "42" }],
      },
    ],
  };
}

function createAnswerModel(): TableEditorModel {
  return {
    ...createContentModel(),
    responseFields: [
      { id: "answer_1", type: "number", label: "Answer", required: true },
    ],
    cells: [
      {
        id: "cell_1",
        rowId: "row_1",
        columnId: "column_1",
        type: "response",
        responseFieldId: "answer_1",
        label: "Answer",
        placeholder: "Student answer",
        correctValueSource: { type: "literal", value: 7 },
        points: 1,
        grading: { mode: "exact" },
      },
    ],
  };
}

function createBrokenAnswerModel(): TableEditorModel {
  return {
    ...createAnswerModel(),
    responseFields: [],
  };
}
