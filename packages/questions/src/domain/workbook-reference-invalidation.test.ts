import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatInlineBlueprintReferenceToken } from "./blueprint-document/index.js";
import type { QuestionBlueprintDocument } from "./question-blueprint-document.js";
import { questionBlueprintDocument } from "./question-blueprint-document.js";
import type { QuestionReferenceSource } from "./question-reference.js";
import { getWorkbookReferenceKeyForStructuredSource } from "./reference-key.js";
import {
  checkWorkbookReferenceInvalidation,
  type WorkbookReferenceInvalidationResult,
} from "./workbook-reference-invalidation.js";
import type { QuestionWorkbookReferenceTargetAvailability } from "./workbook-reference-targets.js";

describe("workbook reference invalidation", () => {
  it("reports a referenced sheet removal with user-facing copy", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithTextInlineReference({
        ref: "Sheet1!A1",
        type: "workbook_cell",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([
        { columnCount: 10, name: "Other", rowCount: 10 },
      ]),
    });

    assertAffected(result, [
      {
        label: "Inserted value from Sheet1 A1",
        problem: "The workbook sheet is no longer available.",
      },
    ]);
  });

  it("reports a direct cell outside sheet dimensions", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithTextInlineReference({
        ref: "Sheet1!B2",
        type: "workbook_cell",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([
        { columnCount: 1, name: "Sheet1", rowCount: 1 },
      ]),
    });

    assertAffected(result, [
      {
        label: "Inserted value from Sheet1 B2",
        problem: "The referenced cell is no longer available.",
      },
    ]);
  });

  it("reports a direct cell missing from value metadata", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithTextInlineReference({
        ref: "Sheet1!B2",
        type: "workbook_cell",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([
        {
          columnCount: 2,
          name: "Sheet1",
          rowCount: 2,
          valueCells: ["A1"],
        },
      ]),
    });

    assertAffected(result, [
      {
        label: "Inserted value from Sheet1 B2",
        problem: "The referenced cell is no longer available.",
      },
    ]);
  });

  it("reports a referenced range row shrink", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithTextInlineReference({
        ref: "Sheet1!A1:C3",
        type: "workbook_range",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([
        { columnCount: 3, name: "Sheet1", rowCount: 2 },
      ]),
    });

    assertRangeInvalid(result);
  });

  it("reports a referenced range column shrink", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithTextInlineReference({
        ref: "Sheet1!A1:C3",
        type: "workbook_range",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([
        { columnCount: 2, name: "Sheet1", rowCount: 3 },
      ]),
    });

    assertRangeInvalid(result);
  });

  it("preserves a referenced range with blank cells inside dimensions", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithTextInlineReference({
        ref: "Sheet1!A1:C3",
        type: "workbook_range",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([
        {
          columnCount: 3,
          name: "Sheet1",
          rowCount: 3,
          valueCells: ["A1", "C3"],
        },
      ]),
    });

    assert.deepEqual(result, { status: "valid" });
  });

  it("handles quoted sheet names and absolute refs", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithTextInlineReference({
        ref: "'Sheet 1'!$A$1:$B$2",
        type: "workbook_range",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([
        {
          columnCount: 2,
          name: "Sheet 1",
          rowCount: 2,
          valueCells: ["A1", "A2", "B1", "B2"],
        },
      ]),
    });

    assert.deepEqual(result, { status: "valid" });
  });

  it("normalizes reversed range endpoints", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithTextInlineReference({
        ref: "Sheet1!B2:A1",
        type: "workbook_range",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([
        {
          columnCount: 2,
          name: "Sheet1",
          rowCount: 2,
          valueCells: ["A1", "A2", "B1", "B2"],
        },
      ]),
    });

    assert.deepEqual(result, { status: "valid" });
  });

  it("fails closed for malformed used workbook_cell refs", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: unsafeDocumentWithMalformedReference({
        ref: "Sheet1!not-a-cell",
        type: "workbook_cell",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([
        { columnCount: 10, name: "Sheet1", rowCount: 10 },
      ]),
    });

    assertAffected(result, [
      {
        label: "Inserted workbook value",
        problem: "This inserted value could not be checked.",
      },
    ]);
  });

  it("fails closed for malformed used workbook_range refs", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: unsafeDocumentWithMalformedReference({
        ref: "Sheet1!A1",
        type: "workbook_range",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([
        { columnCount: 10, name: "Sheet1", rowCount: 10 },
      ]),
    });

    assertAffected(result, [
      {
        label: "Inserted workbook value",
        problem: "This inserted value could not be checked.",
      },
    ]);
  });

  it("ignores unused stale workbook reference definitions", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: questionBlueprintDocument({
        blocks: [
          {
            content: [{ text: "No inserted values here.", type: "text" }],
            id: "block_1",
            kind: "primitive",
            type: "text",
          },
        ],
        references: [reference({ ref: "Sheet1!A1", type: "workbook_cell" })],
        responseFields: [],
        schemaVersion: 2,
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([]),
    });

    assert.deepEqual(result, { status: "valid" });
  });

  it("checks table content inline references", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithTableContentReference({
        ref: "Sheet1!A1",
        type: "workbook_cell",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([]),
    });

    assertSheetInvalid(result);
  });

  it("checks response correctValueSource references", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithResponseCorrectValueReference({
        ref: "Sheet1!A1",
        type: "workbook_cell",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([]),
    });

    assertSheetInvalid(result);
  });

  it("checks table response correctValueSource references", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithTableResponseCorrectValueReference({
        ref: "Sheet1!A1",
        type: "workbook_cell",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([]),
    });

    assertSheetInvalid(result);
  });

  it("checks rich-text paragraph workbook cell references", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithRichTextReference({
        node: "paragraph",
        ref: "Sheet1!A1",
        type: "workbook_cell",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([]),
    });

    assertSheetInvalid(result);
  });

  it("checks rich-text heading workbook range references", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithRichTextReference({
        node: "heading",
        ref: "Sheet1!A1:C3",
        type: "workbook_range",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([
        { columnCount: 3, name: "Sheet1", rowCount: 2 },
      ]),
    });

    assertRangeInvalid(result);
  });

  it("checks rich-text nested list workbook references", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithRichTextReference({
        node: "nested_list",
        ref: "Sheet1!A1",
        type: "workbook_cell",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([]),
    });

    assertSheetInvalid(result);
  });

  it("passes for rangeCell offset inside the original range and new targets", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithTextInlineReference({
        rangeCell: { columnOffset: 1, rowOffset: 1 },
        ref: "Sheet1!A1:B2",
        type: "workbook_range",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([
        {
          columnCount: 2,
          name: "Sheet1",
          rowCount: 2,
          valueCells: ["A1", "B2"],
        },
      ]),
    });

    assert.deepEqual(result, { status: "valid" });
  });

  it("reports rangeCell offset outside the original range", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithTextInlineReference({
        rangeCell: { columnOffset: 2, rowOffset: 0 },
        ref: "Sheet1!A1:B2",
        type: "workbook_range",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([
        { columnCount: 3, name: "Sheet1", rowCount: 2 },
      ]),
    });

    assertAffected(result, [
      {
        label: "Inserted value from Sheet1 A1:B2",
        problem: "This inserted range cell is outside the referenced range.",
      },
    ]);
  });

  it("reports rangeCell target outside new workbook dimensions", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithTextInlineReference({
        rangeCell: { columnOffset: 1, rowOffset: 1 },
        ref: "Sheet1!A1:B2",
        type: "workbook_range",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([
        { columnCount: 1, name: "Sheet1", rowCount: 1 },
      ]),
    });

    assertRangeCellInvalid(result);
  });

  it("checks rich-text rangeCell reference tokens", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithRichTextReference({
        node: "paragraph",
        rangeCell: { columnOffset: 1, rowOffset: 1 },
        ref: "Sheet1!A1:B2",
        type: "workbook_range",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([
        { columnCount: 1, name: "Sheet1", rowCount: 1 },
      ]),
    });

    assertRangeCellInvalid(result);
  });

  it("reports rangeCell target missing from value metadata", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithTextInlineReference({
        rangeCell: { columnOffset: 1, rowOffset: 1 },
        ref: "Sheet1!A1:B2",
        type: "workbook_range",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([
        {
          columnCount: 2,
          name: "Sheet1",
          rowCount: 2,
          valueCells: ["A1"],
        },
      ]),
    });

    assertRangeCellInvalid(result);
  });

  it("fails closed when target metadata is unavailable", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithTextInlineReference({
        ref: "Sheet1!A1",
        type: "workbook_cell",
      }),
      sourceId: "sourceA",
      targetAvailability: {
        reason: "inspection_unavailable",
        status: "unavailable",
      },
    });

    assertAffected(result, [
      {
        label: "Inserted value from Sheet1 A1",
        problem:
          "The new workbook could not be checked for this inserted value.",
      },
    ]);
  });

  it("does not expose source ids, reference ids, or workbook keys in copy", () => {
    const result = checkWorkbookReferenceInvalidation({
      document: documentWithTextInlineReference({
        ref: "Sheet1!A1",
        type: "workbook_cell",
      }),
      sourceId: "sourceA",
      targetAvailability: availableTargets([]),
    });

    assert.equal(result.status, "invalid");
    const copy = JSON.stringify(
      result.status === "invalid" ? result.affectedInsertedValues : [],
    );
    assert.equal(copy.includes("sourceA"), false);
    assert.equal(copy.includes("workbook:"), false);
    assert.equal(copy.includes("019e"), false);
  });
});

