// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TableCellView } from "./table-cell-view";

describe("TableCellView", () => {
  afterEach(() => cleanup());

  it("renders product labels for input types", () => {
    render(
      <TableCellView
        cell={{
          blocks: [
            {
              grading: { mode: "manual" },
              id: "input_1",
              input: {
                optionsSource: { type: "literal", value: [] },
                type: "select",
              },
              points: 1,
              responseFieldId: "answer_1",
              type: "input",
            },
          ],
          columnId: "column_1",
          id: "cell_1",
          rowId: "row_1",
        }}
        isSelected={false}
        onSelect={vi.fn()}
        responseField={{ id: "answer_1", label: "Answer", type: "select" }}
      />,
    );

    expect(screen.getByText("Choice")).toBeTruthy();
    expect(screen.queryByText("select")).toBeNull();
  });
});
