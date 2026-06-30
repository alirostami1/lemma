// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ComposedEditorModel,
  createDefaultTableEditorModel,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import { WorkbookPickerProvider } from "#/features/questions/table-block-editor";
import { TableInspector } from "./table-inspector";

describe("TableInspector", () => {
  afterEach(() => cleanup());

  it("only creates workbook ranges from the table range add reference flow", async () => {
    const user = userEvent.setup();
    const onEditorModelChange = vi.fn();

    render(
      <WorkbookPickerProvider value={{ openWorkbookPicker: () => {} }}>
        <TableInspector
          blockId="table_1"
          editorModel={createEditorModel()}
          model={createDefaultTableEditorModel()}
          onEditorModelChange={onEditorModelChange}
          onModelChange={() => {}}
          onSelectionChange={() => {}}
          referencePreviewCache={{}}
          sources={createSources()}
          workbookEnabled
          workbookSheetNamesBySourceId={{}}
        />
      </WorkbookPickerProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    await user.click(screen.getByRole("button", { name: /^Workbook/ }));
    await user.click(screen.getByRole("button", { name: "Source 1" }));
    await user.type(screen.getByLabelText("Sheet"), "Sheet1");
    await user.type(screen.getByLabelText("Cell or range"), "A1");
    await user.click(screen.getByRole("button", { name: "Add this value" }));

    expect(screen.getByText("Select a range, for example A1:B3.")).toBeTruthy();
    expect(onEditorModelChange).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Cell or range"));
    await user.type(screen.getByLabelText("Cell or range"), "A1:B3");
    await user.click(screen.getByRole("button", { name: "Add this value" }));

    expect(onEditorModelChange).toHaveBeenCalledWith(
      expect.objectContaining({
        references: expect.arrayContaining([
          expect.objectContaining({
            id: "workbook:source_1:range:Sheet1:A1:B3",
            source: {
              ref: "Sheet1!A1:B3",
              sourceId: "source_1",
              type: "workbook_range",
            },
          }),
        ]),
      }),
    );
  });
});

function createEditorModel(): ComposedEditorModel {
  return {
    blocks: [],
    references: [],
    responseFields: [],
    schemaVersion: 2,
  };
}

function createSources(): QuestionBlueprintWorkbookSource[] {
  return [
    {
      name: "Source 1",
      sourceId: "source_1",
      type: "workbook",
      workbookId: "workbook-1",
    },
  ];
}