function assertSheetInvalid(result: WorkbookReferenceInvalidationResult): void {
  assertAffected(result, [
    {
      label: "Inserted value from Sheet1 A1",
      problem: "The workbook sheet is no longer available.",
    },
  ]);
}

function assertRangeInvalid(result: WorkbookReferenceInvalidationResult): void {
  assertAffected(result, [
    {
      label: "Inserted value from Sheet1 A1:C3",
      problem: "The referenced range is no longer available.",
    },
  ]);
}

function assertRangeCellInvalid(
  result: WorkbookReferenceInvalidationResult,
): void {
  assertAffected(result, [
    {
      label: "Inserted value from Sheet1 A1:B2",
      problem:
        "This inserted range cell is no longer available in the workbook.",
    },
  ]);
}

function assertAffected(
  result: WorkbookReferenceInvalidationResult,
  expected: readonly { label: string; problem: string }[],
): void {
  assert.equal(result.status, "invalid");
  assert.deepEqual(
    result.status === "invalid" ? result.affectedInsertedValues : [],
    expected,
  );
}

function availableTargets(
  sheets: readonly {
    columnCount: number;
    name: string;
    rowCount: number;
    valueCells?: readonly string[];
  }[],
): QuestionWorkbookReferenceTargetAvailability {
  return {
    status: "available",
    targets: {
      schemaVersion: 1,
      sheets: sheets.map((sheet) => ({
        dimensions: {
          columnCount: sheet.columnCount,
          rowCount: sheet.rowCount,
        },
        name: sheet.name,
        ...(sheet.valueCells === undefined
          ? {}
          : { valueCells: sheet.valueCells }),
      })),
    },
  };
}

