// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultTableEditorModel } from "#/domains/questions/authoring";
import { selectTableCell } from "#/features/questions/table-block-editor";
import { TableCellSelectionInspector } from "./table-cell-selection-inspector";

describe("TableCellSelectionInspector", () => {
  afterEach(() => cleanup());

  it("uses the shared selected-cell formatting action", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const model = createDefaultTableEditorModel();

    render(
      <TableCellSelectionInspector
        model={model}
        onModelChange={onModelChange}
        selection={selectTableCell({ columnId: "column_1", rowId: "row_1" })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Align right" }));

    expect(onModelChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cells: expect.arrayContaining([
          expect.objectContaining({
            formatting: expect.objectContaining({ textAlign: "right" }),
            id: "cell_1",
          }),
        ]),
      }),
    );
  });
});
