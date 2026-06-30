import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertReferenceIdMatchesStructuredSource,
  formatWorkbookReferenceKey,
  getWorkbookReferenceKeyForStructuredSource,
  isCanonicalWorkbookReferenceKey,
  parseWorkbookReferenceKey,
  questionBlueprintDocument,
} from "./index.js";

describe("workbook reference keys", () => {
  it("formats workbook cell key", () => {
    assert.equal(
      formatWorkbookReferenceKey({
        cell: "a1",
        kind: "cell",
        sheetName: "Sheet1",
        sourceId: "source_1",
      }),
      "workbook:source_1:cell:Sheet1:A1",
    );
  });

  it("formats workbook range key", () => {
    assert.equal(
      formatWorkbookReferenceKey({
        endCell: "b3",
        kind: "range",
        sheetName: "Sheet1",
        sourceId: "source_1",
        startCell: "a1",
      }),
      "workbook:source_1:range:Sheet1:A1:B3",
    );
  });

  it("parses workbook cell key", () => {
    assert.deepEqual(
      parseWorkbookReferenceKey("workbook:source_1:cell:Sheet1:A1"),
      {
        parts: {
          cell: "A1",
          kind: "cell",
          sheetName: "Sheet1",
          sourceId: "source_1",
        },
        status: "parsed",
      },
    );
  });

  it("parses workbook range key", () => {
    assert.deepEqual(
      parseWorkbookReferenceKey("workbook:source_1:range:Sheet1:A1:B3"),
      {
        parts: {
          endCell: "B3",
          kind: "range",
          sheetName: "Sheet1",
          sourceId: "source_1",
          startCell: "A1",
        },
        status: "parsed",
      },
    );
  });

  it("encodes and decodes sheet names with spaces", () => {
    const key = formatWorkbookReferenceKey({
      cell: "C12",
      kind: "cell",
      sheetName: "My Sheet",
      sourceId: "rates",
    });

    assert.equal(key, "workbook:rates:cell:My%20Sheet:C12");
    assert.deepEqual(parseWorkbookReferenceKey(key), {
      parts: {
        cell: "C12",
        kind: "cell",
        sheetName: "My Sheet",
        sourceId: "rates",
      },
      status: "parsed",
    });
  });

  it("fails invalid namespace", () => {
    assert.deepEqual(
      parseWorkbookReferenceKey("excel:source_1:cell:Sheet1:A1"),
      {
        reason: "Workbook reference key must start with workbook:.",
        status: "invalid",
      },
    );
  });

  it("fails invalid kind", () => {
    assert.deepEqual(
      parseWorkbookReferenceKey("workbook:source_1:value:Sheet1:A1"),
      {
        reason: "Workbook reference key kind must be cell or range.",
        status: "invalid",
      },
    );
  });

  it("fails invalid source id", () => {
    assert.deepEqual(
      parseWorkbookReferenceKey("workbook:1bad:cell:Sheet1:A1"),
      {
        reason:
          "sourceId must start with a letter and contain only letters, numbers, underscores, or hyphens",
        status: "invalid",
      },
    );
  });

  it("fails malformed percent encoding", () => {
    assert.deepEqual(
      parseWorkbookReferenceKey("workbook:source_1:cell:%E0%A4%A:A1"),
      {
        reason: "Workbook reference key sheet name encoding is invalid.",
        status: "invalid",
      },
    );
  });

  it("fails invalid A1 cell", () => {
    assert.deepEqual(
      parseWorkbookReferenceKey("workbook:source_1:cell:Sheet1:1A"),
      {
        reason: "Workbook reference key has invalid start cell.",
        status: "invalid",
      },
    );
  });

  it("matches workbook_cell reference id to structured source", () => {
    assert.doesNotThrow(() =>
      assertReferenceIdMatchesStructuredSource({
        referenceId: "workbook:source_1:cell:Sheet1:A1",
        source: {
          ref: "Sheet1!A1",
          sourceId: "source_1",
          type: "workbook_cell",
        },
      }),
    );
  });

  it("matches workbook_range reference id to structured source", () => {
    assert.doesNotThrow(() =>
      assertReferenceIdMatchesStructuredSource({
        referenceId: "workbook:source_1:range:Sheet1:A1:B3",
        source: {
          ref: "Sheet1!A1:B3",
          sourceId: "source_1",
          type: "workbook_range",
        },
      }),
    );
  });

  it("fails mismatched reference id and source", () => {
    assert.throws(
      () =>
        assertReferenceIdMatchesStructuredSource({
          referenceId: "workbook:source_2:cell:Sheet1:A1",
          source: {
            ref: "Sheet1!A1",
            sourceId: "source_1",
            type: "workbook_cell",
          },
        }),
      /workbook reference id must match structured source/,
    );
  });

  it("builds canonical key from structured source", () => {
    assert.equal(
      getWorkbookReferenceKeyForStructuredSource({
        source: {
          ref: "'My Sheet'!a1:b3",
          sourceId: "source_1",
          type: "workbook_range",
        },
      }),
      "workbook:source_1:range:My%20Sheet:A1:B3",
    );
  });

  it("detects canonical key exactly", () => {
    assert.equal(
      isCanonicalWorkbookReferenceKey("workbook:source_1:cell:Sheet1:A1"),
      true,
    );
    assert.equal(
      isCanonicalWorkbookReferenceKey("workbook:source_1:cell:Sheet1:a1"),
      false,
    );
  });

  it("question blueprint document rejects mismatched workbook ids", () => {
    assert.throws(
      () =>
        questionBlueprintDocument({
          blocks: [],
          references: [
            {
              id: "workbook:source_2:cell:Sheet1:A1",
              source: {
                ref: "Sheet1!A1",
                schemaVersion: 1,
                sourceId: "source_1",
                type: "workbook_cell",
              },
            },
          ],
          responseFields: [],
          schemaVersion: 2,
        }),
      /workbook reference id must match structured source/,
    );
  });
});
