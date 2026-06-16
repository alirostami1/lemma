import { describe, expect, it } from "vitest";
import { selectedBlockIdFromSelection } from "./editor-selection";

describe("selectedBlockIdFromSelection", () => {
  it("keeps table-derived selections on the parent table block", () => {
    expect(
      selectedBlockIdFromSelection({ type: "table", blockId: "table_1" }),
    ).toBe("table_1");
    expect(
      selectedBlockIdFromSelection({
        type: "table_row",
        blockId: "table_1",
        rowId: "row_1",
      }),
    ).toBe("table_1");
    expect(
      selectedBlockIdFromSelection({
        type: "table_column",
        blockId: "table_1",
        columnId: "column_1",
      }),
    ).toBe("table_1");
    expect(
      selectedBlockIdFromSelection({
        type: "table_cell",
        blockId: "table_1",
        cellId: "cell_1",
      }),
    ).toBe("table_1");
  });
});