function documentWithTextInlineReference(input: {
  ref: string;
  type: "workbook_cell" | "workbook_range";
  rangeCell?: { rowOffset: number; columnOffset: number };
}) {
  const ref = reference(input);
  return documentWithReference(ref.source, [
    {
      content: [
        {
          referenceId: ref.id,
          type: "reference",
          ...(input.rangeCell === undefined
            ? {}
            : { rangeCell: input.rangeCell }),
        },
      ],
      id: "block_1",
      kind: "primitive",
      type: "text",
    },
  ]);
}

function documentWithTableContentReference(input: {
  ref: string;
  type: "workbook_cell" | "workbook_range";
}) {
  const ref = reference(input);
  return documentWithReference(ref.source, [
    {
      cells: [
        {
          blocks: [
            {
              content: [{ referenceId: ref.id, type: "reference" }],
              id: "cell_1_text",
              kind: "primitive",
              type: "text",
            },
          ],
          columnId: "column_1",
          id: "cell_1",
          rowId: "row_1",
        },
      ],
      columns: [{ id: "column_1", label: "Column" }],
      id: "block_1",
      kind: "complex",
      rows: [{ id: "row_1", label: "Row" }],
      showColumnNames: true,
      showRowNames: true,
      type: "table",
    },
  ]);
}

function documentWithResponseCorrectValueReference(input: {
  ref: string;
  type: "workbook_cell" | "workbook_range";
}) {
  const ref = reference(input);
  return documentWithReference(
    ref.source,
    [
      {
        correctValueSource: {
          referenceId: ref.id,
          schemaVersion: 1,
          type: "reference",
        },
        grading: { mode: "exact" },
        id: "block_1",
        kind: "primitive",
        points: 1,
        responseFieldId: "answer",
        type: "input",
      },
    ],
    [{ id: "answer", type: "text" }],
  );
}

