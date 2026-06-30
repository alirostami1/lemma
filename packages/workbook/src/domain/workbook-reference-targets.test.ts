import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InvalidWorkbookFieldError } from "./errors.js";
import {
  workbookReferenceTargetAvailability,
  workbookReferenceTargetsFromJson,
  workbookReferenceTargetsFromSparseValues,
} from "./workbook-reference-targets.js";

describe("workbook reference targets", () => {
  it("builds normalized reference targets from sparse workbook values", () => {
    const targets = workbookReferenceTargetsFromSparseValues({
      sheets: [
        {
          cells: {
            A1: "alpha",
            $b$2: "beta",
            B2: "duplicate",
          },
          columnCount: 2,
          name: " Sheet 1 ",
          rowCount: 2,
        },
        {
          cells: {},
          columnCount: 0,
          name: "Empty",
          rowCount: 0,
        },
      ],
    });

    assert.deepEqual(targets, {
      schemaVersion: 1,
      sheets: [
        {
          dimensions: { columnCount: 2, rowCount: 2 },
          name: "Sheet 1",
          valueCells: ["A1", "B2"],
        },
        {
          dimensions: { columnCount: 1, rowCount: 1 },
          name: "Empty",
          valueCells: [],
        },
      ],
    });
  });

  it("rejects duplicate sheets, invalid cells, and non-positive dimensions", () => {
    assert.throws(
      () =>
        workbookReferenceTargetsFromJson({
          schemaVersion: 1,
          sheets: [
            {
              dimensions: { columnCount: 1, rowCount: 1 },
              name: "Sheet1",
            },
            {
              dimensions: { columnCount: 1, rowCount: 1 },
              name: " sheet1 ",
            },
          ],
        }),
      InvalidWorkbookFieldError,
    );
    assert.throws(
      () =>
        workbookReferenceTargetsFromJson({
          schemaVersion: 1,
          sheets: [
            {
              dimensions: { columnCount: 1, rowCount: 1 },
              name: "Sheet1",
              valueCells: ["not-a-cell"],
            },
          ],
        }),
      InvalidWorkbookFieldError,
    );
    assert.throws(
      () =>
        workbookReferenceTargetsFromJson({
          schemaVersion: 1,
          sheets: [
            {
              dimensions: { columnCount: 0, rowCount: 1 },
              name: "Sheet1",
            },
          ],
        }),
      InvalidWorkbookFieldError,
    );
  });

  it("does not allow null to mean valid target availability", () => {
    assert.throws(
      () => workbookReferenceTargetAvailability(null as never),
      InvalidWorkbookFieldError,
    );
  });
});
