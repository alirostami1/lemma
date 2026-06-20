// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
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
        selectedReferenceId="reference_2"
        referencePreviewCache={createReferencePreviewCache()}
        workbookEnabled={true}
        sources={createSources()}
        previewSourceId={null}
        onModelChange={() => {}}
        onSelectReference={onSelectReference}
        trigger={<button type="button">Choose reference</button>}
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
        referencePreviewCache={createReferencePreviewCache()}
        workbookEnabled={true}
        sources={createSources()}
        previewSourceId={null}
        onModelChange={onModelChange}
        onSelectReference={onSelectReference}
        trigger={<button type="button">Choose reference</button>}
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

  it("blocks workbook reference creation when no preview source is selected", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const onSelectReference = vi.fn();

    renderReferencePicker(
      <ReferencePickerPopover
        model={createModel()}
        referencePreviewCache={createReferencePreviewCache()}
        workbookEnabled={true}
        sources={createSources()}
        previewSourceId={null}
        createSourceTypeDefault="workbook_cell"
        onModelChange={onModelChange}
        onSelectReference={onSelectReference}
        trigger={<button type="button">Choose reference</button>}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Choose reference" }));
    await user.click(screen.getByRole("tab", { name: "Create new" }));
    fireEvent.change(screen.getByLabelText("Reference id"), {
      target: { value: "cell_ref" },
    });
    await user.type(screen.getByLabelText("Source cell"), "'Sheet1'!A1");
    await user.click(
      screen.getByRole("button", { name: "Create and use reference" }),
    );

    expect(screen.getByText("Select a workbook cell or range.")).toBeTruthy();
    expect(onSelectReference).not.toHaveBeenCalled();
    expect(onModelChange).not.toHaveBeenCalled();
  });

  it("uses the selected workbook source when creating workbook cell reference manually", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const onSelectReference = vi.fn();

    renderReferencePicker(
      <ReferencePickerPopover
        model={createModel()}
        referencePreviewCache={createReferencePreviewCache()}
        workbookEnabled={true}
        sources={createSources()}
        previewSourceId="source_2"
        onModelChange={onModelChange}
        onSelectReference={onSelectReference}
        trigger={<button type="button">Choose reference</button>}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Choose reference" }));
    await user.click(screen.getByRole("tab", { name: "Create new" }));
    await user.clear(screen.getByLabelText("Reference id"));
    await user.type(screen.getByLabelText("Reference id"), "cell_ref");
    await user.click(screen.getByRole("combobox", { name: "Source type" }));
    await user.click(screen.getByRole("option", { name: "Workbook cell" }));
    await user.type(screen.getByLabelText("Source cell"), "'Sheet1'!A1");
    await user.click(
      screen.getByRole("button", { name: "Create and use reference" }),
    );

    expect(onSelectReference).toHaveBeenCalledWith("cell_ref");
    expect(onModelChange).toHaveBeenCalledWith(
      expect.objectContaining({
        references: expect.arrayContaining([
          expect.objectContaining({
            id: "cell_ref",
            source: {
              type: "workbook_cell",
              sourceId: "source_2",
              ref: "'Sheet1'!A1",
            },
          }),
        ]),
      }),
    );
  });

  it("uses selected workbook source id over preview source when picker selection changes", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();

    renderReferencePicker(
      <ReferencePickerPopover
        model={createModel()}
        referencePreviewCache={createReferencePreviewCache()}
        workbookEnabled={true}
        sources={createSources()}
        previewSourceId="source_1"
        onModelChange={onModelChange}
        onSelectReference={() => {}}
        createSourceTypeDefault="workbook_cell"
        trigger={<button type="button">Choose reference</button>}
      />,
      ({ onSelect }) => {
        onSelect({
          sourceId: "source_2",
          reference: "'Sheet2'!B2",
          values: [],
        });
      },
    );

    await user.click(screen.getByRole("button", { name: "Choose reference" }));
    await user.click(screen.getByRole("tab", { name: "Create new" }));
    await user.clear(screen.getByLabelText("Reference id"));
    await user.type(screen.getByLabelText("Reference id"), "cell_ref_2");
    await user.type(screen.getByLabelText("Source cell"), "'Sheet1'!A1");
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
            id: "cell_ref_2",
            source: {
              type: "workbook_cell",
              sourceId: "source_2",
              ref: "'Sheet2'!B2",
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
        referencePreviewCache={createReferencePreviewCache()}
        workbookEnabled={false}
        sources={[]}
        previewSourceId={null}
        onModelChange={() => {}}
        onSelectReference={() => {}}
        trigger={<button type="button">Choose reference</button>}
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
    schemaVersion: 1,
    blocks: [],
    responseFields: [],
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
      referenceId: "reference_1",
      status: "resolved",
      displayValue: "Alpha",
      rawValue: "alpha",
      updatedAt: 1,
    },
    reference_2: {
      referenceId: "reference_2",
      status: "resolved",
      displayValue: "Beta",
      rawValue: "beta",
      updatedAt: 1,
    },
  };
}

function createSources() {
  return [
    {
      sourceId: "source_1",
      name: "Source 1",
      workbookId: "workbook-1",
    },
    {
      sourceId: "source_2",
      name: "Source 2",
      workbookId: "workbook-2",
    },
  ];
}
