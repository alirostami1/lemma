import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toWorkbookValueSource } from "./workbook-value-source-adapter.js";

describe("workbook value source adapter", () => {
  it("maps workbook ranges to range sources", () => {
    assert.deepEqual(
      toWorkbookValueSource({
        ref: "Sheet1!A1:B2",
        schemaVersion: 1,
        sourceId: "source_1",
        type: "workbook_range",
      }),
      { ref: "Sheet1!A1:B2", sourceId: "source_1", type: "range" },
    );
  });
});
