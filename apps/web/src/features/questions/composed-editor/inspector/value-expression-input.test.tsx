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
      <button
        type="button"
        onClick={() => onSelectReference("reference_1")}
      >
        Mock select reference
      </button>
      <button
        type="button"
        onClick={() =>
          onModelChange({
            schemaVersion: 1,
            blocks: [],
            responseFields: [],
            references: [
              {
                id: "reference_1",
                source: { type: "literal", value: "x" },
              },
            ],
          })
        }
      >
        Mock create reference
      </button>
    </div>
  ),
}));

describe("ValueExpressionInput", () => {
  afterEach(() => cleanup());

  it("shows literal and reference modes without workbook source options", async () => {
    const user = userEvent.setup();

    render(
      <ValueExpressionInput
        value={{ type: "literal", value: 42 }}
        model={createModel()}
        referencePreviewCache={{}}
        workbookEnabled={false}
        onModelChange={() => {}}
        onChange={() => {}}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Value mode" }));
    expect(screen.getByRole("option", { name: "Literal value" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Reference" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Workbook cell" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Workbook range" })).toBeNull();
  });

  it("uses the reference picker to select and create references", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onModelChange = vi.fn();

    render(
      <ValueExpressionInput
        value={{ type: "reference", referenceId: "" }}
        model={createModel()}
        referencePreviewCache={{}}
        workbookEnabled={true}
        onModelChange={onModelChange}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Choose reference" }));
    await user.click(screen.getByRole("button", { name: "Mock select reference" }));
    expect(onChange).toHaveBeenCalledWith({
      type: "reference",
      referenceId: "reference_1",
    });

    await user.click(screen.getByRole("button", { name: "Choose reference" }));
    await user.click(screen.getByRole("button", { name: "Mock create reference" }));

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
      type: "reference",
      referenceId: "reference_1",
    });
  });

  it("warns when a reference is missing", () => {
    render(
      <ValueExpressionInput
        value={{ type: "reference", referenceId: "missing" }}
        model={createModel()}
        referencePreviewCache={{}}
        workbookEnabled={false}
        onModelChange={() => {}}
        onChange={() => {}}
      />,
    );

    expect(
      screen.getByText("This reference was deleted or no longer exists."),
    ).toBeTruthy();
  });
});

function createModel(): ComposedEditorModel {
  return {
    schemaVersion: 1,
    blocks: [],
    responseFields: [],
    references: [],
  };
}
