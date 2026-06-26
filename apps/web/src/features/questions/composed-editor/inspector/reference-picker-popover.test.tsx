// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { WorkbookPickerProvider } from "#/features/questions/table-block-editor";
import { ReferencePickerPopover } from "./reference-picker-popover";

describe("ReferencePickerPopover", () => {
  afterEach(() => cleanup());

  it("lists existing references and selects one", async () => {
    const user = userEvent.setup();
    const onSelectReference = vi.fn();

    renderReferencePicker(
      <ReferencePickerPopover
        model={createModel()}
        onModelChange={() => {}}
        onSelectReference={onSelectReference}
        referencePreviewCache={createReferencePreviewCache()}
        selectedReferenceId="reference_2"
        sources={[]}
        trigger={<button type="button">Choose reference</button>}
        workbookEnabled={true}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Choose reference" }));
    await user.click(screen.getByRole("button", { name: /Revenue/ }));

    expect(onSelectReference).toHaveBeenCalledWith("reference_1");
    expect(screen.queryByLabelText("Reference id")).toBeNull();
  });

  it("creates a literal reference and closes", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const onSelectReference = vi.fn();

    renderReferencePicker(
      <ReferencePickerPopover
        model={createModel()}
        onModelChange={onModelChange}
        onSelectReference={onSelectReference}
        referencePreviewCache={createReferencePreviewCache()}
        sources={createSources()}
        trigger={<button type="button">Choose reference</button>}
        workbookEnabled={true}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Choose reference" }));
    await user.click(screen.getByRole("tab", { name: "Create new" }));
    await user.clear(screen.getByLabelText("Reference id"));
    await user.type(screen.getByLabelText("Reference id"), "sales_ref");
    await user.type(screen.getByLabelText("Literal value"), "42");
    await user.click(
      screen.getByRole("button", { name: "Create and use reference" }),
    );

    expect(onModelChange).toHaveBeenCalledWith(
      expect.objectContaining({
        references: expect.arrayContaining([
          expect.objectContaining({
            id: "reference_1",
          }),
          expect.objectContaining({
            id: "reference_2",
          }),
          expect.objectContaining({
            id: "sales_ref",
            source: { type: "literal", value: 42 },
          }),
        ]),
      }),
    );
    expect(onSelectReference).toHaveBeenCalledWith("sales_ref");
    expect(screen.queryByLabelText("Reference id")).toBeNull();
  });

  it("creates workbook reference with chosen source", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const onSelectReference = vi.fn();

    renderReferencePicker(
      <ReferencePickerPopover
        createSourceTypeDefault="workbook_cell"
        model={createModel()}
        onModelChange={onModelChange}
        onSelectReference={onSelectReference}
        referencePreviewCache={createReferencePreviewCache()}
        sources={createSources()}
        trigger={<button type="button">Choose reference</button>}
        workbookEnabled={true}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Choose reference" }));
    await user.click(screen.getByRole("tab", { name: "Create new" }));
    await user.click(screen.getByRole("combobox", { name: "Source" }));
    await user.click(
      screen.getByRole("option", { name: "Source 1 (source_1)" }),
    );
    await user.type(screen.getByLabelText("Sheet"), "Sheet1");
    await user.type(screen.getByLabelText("Cell or range"), "A1");
    await user.click(
      screen.getByRole("button", { name: "Create and use reference" }),
    );

    expect(onSelectReference).toHaveBeenCalledWith(
      "workbook:source_1:cell:Sheet1:A1",
    );
    expect(onModelChange).toHaveBeenCalledWith(
      expect.objectContaining({
        references: expect.arrayContaining([
          expect.objectContaining({
            id: "workbook:source_1:cell:Sheet1:A1",
            source: {
              ref: "Sheet1!A1",
              sourceId: "source_1",
              type: "workbook_cell",
            },
          }),
        ]),
      }),
    );
  });

  it("uses chosen workbook source when creating workbook cell reference manually", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const onSelectReference = vi.fn();

    renderReferencePicker(
      <ReferencePickerPopover
        model={createModel()}
        onModelChange={onModelChange}
        onSelectReference={onSelectReference}
        referencePreviewCache={createReferencePreviewCache()}
        sources={createSources()}
        trigger={<button type="button">Choose reference</button>}
        workbookEnabled={true}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Choose reference" }));
    await user.click(screen.getByRole("tab", { name: "Create new" }));
    await user.click(screen.getByRole("combobox", { name: "Source type" }));
    await user.click(screen.getByRole("option", { name: "Workbook cell" }));
    await user.click(screen.getByRole("combobox", { name: "Source" }));
    await user.click(
      screen.getByRole("option", { name: "Source 2 (source_2)" }),
    );
    await user.type(screen.getByLabelText("Sheet"), "Sheet1");
    await user.type(screen.getByLabelText("Cell or range"), "A1");
    await user.click(
      screen.getByRole("button", { name: "Create and use reference" }),
    );

    expect(onSelectReference).toHaveBeenCalledWith(
      "workbook:source_2:cell:Sheet1:A1",
    );
    expect(onModelChange).toHaveBeenCalledWith(
      expect.objectContaining({
        references: expect.arrayContaining([
          expect.objectContaining({
            id: "workbook:source_2:cell:Sheet1:A1",
            source: {
              ref: "Sheet1!A1",
              sourceId: "source_2",
              type: "workbook_cell",
            },
          }),
        ]),
      }),
    );
  });

  it("uses workbook picker source id when picker selection changes", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();

    renderReferencePicker(
      <ReferencePickerPopover
        createSourceTypeDefault="workbook_cell"
        model={createModel()}
        onModelChange={onModelChange}
        onSelectReference={() => {}}
        referencePreviewCache={createReferencePreviewCache()}
        sources={createSources()}
        trigger={<button type="button">Choose reference</button>}
        workbookEnabled={true}
        workbookSheetNamesBySourceId={{}}
      />,
      ({ onSelect }) => {
        onSelect({
          reference: "'Sheet2'!B2",
          sourceId: "source_2",
          values: [],
        });
      },
    );

    await user.click(screen.getByRole("button", { name: "Choose reference" }));
    await user.click(screen.getByRole("tab", { name: "Create new" }));
    await user.click(screen.getByRole("combobox", { name: "Source" }));
    await user.click(
      screen.getByRole("option", { name: "Source 1 (source_1)" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Open workbook range picker" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Create and use reference" }),
    );

    expect(onModelChange).toHaveBeenCalledWith(
      expect.objectContaining({
        references: expect.arrayContaining([
          expect.objectContaining({
            id: "workbook:source_2:cell:Sheet2:B2",
            source: {
              ref: "Sheet2!B2",
              sourceId: "source_2",
              type: "workbook_cell",
            },
          }),
        ]),
      }),
    );
  });

  it("shows validation errors for invalid and duplicate ids", async () => {
    const user = userEvent.setup();

    renderReferencePicker(
      <ReferencePickerPopover
        model={createModel()}
        onModelChange={() => {}}
        onSelectReference={() => {}}
        referencePreviewCache={createReferencePreviewCache()}
        sources={[]}
        trigger={<button type="button">Choose reference</button>}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Choose reference" }));
    await user.click(screen.getByRole("tab", { name: "Create new" }));
    await user.clear(screen.getByLabelText("Reference id"));
    await user.click(
      screen.getByRole("button", { name: "Create and use reference" }),
    );
    expect(
      screen.getByText(
        "Reference id must start with a letter and use letters, numbers, underscores, or hyphens.",
      ),
    ).toBeTruthy();

    await user.clear(screen.getByLabelText("Reference id"));
    await user.type(screen.getByLabelText("Reference id"), "reference_1");
    await user.click(
      screen.getByRole("button", { name: "Create and use reference" }),
    );
    expect(screen.getByText("Reference id already exists.")).toBeTruthy();
  });
});

function createModel(): ComposedEditorModel {
  return {
    blocks: [],
    references: [
      {
        id: "reference_1",
        label: "Revenue",
        source: { type: "literal", value: "alpha" },
      },
      {
        id: "reference_2",
        label: "Cost",
        source: { type: "literal", value: "beta" },
      },
    ],
    responseFields: [],
    schemaVersion: 1,
  };
}

function renderReferencePicker(
  ui: ReactElement,
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
      {ui}
    </WorkbookPickerProvider>,
  );
}

function createReferencePreviewCache(): ReferencePreviewCache {
  return {
    reference_1: {
      displayValue: "Alpha",
      rawValue: "alpha",
      referenceId: "reference_1",
      status: "resolved",
      updatedAt: 1,
    },
    reference_2: {
      displayValue: "Beta",
      rawValue: "beta",
      referenceId: "reference_2",
      status: "resolved",
      updatedAt: 1,
    },
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
    {
      name: "Source 2",
      sourceId: "source_2",
      type: "workbook",
      workbookId: "workbook-2",
    },
  ];
}
