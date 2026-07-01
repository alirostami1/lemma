import { describe, expect, it } from "vitest";
import { selectedBlockIdFromSelection } from "./editor-selection";

describe("selectedBlockIdFromSelection", () => {
  it("keeps table-derived selections on the parent table block", () => {
    expect(
      selectedBlockIdFromSelection({ blockId: "table_1", type: "table" }),
    ).toBe("table_1");
    expect(
      selectedBlockIdFromSelection({
        blockId: "table_1",
        rowId: "row_1",
        type: "table_row",
      }),
    ).toBe("table_1");
    expect(
      selectedBlockIdFromSelection({
        blockId: "table_1",
        columnId: "column_1",
        type: "table_column",
      }),
    ).toBe("table_1");
    expect(
      selectedBlockIdFromSelection({
        blockId: "table_1",
        cellId: "cell_1",
        type: "table_cell",
      }),
    ).toBe("table_1");
    expect(
      selectedBlockIdFromSelection({
        blockId: "table_1",
        selection: {
          activeCell: { columnId: "column_1", rowId: "row_1" },
          ranges: [
            {
              end: { columnId: "column_1", rowId: "row_1" },
              start: { columnId: "column_1", rowId: "row_1" },
            },
          ],
          type: "cells",
        },
        type: "table_cells",
      }),
    ).toBe("table_1");
  });
});
