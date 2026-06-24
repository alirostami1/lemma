import { describe, expect, it } from "vitest";
import { insertReferenceSyntaxAtSelection } from "./reference-insertion-controller";

describe("reference insertion controller", () => {
  it("inserts a reference at the caret with surrounding spaces", () => {
    expect(
      insertReferenceSyntaxAtSelection({
        referenceId: "revenue",
        selection: { end: 8, start: 8 },
        text: "Revenue:",
      }),
    ).toEqual({
      selection: { end: 23, start: 23 },
      text: "Revenue: {{ .revenue }}",
    });
  });

  it("replaces selected text", () => {
    expect(
      insertReferenceSyntaxAtSelection({
        referenceId: "revenue",
        selection: { end: 14, start: 8 },
        text: "Revenue amount today",
      }).text,
    ).toBe("Revenue {{ .revenue }} today");
  });
});
