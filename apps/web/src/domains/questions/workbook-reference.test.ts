import { describe, expect, it } from "vitest";
import {
  normalizeWorkbookRef,
  parseWorkbookRef,
  resolveWorkbookValue,
} from "./workbook-reference";

describe("workbook references", () => {
  it("parses quoted, escaped, lowercase, and absolute refs", () => {
    expect(parseWorkbookRef("Sheet1!a1")).toMatchObject({
      endColumnIndex: 0,
      endRowIndex: 0,
      hasRange: false,
      range: "a1",
      sheetName: "Sheet1",
      startColumnIndex: 0,
      startRowIndex: 0,
    });
    expect(parseWorkbookRef("Sheet1!$A$1")).toMatchObject({
      range: "$A$1",
      sheetName: "Sheet1",
    });
    expect(parseWorkbookRef("'Sheet 1'!$A$1:$B$2")).toMatchObject({
      endColumnIndex: 1,
      endRowIndex: 1,
      hasRange: true,
      range: "$A$1:$B$2",
      sheetName: "Sheet 1",
      startColumnIndex: 0,
      startRowIndex: 0,
    });
    expect(parseWorkbookRef("'Bob''s Sheet'!A1")).toMatchObject({
      range: "A1",
      sheetName: "Bob's Sheet",
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
    expect(normalizeWorkbookRef("Sheet1!a1")).toBe("'Sheet1'!A1");
    expect(normalizeWorkbookRef("'Sheet1'!$A$1")).toBe("'Sheet1'!A1");
    expect(normalizeWorkbookRef("'Bob''s Sheet'!$a$1:$b$2")).toBe(
      "'Bob''s Sheet'!A1:B2",
    );
  });
});
