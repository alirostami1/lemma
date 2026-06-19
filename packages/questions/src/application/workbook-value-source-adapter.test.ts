import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toWorkbookValueSource } from "./workbook-value-source-adapter.js";

describe("workbook value source adapter", () => {
  it("maps workbook ranges to range sources", () => {
    assert.deepEqual(
      toWorkbookValueSource({
        schemaVersion: 1,
        type: "workbook_range",
        sourceId: "source_1",
        ref: "Sheet1!A1:B2",
      }),
      { type: "range", sourceId: "source_1", ref: "Sheet1!A1:B2" },
    );
  });
});
