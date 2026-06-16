import { describe, expect, it } from "vitest";
import { insertReferenceSyntaxAtSelection } from "./reference-insertion-controller";

describe("reference insertion controller", () => {
  it("inserts a reference at the caret with surrounding spaces", () => {
    expect(
      insertReferenceSyntaxAtSelection({
        text: "Revenue:",
        selection: { start: 8, end: 8 },
        referenceId: "revenue",
      }),
    ).toEqual({
      text: "Revenue: {{ .revenue }}",
      selection: { start: 23, end: 23 },
    });
  });

  it("replaces selected text", () => {
    expect(
      insertReferenceSyntaxAtSelection({
        text: "Revenue amount today",
        selection: { start: 8, end: 14 },
        referenceId: "revenue",
      }).text,
    ).toBe("Revenue {{ .revenue }} today");
  });
});
