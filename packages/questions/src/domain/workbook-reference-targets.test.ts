import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InvalidQuestionFieldError } from "./errors.js";
import { questionWorkbookReferenceTargetsFromJson } from "./workbook-reference-targets.js";

describe("question workbook reference targets", () => {
  it("rejects duplicate sheet names case-insensitively after trimming", () => {
    assert.throws(
      () =>
        questionWorkbookReferenceTargetsFromJson({
          schemaVersion: 1,
          sheets: [
            sheetFixture({ name: " Sheet1 " }),
            sheetFixture({ name: "sheet1" }),
          ],
        }),
      InvalidQuestionFieldError,
    );
  });

  it("rejects empty sheet names", () => {
    assert.throws(
      () =>
        questionWorkbookReferenceTargetsFromJson({
          schemaVersion: 1,
          sheets: [sheetFixture({ name: "  " })],
        }),
      InvalidQuestionFieldError,
    );
  });

  it("rejects non-positive and non-integer dimensions", () => {
    for (const dimensions of [
      { columnCount: 1, rowCount: 0 },
      { columnCount: -1, rowCount: 1 },
      { columnCount: 1.5, rowCount: 1 },
    ]) {
      assert.throws(
        () =>
          questionWorkbookReferenceTargetsFromJson({
            schemaVersion: 1,
            sheets: [sheetFixture({ dimensions })],
          }),
        InvalidQuestionFieldError,
      );
    }
  });

  it("rejects invalid value cell addresses", () => {
    assert.throws(
      () =>
        questionWorkbookReferenceTargetsFromJson({
          schemaVersion: 1,
          sheets: [sheetFixture({ valueCells: ["A1", "not-a-cell"] })],
        }),
      InvalidQuestionFieldError,
    );
  });

  it("normalizes absolute and mixed-case value cells to sorted uppercase A1 cells", () => {
    const targets = questionWorkbookReferenceTargetsFromJson({
      schemaVersion: 1,
      sheets: [
        sheetFixture({
          valueCells: ["$b$2", "a10", "$A$1", "A1", "b$1"],
        }),
      ],
    });

    assert.deepEqual(targets.sheets[0]?.valueCells, ["A1", "B1", "B2", "A10"]);
  });

  it("deep-copies returned sheet and cell arrays", () => {
    const valueCells = ["A1"];
    const input = {
      schemaVersion: 1,
      sheets: [sheetFixture({ valueCells })],
    };

    const targets = questionWorkbookReferenceTargetsFromJson(input);
    input.sheets.push(sheetFixture({ name: "Sheet2" }));
    valueCells.push("B2");

    assert.equal(targets.sheets.length, 1);
    assert.deepEqual(targets.sheets[0]?.valueCells, ["A1"]);
  });
});

function sheetFixture(
  input: {
    name?: string;
    dimensions?: { rowCount: number; columnCount: number };
    valueCells?: string[];
  } = {},
) {
  return {
    dimensions: input.dimensions ?? { columnCount: 2, rowCount: 10 },
    name: input.name ?? "Sheet1",
    ...(input.valueCells === undefined ? {} : { valueCells: input.valueCells }),
  };
}
