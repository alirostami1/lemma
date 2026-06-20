// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { WorkbookPickerProvider } from "#/features/questions/table-block-editor";
import { ReferenceEditor } from "./reference-editor";

describe("ReferenceEditor", () => {
  afterEach(() => cleanup());

  it("shows workbook source options in the reference editor", async () => {
    const user = userEvent.setup();

    render(
      <ReferenceEditor
        model={createModel()}
        referenceId="revenue"
        workbookEnabled={false}
        onModelChange={() => {}}
        onSelectionChange={() => {}}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Source" }));
    expect(screen.getByRole("option", { name: "Literal value" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Workbook cell" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Workbook range" })).toBeTruthy();
  });

  it("keeps existing workbook source id when editing workbook reference text", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();

    renderReferenceEditor(
      <ReferenceEditor
        model={createWorkbookModel()}
        referenceId="revenue"
        workbookEnabled={true}
        onModelChange={onModelChange}
        onSelectionChange={() => {}}
      />,
    );

    await user.clear(screen.getByLabelText("Source cell"));
    await user.type(screen.getByLabelText("Source cell"), "'Sheet1'!B2");

    expect(onModelChange).toHaveBeenCalledWith(
      expect.objectContaining({
        references: expect.arrayContaining([
          expect.objectContaining({
            id: "revenue",
            source: {
              type: "workbook_cell",
              sourceId: "source_2",
              ref: "'Sheet1'!B2",
            },
          }),
        ]),
      }),
    );
  });

  it("uses explicitly selected workbook source id over manual workbook text edits", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();

    renderReferenceEditor(
      <ReferenceEditor
        model={createWorkbookModel()}
        referenceId="revenue"
        workbookEnabled={true}
        onModelChange={onModelChange}
        onSelectionChange={() => {}}
      />,
      ({ onSelect }) => {
        onSelect({
          sourceId: "source_3",
          reference: "'Source Three'!C4",
          values: [],
        });
      },
    );

    await user.clear(screen.getByLabelText("Source cell"));
    await user.type(screen.getByLabelText("Source cell"), "'Sheet1'!B2");

    expect(onModelChange).toHaveBeenCalledWith(
      expect.objectContaining({
        references: expect.arrayContaining([
          expect.objectContaining({
            id: "revenue",
            source: {
              type: "workbook_cell",
              sourceId: "source_2",
              ref: "'Sheet1'!B2",
            },
          }),
        ]),
      }),
    );

    await user.click(screen.getByRole("button", { name: "Open workbook range picker" }));

    expect(onModelChange).toHaveBeenCalledWith(
      expect.objectContaining({
        references: expect.arrayContaining([
          expect.objectContaining({
            id: "revenue",
            source: {
              type: "workbook_cell",
              sourceId: "source_3",
              ref: "'Source Three'!C4",
            },
          }),
        ]),
      }),
    );
  });
});

function createModel(): ComposedEditorModel {
  return {
    schemaVersion: 1,
    blocks: [],
    responseFields: [],
    references: [
      {
        id: "revenue",
        source: { type: "literal", value: 0 },
      },
    ],
  };
}

function createWorkbookModel(): ComposedEditorModel {
  return {
    schemaVersion: 1,
    blocks: [],
    responseFields: [],
    references: [
      {
        id: "revenue",
        source: {
          type: "workbook_cell",
          sourceId: "source_2",
          ref: "'Sheet1'!A1",
        },
      },
    ],
  };
}

function renderReferenceEditor(
  ui: ReactElement,
  openWorkbookPicker: (request: {
    selectionRequirement?: object;
    onSelect: (selection: {
      sourceId?: string;
      reference: string;
      values: string[][];
    }) => void;
  }) => void = () => {},
) {
  return render(
    <WorkbookPickerProvider value={{ openWorkbookPicker }}>
      {ui}
    </WorkbookPickerProvider>,
  );
}
