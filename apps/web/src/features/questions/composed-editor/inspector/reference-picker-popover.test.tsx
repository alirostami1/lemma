// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { WorkbookPickerProvider } from "#/features/questions/table-block-editor";
import { AddReferenceActionsProvider } from "./add-reference-actions";
import { ReferencePickerPopover } from "./reference-picker-popover";

describe("ReferencePickerPopover", () => {
  afterEach(() => cleanup());

  it("reuses an existing value only after its type is chosen", async () => {
    const user = userEvent.setup();
    const onSelectReference = vi.fn();

    renderReferencePicker(
      <ReferencePickerPopover
        model={createModel()}
        onModelChange={() => {}}
        onSelectReference={onSelectReference}
        referencePreviewCache={createReferencePreviewCache()}
        sources={[]}
        trigger={<button type="button">Add reference</button>}
        workbookEnabled={true}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    expect(screen.queryByText("Upload a new file")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Add reference" }));
    expect(screen.queryByRole("button", { name: /Revenue/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: /^Literal/ }));
    await user.click(screen.getByRole("button", { name: /Revenue/ }));

    expect(onSelectReference).toHaveBeenCalledWith("reference_1");
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  it("creates a literal with a human label and a hidden generated id", async () => {
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
        trigger={<button type="button">Add reference</button>}
        workbookEnabled={true}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    expect(screen.getByRole("button", { name: /^Workbook/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Python/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Literal/ })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /^Literal/ }));
    await user.type(screen.getByLabelText("Name"), "Tax rate");
    await user.type(screen.getByLabelText("Value"), "42");
    expect(screen.queryByText(/must start with a letter/i)).toBeNull();
    expect(screen.queryByText(/Reference id/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Add this value" }));

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
            id: "reference_3",
            label: "Tax rate",
            source: { type: "literal", value: 42 },
          }),
        ]),
      }),
    );
    expect(onSelectReference).toHaveBeenCalledWith("reference_3");
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  it("offers workbook upload only inside the add reference flow", async () => {
    const user = userEvent.setup();
    const onUploadWorkbook = vi.fn();

    render(
      <WorkbookPickerProvider value={{ openWorkbookPicker: () => {} }}>
        <AddReferenceActionsProvider value={{ onUploadWorkbook }}>
          <ReferencePickerPopover
            model={createModel()}
            onModelChange={() => {}}
            onSelectReference={() => {}}
            referencePreviewCache={createReferencePreviewCache()}
            sources={[]}
            trigger={<button type="button">Add reference</button>}
            workbookEnabled
            workbookSheetNamesBySourceId={{}}
          />
        </AddReferenceActionsProvider>
      </WorkbookPickerProvider>,
    );

    expect(screen.queryByText("Upload a new file")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Add reference" }));
    await user.click(screen.getByRole("button", { name: /^Workbook/ }));

    expect(
      screen.getByRole("button", {
        name: "Choose from library (not available yet)",
      }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Upload a new file" }));

    expect(onUploadWorkbook).toHaveBeenCalledOnce();
  });

  it("keeps Python disabled without opening another creation path", async () => {
    const user = userEvent.setup();

    renderReferencePicker(
      <ReferencePickerPopover
        model={createModel()}
        onModelChange={() => {}}
        onSelectReference={() => {}}
        referencePreviewCache={createReferencePreviewCache()}
        sources={createSources()}
        trigger={<button type="button">Add reference</button>}
        workbookEnabled
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    const python = screen.getByRole("button", { name: /^Python/ });
    expect(python).toBeDisabled();
    await user.click(python);

    expect(
      screen.queryByText("Python values are not available yet."),
    ).toBeNull();
    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(screen.queryByText("Workbooks in this blueprint")).toBeNull();
  });

  it("does not offer workbook cells when only ranges are allowed", async () => {
    const user = userEvent.setup();
    const model: ComposedEditorModel = {
      ...createModel(),
      references: [
        {
          id: "workbook:source_1:cell:Sheet1:A1",
          label: "Cell value",
          source: {
            ref: "Sheet1!A1",
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
        {
          id: "workbook:source_1:range:Sheet1:A1:B2",
          label: "Range value",
          source: {
            ref: "Sheet1!A1:B2",
            sourceId: "source_1",
            type: "workbook_range",
          },
        },
      ],
    };

    renderReferencePicker(
      <ReferencePickerPopover
        allowedSourceTypes={["workbook_range"]}
        model={model}
        onModelChange={() => {}}
        onSelectReference={() => {}}
        referencePreviewCache={{}}
        sources={createSources()}
        trigger={<button type="button">Add reference</button>}
        workbookEnabled
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    await user.click(screen.getByRole("button", { name: /^Workbook/ }));

    expect(screen.getByRole("button", { name: /Range value/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Cell value/ })).toBeNull();
  });

  it("rejects a single cell when creating a range-only workbook value", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const onSelectReference = vi.fn();

    renderReferencePicker(
      <ReferencePickerPopover
        allowedSourceTypes={["workbook_range"]}
        createSourceTypeDefault="workbook_range"
        model={createModel()}
        onModelChange={onModelChange}
        onSelectReference={onSelectReference}
        referencePreviewCache={createReferencePreviewCache()}
        sources={createSources()}
        trigger={<button type="button">Add reference</button>}
        workbookEnabled
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    await user.click(screen.getByRole("button", { name: /^Workbook/ }));
    await user.click(screen.getByRole("button", { name: "Source 1" }));
    await user.type(screen.getByLabelText("Sheet"), "Sheet1");
    await user.type(screen.getByLabelText("Cell or range"), "A1");
    await user.click(screen.getByRole("button", { name: "Add this value" }));

    expect(screen.getByText("Select a range, for example A1:B3.")).toBeTruthy();
    expect(onModelChange).not.toHaveBeenCalled();
    expect(onSelectReference).not.toHaveBeenCalled();
  });

  it("does not offer duplicate reuse for a cell in a range-only flow", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const onSelectReference = vi.fn();
    const model: ComposedEditorModel = {
      ...createModel(),
      references: [
        ...createModel().references,
        {
          id: "workbook:source_1:cell:Sheet1:A1",
          source: {
            ref: "Sheet1!A1",
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
      ],
    };

    renderReferencePicker(
      <ReferencePickerPopover
        allowedSourceTypes={["workbook_range"]}
        createSourceTypeDefault="workbook_range"
        model={model}
        onModelChange={onModelChange}
        onSelectReference={onSelectReference}
        referencePreviewCache={createReferencePreviewCache()}
        sources={createSources()}
        trigger={<button type="button">Add reference</button>}
        workbookEnabled
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    await user.click(screen.getByRole("button", { name: /^Workbook/ }));
    await user.click(screen.getByRole("button", { name: "Source 1" }));
    await user.type(screen.getByLabelText("Sheet"), "Sheet1");
    await user.type(screen.getByLabelText("Cell or range"), "A1");

    expect(screen.queryByText("Use existing value")).toBeNull();
    expect(
      screen.queryByText(
        "This selection is already available and will be reused.",
      ),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "Add this value" }));

    expect(screen.getByText("Select a range, for example A1:B3.")).toBeTruthy();
    expect(onModelChange).not.toHaveBeenCalled();
    expect(onSelectReference).not.toHaveBeenCalled();
  });

  it("rejects a range when creating a cell-only workbook value", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const onSelectReference = vi.fn();

    renderReferencePicker(
      <ReferencePickerPopover
        allowedSourceTypes={["workbook_cell"]}
        createSourceTypeDefault="workbook_cell"
        model={createModel()}
        onModelChange={onModelChange}
        onSelectReference={onSelectReference}
        referencePreviewCache={createReferencePreviewCache()}
        sources={createSources()}
        trigger={<button type="button">Add reference</button>}
        workbookEnabled
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    await user.click(screen.getByRole("button", { name: /^Workbook/ }));
    await user.click(screen.getByRole("button", { name: "Source 1" }));
    await user.type(screen.getByLabelText("Sheet"), "Sheet1");
    await user.type(screen.getByLabelText("Cell or range"), "A1:B3");
    await user.click(screen.getByRole("button", { name: "Add this value" }));

    expect(
      screen.getByText("Select a single cell, for example A1."),
    ).toBeTruthy();
    expect(onModelChange).not.toHaveBeenCalled();
    expect(onSelectReference).not.toHaveBeenCalled();
  });

  it("does not offer duplicate reuse for a range in a cell-only flow", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const onSelectReference = vi.fn();
    const model: ComposedEditorModel = {
      ...createModel(),
      references: [
        ...createModel().references,
        {
          id: "workbook:source_1:range:Sheet1:A1:B3",
          source: {
            ref: "Sheet1!A1:B3",
            sourceId: "source_1",
            type: "workbook_range",
          },
        },
      ],
    };

    renderReferencePicker(
      <ReferencePickerPopover
        allowedSourceTypes={["workbook_cell"]}
        createSourceTypeDefault="workbook_cell"
        model={model}
        onModelChange={onModelChange}
        onSelectReference={onSelectReference}
        referencePreviewCache={createReferencePreviewCache()}
        sources={createSources()}
        trigger={<button type="button">Add reference</button>}
        workbookEnabled
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    await user.click(screen.getByRole("button", { name: /^Workbook/ }));
    await user.click(screen.getByRole("button", { name: "Source 1" }));
    await user.type(screen.getByLabelText("Sheet"), "Sheet1");
    await user.type(screen.getByLabelText("Cell or range"), "A1:B3");

    expect(screen.queryByText("Use existing value")).toBeNull();
    expect(
      screen.queryByText(
        "This selection is already available and will be reused.",
      ),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "Add this value" }));

    expect(
      screen.getByText("Select a single cell, for example A1."),
    ).toBeTruthy();
    expect(onModelChange).not.toHaveBeenCalled();
    expect(onSelectReference).not.toHaveBeenCalled();
  });

  it("uses a safe workbook fallback without showing internal ids", async () => {
    const user = userEvent.setup();

    renderReferencePicker(
      <ReferencePickerPopover
        model={createModel()}
        onModelChange={() => {}}
        onSelectReference={() => {}}
        referencePreviewCache={{}}
        sources={[
          {
            name: "",
            sourceId: "internal-source-id",
            type: "workbook",
            workbookId: "internal-workbook-id",
          },
        ]}
        trigger={<button type="button">Add reference</button>}
        workbookEnabled
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    await user.click(screen.getByRole("button", { name: /^Workbook/ }));

    expect(screen.getByRole("button", { name: "Workbook" })).toBeTruthy();
    expect(screen.queryByText("internal-source-id")).toBeNull();
    expect(screen.queryByText("internal-workbook-id")).toBeNull();
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
        trigger={<button type="button">Add reference</button>}
        workbookEnabled={true}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    await user.click(screen.getByRole("button", { name: /^Workbook/ }));
    await user.click(screen.getByRole("button", { name: "Source 1" }));
    await user.type(screen.getByLabelText("Sheet"), "Sheet1");
    await user.type(screen.getByLabelText("Cell or range"), "A1");
    await user.click(screen.getByRole("button", { name: "Add this value" }));

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
        trigger={<button type="button">Add reference</button>}
        workbookEnabled={true}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    await user.click(screen.getByRole("button", { name: /^Workbook/ }));
    await user.click(screen.getByRole("button", { name: "Source 2" }));
    await user.type(screen.getByLabelText("Sheet"), "Sheet1");
    await user.type(screen.getByLabelText("Cell or range"), "A1");
    await user.click(screen.getByRole("button", { name: "Add this value" }));

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

  it("creates workbook range references when range mode receives a range", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const onSelectReference = vi.fn();

    renderReferencePicker(
      <ReferencePickerPopover
        allowedSourceTypes={["workbook_range"]}
        createSourceTypeDefault="workbook_range"
        model={createModel()}
        onModelChange={onModelChange}
        onSelectReference={onSelectReference}
        referencePreviewCache={createReferencePreviewCache()}
        sources={createSources()}
        trigger={<button type="button">Add reference</button>}
        workbookEnabled
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    await user.click(screen.getByRole("button", { name: /^Workbook/ }));
    await user.click(screen.getByRole("button", { name: "Source 1" }));
    await user.type(screen.getByLabelText("Sheet"), "Sheet1");
    await user.type(screen.getByLabelText("Cell or range"), "A1:B3");
    await user.click(screen.getByRole("button", { name: "Add this value" }));

    expect(onSelectReference).toHaveBeenCalledWith(
      "workbook:source_1:range:Sheet1:A1:B3",
    );
    expect(onModelChange).toHaveBeenCalledWith(
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

  it("reuses duplicate workbook ranges only when range type is allowed", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const onSelectReference = vi.fn();
    const model: ComposedEditorModel = {
      ...createModel(),
      references: [
        ...createModel().references,
        {
          id: "workbook:source_1:range:Sheet1:A1:B3",
          source: {
            ref: "Sheet1!A1:B3",
            sourceId: "source_1",
            type: "workbook_range",
          },
        },
      ],
    };

    renderReferencePicker(
      <ReferencePickerPopover
        allowedSourceTypes={["workbook_range"]}
        createSourceTypeDefault="workbook_range"
        model={model}
        onModelChange={onModelChange}
        onSelectReference={onSelectReference}
        referencePreviewCache={createReferencePreviewCache()}
        sources={createSources()}
        trigger={<button type="button">Add reference</button>}
        workbookEnabled
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    await user.click(screen.getByRole("button", { name: /^Workbook/ }));
    await user.click(screen.getByRole("button", { name: "Source 1" }));
    await user.type(screen.getByLabelText("Sheet"), "Sheet1");
    await user.type(screen.getByLabelText("Cell or range"), "A1:B3");
    await user.click(
      screen.getByRole("button", { name: "Use existing value" }),
    );

    expect(onModelChange).toHaveBeenCalledWith(model);
    expect(onSelectReference).toHaveBeenCalledWith(
      "workbook:source_1:range:Sheet1:A1:B3",
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
        trigger={<button type="button">Add reference</button>}
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

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    await user.click(screen.getByRole("button", { name: /^Workbook/ }));
    await user.click(screen.getByRole("button", { name: "Source 1" }));
    await user.click(
      screen.getByRole("button", { name: "Open workbook range picker" }),
    );
    await user.click(screen.getByRole("button", { name: "Add this value" }));

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

  it("asks for a label without exposing internal identifier rules", async () => {
    const user = userEvent.setup();

    renderReferencePicker(
      <ReferencePickerPopover
        model={createModel()}
        onModelChange={() => {}}
        onSelectReference={() => {}}
        referencePreviewCache={createReferencePreviewCache()}
        sources={[]}
        trigger={<button type="button">Add reference</button>}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    await user.click(screen.getByRole("button", { name: /^Literal/ }));
    await user.clear(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: "Add this value" }));
    expect(screen.getByText("Enter a name.")).toBeTruthy();
    expect(screen.queryByText(/letters, numbers/i)).toBeNull();
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
