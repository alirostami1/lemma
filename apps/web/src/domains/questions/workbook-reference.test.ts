import { describe, expect, it } from "vitest";
import {
  normalizeWorkbookRef,
  parseWorkbookRef,
  resolveWorkbookValue,
} from "./workbook-reference";

describe("workbook references", () => {
  it("parses quoted, escaped, lowercase, and absolute refs", () => {
    expect(parseWorkbookRef("Sheet1!a1")).toMatchObject({
      sheetName: "Sheet1",
      range: "a1",
      startColumnIndex: 0,
      startRowIndex: 0,
      endColumnIndex: 0,
      endRowIndex: 0,
      hasRange: false,
    });
    expect(parseWorkbookRef("Sheet1!$A$1")).toMatchObject({
      sheetName: "Sheet1",
      range: "$A$1",
    });
    expect(parseWorkbookRef("'Sheet 1'!$A$1:$B$2")).toMatchObject({
      sheetName: "Sheet 1",
      range: "$A$1:$B$2",
      startColumnIndex: 0,
      startRowIndex: 0,
      endColumnIndex: 1,
      endRowIndex: 1,
      hasRange: true,
    });
    expect(parseWorkbookRef("'Bob''s Sheet'!A1")).toMatchObject({
      sheetName: "Bob's Sheet",
      range: "A1",
    });
  });

  it("resolves mixed-case and absolute ranges", () => {
    const preview = {
      sheets: [
        {
          name: "Sheet 1",
          rows: [
            ["A1", "B1"],
            ["A2", "B2"],
          ],
        },
      ],
    };

    expect(resolveWorkbookValue(preview, "'Sheet 1'!$a$1")).toBe("A1");
    expect(resolveWorkbookValue(preview, "'Sheet 1'!$A$1:$b$2")).toEqual([
      ["A1", "B1"],
      ["A2", "B2"],
    ]);
  });

  it("normalizes equivalent refs to one canonical range ref", () => {
    expect(normalizeWorkbookRef("Sheet1!a1")).toBe("'Sheet1'!A1:A1");
    expect(normalizeWorkbookRef("'Sheet1'!$A$1")).toBe("'Sheet1'!A1:A1");
    expect(normalizeWorkbookRef("'Bob''s Sheet'!$a$1:$b$2")).toBe(
      "'Bob''s Sheet'!A1:B2",
    );
  });
});
