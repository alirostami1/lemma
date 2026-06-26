// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  type ComponentProps,
  cloneElement,
  type ReactElement,
  useState,
} from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import { WorkbookPickerProvider } from "#/features/questions/table-block-editor";
import { ReferenceEditor } from "./reference-editor";

describe("ReferenceEditor", () => {
  afterEach(() => cleanup());

  it("shows workbook source options in the reference editor", async () => {
    const user = userEvent.setup();

    render(
      <ReferenceEditor
        model={createModel()}
        onModelChange={() => {}}
        onSelectionChange={() => {}}
        referenceId="revenue"
        sources={[]}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Source type" }));
    expect(screen.getByRole("option", { name: "Literal value" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Workbook cell" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Workbook range" })).toBeTruthy();
  });

  it("keeps existing workbook source id when editing workbook reference text", async () => {
    const onModelChange = vi.fn();

    renderReferenceEditor(
      <ReferenceEditor
        model={createWorkbookModel()}
        onModelChange={onModelChange}
        onSelectionChange={() => {}}
        referenceId="revenue"
        sources={workbookSources()}
        workbookEnabled={true}
        workbookSheetNamesBySourceId={{}}
      />,
      onModelChange,
    );

    const sourceCellInput = screen.getByRole("textbox", {
      name: "Cell or range",
    });
    fireEvent.change(sourceCellInput, { target: { value: "B2" } });
    fireEvent.blur(sourceCellInput);

    expect(onModelChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        references: expect.arrayContaining([
          expect.objectContaining({
            id: "workbook:source_2:cell:Sheet1:B2",
            source: {
              ref: "Sheet1!B2",
              sourceId: "source_2",
              type: "workbook_cell",
            },
          }),
        ]),
      }),
    );
  });

  it("uses selected workbook source id after workbook picker selection", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();

    renderReferenceEditor(
      <ReferenceEditor
        model={createWorkbookModel()}
        onModelChange={onModelChange}
        onSelectionChange={() => {}}
        referenceId="revenue"
        sources={workbookSources()}
        workbookEnabled={true}
        workbookSheetNamesBySourceId={{}}
      />,
      onModelChange,
      ({ onSelect }) => {
        onSelect({
          reference: "'Source Three'!C4",
          sourceId: "source_3",
          values: [],
        });
      },
    );

    await user.click(
      screen.getByRole("button", { name: "Open workbook range picker" }),
    );

    expect(onModelChange).toHaveBeenCalledWith(
      expect.objectContaining({
        references: expect.arrayContaining([
          expect.objectContaining({
            id: "workbook:source_3:cell:Source%20Three:C4",
            source: {
              ref: "'Source Three'!C4",
              sourceId: "source_3",
              type: "workbook_cell",
            },
          }),
        ]),
      }),
    );
  });

  it("requires a source when switching a literal reference to workbook references", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();

    renderReferenceEditor(
      <ReferenceEditor
        model={createModel()}
        onModelChange={onModelChange}
        onSelectionChange={() => {}}
        referenceId="revenue"
        sources={[]}
        workbookEnabled={true}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Source type" }));
    await user.click(screen.getByRole("option", { name: "Workbook cell" }));

    expect(
      await screen.findByText(
        "Attach a source before using workbook references.",
      ),
    ).toBeTruthy();
    expect(onModelChange).not.toHaveBeenCalled();
  });
});

function createModel(): ComposedEditorModel {
  return {
    blocks: [],
    references: [
      {
        id: "revenue",
        source: { type: "literal", value: 0 },
      },
    ],
    responseFields: [],
    schemaVersion: 1,
  };
}

function createWorkbookModel(): ComposedEditorModel {
  return {
    blocks: [],
    references: [
      {
        id: "revenue",
        source: {
          ref: "'Sheet1'!A1",
          sourceId: "source_2",
          type: "workbook_cell",
        },
      },
    ],
    responseFields: [],
    schemaVersion: 1,
  };
}

function workbookSources(): QuestionBlueprintWorkbookSource[] {
  return [
    {
      name: "Source Two",
      sourceId: "source_2",
      type: "workbook",
      workbookId: "workbook_2",
    },
    {
      name: "Source Three",
      sourceId: "source_3",
      type: "workbook",
      workbookId: "workbook_3",
    },
  ];
}

function renderReferenceEditor(
  ui: ReactElement<ComponentProps<typeof ReferenceEditor>>,
  onModelChangeSpy?: (model: ComposedEditorModel) => void,
  openWorkbookPicker: (request: {
    selectionRequirement?: object;
    onSelect: (selection: {
      sourceId: string;
      reference: string;
      values: string[][];
    }) => void;
  }) => void = () => {},
) {
  return render(
    <WorkbookPickerProvider value={{ openWorkbookPicker }}>
      <ReferenceEditorHarness onModelChangeSpy={onModelChangeSpy} ui={ui} />
    </WorkbookPickerProvider>,
  );
}

function ReferenceEditorHarness({
  ui,
  onModelChangeSpy,
}: {
  ui: ReactElement<ComponentProps<typeof ReferenceEditor>>;
  onModelChangeSpy?: (model: ComposedEditorModel) => void;
}) {
  const props = ui.props;
  const [model, setModel] = useState<ComposedEditorModel>(props.model);

  return cloneElement(ui, {
    ...props,
    model,
    onModelChange(nextModel: ComposedEditorModel) {
      onModelChangeSpy?.(nextModel);
      setModel(nextModel);
    },
  });
}