function documentWithTableResponseCorrectValueReference(input: {
  ref: string;
  type: "workbook_cell" | "workbook_range";
}) {
  const ref = reference(input);
  return documentWithReference(
    ref.source,
    [
      {
        cells: [
          {
            blocks: [
              {
                correctValueSource: {
                  referenceId: ref.id,
                  schemaVersion: 1,
                  type: "reference",
                },
                grading: { mode: "exact" },
                id: "cell_1_input",
                kind: "primitive",
                points: 1,
                responseFieldId: "answer",
                type: "input",
              },
            ],
            columnId: "column_1",
            id: "cell_1",
            rowId: "row_1",
          },
        ],
        columns: [{ id: "column_1", label: "Column" }],
        id: "block_1",
        kind: "complex",
        rows: [{ id: "row_1", label: "Row" }],
        showColumnNames: true,
        showRowNames: true,
        type: "table",
      },
    ],
    [{ id: "answer", type: "text" }],
  );
}

function documentWithRichTextReference(input: {
  ref: string;
  type: "workbook_cell" | "workbook_range";
  node: "paragraph" | "heading" | "nested_list";
  rangeCell?: { rowOffset: number; columnOffset: number };
}) {
  const ref = reference(input);
  const token = formatRichTextReferenceToken(ref.id, input.rangeCell);
  if (input.node === "heading") {
    return documentWithReference(ref.source, [
      {
        content: {
          content: [
            {
              attrs: { level: 2 },
              content: [{ text: `Use ${token}`, type: "text" }],
              type: "heading",
            },
          ],
          type: "doc",
        },
        id: "block_1",
        kind: "primitive",
        type: "rich_text",
      },
    ]);
  }
  if (input.node === "nested_list") {
    return documentWithReference(ref.source, [
      {
        content: {
          content: [
            {
              content: [
                {
                  content: [
                    {
                      content: [{ text: "Parent", type: "text" }],
                      type: "paragraph",
                    },
                    {
                      content: [
                        {
                          content: [
                            {
                              content: [{ text: token, type: "text" }],
                              type: "paragraph",
                            },
                          ],
                          type: "list_item",
                        },
                      ],
                      type: "ordered_list",
                    },
                  ],
                  type: "list_item",
                },
              ],
              type: "bullet_list",
            },
          ],
          type: "doc",
        },
        id: "block_1",
        kind: "primitive",
        type: "rich_text",
      },
    ]);
  }
  return documentWithReference(ref.source, [
    {
      content: {
        content: [
          {
            content: [{ text: `Revenue ${token}`, type: "text" }],
            type: "paragraph",
          },
        ],
        type: "doc",
      },
      id: "block_1",
      kind: "primitive",
      type: "rich_text",
    },
  ]);
}

function formatRichTextReferenceToken(
  referenceId: string,
  rangeCell?: { rowOffset: number; columnOffset: number },
): string {
  return formatInlineBlueprintReferenceToken(referenceId, rangeCell);
}

function documentWithReference(
  source: Extract<
    QuestionReferenceSource,
    { type: "workbook_cell" | "workbook_range" }
  >,
  blocks: QuestionBlueprintDocument["blocks"],
  responseFields: QuestionBlueprintDocument["responseFields"] = [],
): QuestionBlueprintDocument {
  return questionBlueprintDocument({
    blocks,
    references: [
      {
        id: getWorkbookReferenceKeyForStructuredSource({ source }),
        source,
      },
    ],
    responseFields,
    schemaVersion: 2,
  });
}

function reference(input: {
  ref: string;
  type: "workbook_cell" | "workbook_range";
}): {
  id: string;
  source: Extract<
    QuestionReferenceSource,
    { type: "workbook_cell" | "workbook_range" }
  >;
} {
  const source = {
    ref: input.ref,
    schemaVersion: 1,
    sourceId: "sourceA",
    type: input.type,
  } as const;
  return {
    id: getWorkbookReferenceKeyForStructuredSource({ source }),
    source,
  };
}

function unsafeDocumentWithMalformedReference(input: {
  ref: string;
  type: "workbook_cell" | "workbook_range";
}): QuestionBlueprintDocument {
  // This intentionally bypasses document construction to prove fail-closed
  // behavior if a previously persisted document contains malformed refs.
  return {
    blocks: [
      {
        content: [{ referenceId: "malformed_ref", type: "reference" }],
        id: "block_1",
        kind: "primitive",
        type: "text",
      },
    ],
    references: [
      {
        id: "malformed_ref",
        source: {
          ref: input.ref,
          schemaVersion: 1,
          sourceId: "sourceA",
          type: input.type,
        },
      },
    ],
    responseFields: [],
    schemaVersion: 2,
  } as QuestionBlueprintDocument;
}
