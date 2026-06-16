// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkbookPickerDialog } from "./workbook-picker-dialog";

describe("workbook picker dialog", () => {
  it("shows loading when a workbook filename is known but the file is not ready", () => {
    render(
      <WorkbookPickerDialog
        file={null}
        fileName="source.xlsx"
        open
        onOpenChange={() => {}}
        selectionRequirement={{}}
        onSelectRange={() => {}}
      />,
    );

    expect(screen.getByText("Loading source...")).toBeTruthy();
  });
});
