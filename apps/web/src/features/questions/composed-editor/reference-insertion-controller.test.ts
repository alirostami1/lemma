import { describe, expect, it } from "vitest";
import { insertReferenceIntoInlineContent } from "./reference-insertion-controller";

describe("reference insertion controller", () => {
  it("inserts a structured reference by splitting focused text", () => {
    expect(
      insertReferenceIntoInlineContent({
        content: [{ text: "Revenue today", type: "text" }],
        referenceId: "revenue",
        target: { end: 7, index: 0, start: 7, type: "text" },
      }),
    ).toEqual([
      { text: "Revenue", type: "text" },
      { referenceId: "revenue", type: "reference" },
      { text: " today", type: "text" },
    ]);
  });

  it("preserves existing reference order when appending without a text target", () => {
    expect(
      insertReferenceIntoInlineContent({
        content: [
          { text: "A", type: "text" },
          { referenceId: "existing", type: "reference" },
          { text: "B", type: "text" },
        ],
        referenceId: "new_value",
      }),
    ).toEqual([
      { text: "A", type: "text" },
      { referenceId: "existing", type: "reference" },
      { text: "B ", type: "text" },
      { referenceId: "new_value", type: "reference" },
    ]);
  });

  it("inserts a structured reference into a virtual text slot", () => {
    expect(
      insertReferenceIntoInlineContent({
        content: [{ referenceId: "existing", type: "reference" }],
        referenceId: "new_value",
        target: { index: 1, type: "slot" },
      }),
    ).toEqual([
      { referenceId: "existing", type: "reference" },
      { referenceId: "new_value", type: "reference" },
    ]);
  });
});
