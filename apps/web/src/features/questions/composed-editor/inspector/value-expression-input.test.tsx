// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { ValueExpressionInput } from "./value-expression-input";

vi.mock("./reference-picker-popover", () => ({
  ReferencePickerPopover: ({
    trigger,
    onSelectReference,
    onModelChange,
  }: {
    trigger: ReactNode;
    onSelectReference(referenceId: string): void;
    onModelChange(model: ComposedEditorModel): void;
  }) => (
    <div>
      {trigger}
      <button onClick={() => onSelectReference("reference_1")} type="button">
        Mock select reference
      </button>
      <button
        onClick={() =>
          onModelChange({
            blocks: [],
            references: [
              {
                id: "reference_1",
                source: { type: "literal", value: "x" },
              },
            ],
            responseFields: [],
            schemaVersion: 2,
          })
        }
        type="button"
      >
        Mock create reference
      </button>
    </div>
  ),
}));

describe("ValueExpressionInput", () => {
  afterEach(() => cleanup());

  it("shows static and added value modes without workbook options", async () => {
    const user = userEvent.setup();

    render(
      <ValueExpressionInput
        model={createModel()}
        onChange={() => {}}
        onModelChange={() => {}}
        referencePreviewCache={{}}
        sources={[]}
        value={{ type: "literal", value: 42 }}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Value mode" }));
    expect(screen.getByRole("option", { name: "Static value" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Added value" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Workbook cell" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Workbook range" })).toBeNull();
  });

  it("uses the reference picker to select and create references", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onModelChange = vi.fn();

    render(
      <ValueExpressionInput
        model={createModel()}
        onChange={onChange}
        onModelChange={onModelChange}
        referencePreviewCache={{}}
        sources={[]}
        value={{ referenceId: "", type: "reference" }}
        workbookEnabled={true}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    await user.click(
      screen.getByRole("button", { name: "Mock select reference" }),
    );
    expect(onChange).toHaveBeenCalledWith({
      referenceId: "reference_1",
      type: "reference",
    });

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    await user.click(
      screen.getByRole("button", { name: "Mock create reference" }),
    );

    expect(onModelChange).toHaveBeenCalledWith(
      expect.objectContaining({
        references: [
          expect.objectContaining({
            id: "reference_1",
            source: { type: "literal", value: "x" },
          }),
        ],
      }),
    );
    expect(onChange).toHaveBeenCalledWith({
      referenceId: "reference_1",
      type: "reference",
    });
  });

  it("warns when a reference is missing", () => {
    render(
      <ValueExpressionInput
        model={createModel()}
        onChange={() => {}}
        onModelChange={() => {}}
        referencePreviewCache={{}}
        sources={[]}
        value={{ referenceId: "missing", type: "reference" }}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    expect(
      screen.getByText("This value was deleted or no longer exists."),
    ).toBeTruthy();
    expect(screen.queryByText("{{ .missing }}")).toBeNull();
    expect(screen.getByText("Added value unavailable")).toBeTruthy();
  });
});

function createModel(): ComposedEditorModel {
  return {
    blocks: [],
    references: [],
    responseFields: [],
    schemaVersion: 2,
  };
}
