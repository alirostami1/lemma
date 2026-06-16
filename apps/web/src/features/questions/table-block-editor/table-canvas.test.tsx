// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createDefaultTableEditorModel } from "#/domains/questions/authoring";
import { TableCanvas } from "./table-canvas";

describe("TableCanvas", () => {
  afterEach(() => cleanup());

  it("does not render a permanent table badge by itself", () => {
    const model = createDefaultTableEditorModel();

    render(
      <TableCanvas
        model={model}
        selection={{ type: "table" }}
        referencePreviewCache={{}}
        onModelChange={() => {}}
        onSelectionChange={() => {}}
      />,
    );

    expect(screen.queryByText("Table")).toBeNull();
    expect(screen.getByRole("button", { name: "Column 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Column 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Row 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Row 2" })).toBeTruthy();
  });
});
