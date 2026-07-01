import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createQuestionBlueprint,
  nextUntitledQuestionBlueprintName,
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintVersionId,
  questionBlueprintVisibility,
  questionBody,
  questionSourceEvidence,
  reconstituteQuestionBlueprint,
  sourceArtifactId,
  sourceDocumentId,
  sourceRevisionId,
  userId,
  workbookId,
} from "./index.js";

const ownerUserId = userId("019e9315-6a87-715f-9861-8654df070c01");
const evidenceWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df070c02");
const evidenceSourceDocumentId = sourceDocumentId(
  "019e9315-6a87-715f-9861-8654df070c08",
);
const evidenceSourceRevisionId = sourceRevisionId(
  "019e9315-6a87-715f-9861-8654df070c09",
);
const evidenceSourceArtifactId = sourceArtifactId(
  "019e9315-6a87-715f-9861-8654df070c10",
);
const createdAt = new Date("2026-01-01T00:00:00.000Z");

describe("composable question canonical model", () => {
  it("creating a blueprint requires a document and sources array", () => {
    const blueprint = createQuestionBlueprint(
      {
        createdByUserId: ownerUserId,
        currentVersionId: questionBlueprintVersionId(
          "019e9315-6a87-715f-9861-8654df070c07",
        ),
        description: questionBlueprintDescription(null),
        document: emptyDocument(),
        id: questionBlueprintId("019e9315-6a87-715f-9861-8654df070c03"),
        name: questionBlueprintName("Revenue"),
        ownerUserId,
        sources: [],
        visibility: questionBlueprintVisibility("private"),
      },
      createdAt,
    );

    assert.deepEqual(blueprint.document, emptyDocument());
    assert.deepEqual(blueprint.sources, []);
  });

  it("persisted null or missing document fails fast", () => {
    assert.throws(
      () => reconstituteQuestionBlueprint(storedBlueprint({ document: null })),
      /question blueprint document must be an object/,
    );
    assert.throws(
      () =>
        reconstituteQuestionBlueprint(storedBlueprint({ document: undefined })),
      /question blueprint document must be an object/,
    );
  });

  it("persisted null or missing sources fails fast", () => {
    assert.throws(
      () => reconstituteQuestionBlueprint(storedBlueprint({ sources: null })),
      /question blueprint sources must be an array/,
    );
    assert.throws(
      () =>
        reconstituteQuestionBlueprint(storedBlueprint({ sources: undefined })),
      /question blueprint sources must be an array/,
    );
  });

  it("rejects duplicate source ids", () => {
    assert.throws(
      () =>
        createQuestionBlueprint(
          {
            ...blueprintInput(),
            sources: [workbookSource("source_1"), workbookSource("source_1")],
          },
          createdAt,
        ),
      /question blueprint source ids must be unique/,
    );
  });

  it("rejects workbook references that use an unknown source id", () => {
    assert.throws(
      () =>
        createQuestionBlueprint(
          {
            ...blueprintInput(),
            document: documentWithWorkbookReference("missing_source"),
            sources: [workbookSource("source_1")],
          },
          createdAt,
        ),
      /unknown question blueprint source id/,
    );
  });

  it("serializes new blueprint documents with schemaVersion 2", () => {
    assert.equal(emptyDocument().schemaVersion, 2);
  });

  it("rejects old v1 canonical response blocks", () => {
    assert.throws(
      () =>
        questionBlueprintDocument({
          blocks: [
            {
              id: "legacy_response",
              kind: "primitive",
              responseFieldId: "answer",
              type: "response",
            },
          ],
          references: [],
          responseFields: [{ id: "answer", type: "text" }],
          schemaVersion: 1,
        }),
      /schemaVersion must be 2/,
    );
  });

  it("requires correctValueSource for non-manual input grading", () => {
    assert.doesNotThrow(() =>
      documentWithBlocks([inputBlock("manual", "answer")]),
    );
    assert.throws(
      () =>
        documentWithBlocks([
          {
            grading: { mode: "exact" },
            id: "exact_input",
            kind: "primitive",
            points: 1,
            responseFieldId: "answer",
            type: "input",
          },
        ]),
      /non-manual input block exact_input requires correctValueSource/,
    );
  });

  it("rejects legacy table content and response cell variants", () => {
    assert.throws(
      () =>
        documentWithBlocks([
          {
            cells: [
              {
                columnId: "column_1",
                content: [{ text: "Legacy", type: "text" }],
                id: "cell_1",
                rowId: "row_1",
                type: "content",
              },
            ],
            columns: [{ id: "column_1", label: "Column" }],
            id: "table_1",
            kind: "complex",
            rows: [{ id: "row_1", label: "Row" }],
            showColumnNames: true,
            showRowNames: true,
            type: "table",
          },
        ]),
      /table cell blocks must be an array/,
    );
  });

  it("accepts table cell formatting on canonical table cells", () => {
    const document = documentWithBlocks([
      tableBlock("table_1", [
        {
          ...tableCell("cell_1", "row_1", "column_1", [
            textBlock("text_1", "Cell"),
          ]),
          formatting: {
            emphasis: "strong",
            textAlign: "center",
            tone: "highlight",
          },
        },
      ]),
    ]);

    const table = document.blocks[0];
    assert.deepEqual(table?.type === "table" ? table.cells[0] : null, {
      blocks: [textBlock("text_1", "Cell")],
      columnId: "column_1",
      formatting: {
        emphasis: "strong",
        textAlign: "center",
        tone: "highlight",
      },
      id: "cell_1",
      rowId: "row_1",
    });
  });

  it("rejects invalid table cell formatting", () => {
    assert.throws(
      () =>
        documentWithBlocks([
          tableBlock("table_1", [
            {
              ...tableCell("cell_1", "row_1", "column_1", [
                textBlock("text_1", "Cell"),
              ]),
              formatting: { textAlign: "justify" },
            },
          ]),
        ]),
      /table cell textAlign must be one of left, center, right/,
    );
  });

  it("rejects duplicate document-global block ids", () => {
    assert.throws(
      () =>
        documentWithBlocks([
          textBlock("duplicate_id", "First"),
          textBlock("duplicate_id", "Second"),
        ]),
      /block id duplicate_id is duplicated/,
    );
    assert.throws(
      () =>
        documentWithBlocks([
          textBlock("duplicate_id", "Top"),
          {
            blocks: [textBlock("duplicate_id", "Nested")],
            id: "step_1",
            kind: "container",
            type: "step",
          },
        ]),
      /block id duplicate_id is duplicated/,
    );
    assert.throws(
      () =>
        documentWithBlocks([
          {
            blocks: [
              textBlock("duplicate_id", "Nested one"),
              textBlock("duplicate_id", "Nested two"),
            ],
            id: "step_1",
            kind: "container",
            type: "step",
          },
        ]),
      /block id duplicate_id is duplicated/,
    );
  });

  it("rejects duplicate primitive block ids inside table cells", () => {
    assert.throws(
      () =>
        documentWithBlocks([
          textBlock("duplicate_id", "Top"),
          tableBlock("table_1", [
            tableCell("cell_1", "row_1", "column_1", [
              textBlock("duplicate_id", "Cell"),
            ]),
          ]),
        ]),
      /block id duplicate_id is duplicated/,
    );
    assert.throws(
      () =>
        documentWithBlocks([
          tableBlock("table_1", [
            tableCell("cell_1", "row_1", "column_1", [
              textBlock("duplicate_id", "Cell one"),
            ]),
            tableCell("cell_2", "row_2", "column_1", [
              textBlock("duplicate_id", "Cell two"),
            ]),
          ]),
        ]),
      /block id duplicate_id is duplicated/,
    );
  });

  it("allows duplicate cell ids in different tables because cells are table-scoped", () => {
    const document = documentWithBlocks([
      tableBlock("table_1", [
        tableCell("cell_1", "row_1", "column_1", [textBlock("text_1", "One")]),
      ]),
      tableBlock("table_2", [
        tableCell("cell_1", "row_1", "column_1", [textBlock("text_2", "Two")]),
      ]),
    ]);

    assert.equal(document.blocks.length, 2);
  });

  it("validates input primitive response fields recursively", () => {
    assert.throws(
      () => documentWithBlocks([inputBlock("top_input", "missing")]),
      /input block top_input references unknown response field missing/,
    );
    assert.throws(
      () =>
        documentWithBlocks([
          {
            blocks: [inputBlock("nested_input", "missing")],
            id: "step_1",
            kind: "container",
            type: "step",
          },
        ]),
      /input block nested_input references unknown response field missing/,
    );
    assert.throws(
      () =>
        documentWithBlocks([
          tableBlock("table_1", [
            tableCell("cell_1", "row_1", "column_1", [
              inputBlock("cell_input", "missing"),
            ]),
          ]),
        ]),
      /input block cell_input references unknown response field missing/,
    );
    assert.throws(
      () =>
        documentWithBlocks([
          tableBlock("table_1", [
            tableCell("cell_1", "row_1", "column_1", [
              inputBlock("first_input", "answer"),
              inputBlock("second_input", "missing"),
            ]),
          ]),
        ]),
      /input block second_input references unknown response field missing/,
    );
  });

  it("materialized question bodies use schemaVersion 2 and validate nested input fields", () => {
    const body = questionBody({
      blocks: [textBodyBlock("body_text", "Generated")],
      responseFields: [],
      schemaVersion: 2,
    });

    assert.equal(body.schemaVersion, 2);
    assert.throws(
      () =>
        questionBody({
          blocks: [
            {
              blocks: [inputBodyBlock("nested_input", "missing")],
              id: "step_1",
              kind: "container",
              type: "step",
            },
          ],
          responseFields: [],
          schemaVersion: 2,
        }),
      /input block nested_input references unknown response field missing/,
    );
  });

  it("allows unused attached sources", () => {
    const blueprint = createQuestionBlueprint(
      {
        ...blueprintInput(),
        document: emptyDocument(),
        sources: [workbookSource("source_1")],
      },
      createdAt,
    );

    assert.equal(blueprint.sources[0]?.sourceId, "source_1");
  });

  it("generates next default blueprint name", () => {
    assert.equal(nextUntitledQuestionBlueprintName([]), "Untitled blueprint");
    assert.equal(
      nextUntitledQuestionBlueprintName([
        "Untitled blueprint",
        "Untitled blueprint 2",
      ]),
      "Untitled blueprint 3",
    );
  });

  it("source evidence accepts only schemaVersion plus sources", () => {
    const evidence = questionSourceEvidence({
      schemaVersion: 1,
      sources: [
        {
          questionIndex: 0,
          references: ["workbook:source_1:cell:Sheet1:A1"],
          snapshotIndex: 0,
          sourceId: "source_1",
          sourceName: "Source 1",
          workbookCalculationId: "019e9315-6a87-715f-9861-8654df070c04",
          workbookId: evidenceWorkbookId,
          workbookSnapshotId: "019e9315-6a87-715f-9861-8654df070c05",
        },
      ],
    });

    assert.deepEqual(evidence.sources[0]?.references, [
      "workbook:source_1:cell:Sheet1:A1",
    ]);
    assert.throws(
      () => questionSourceEvidence({ references: [], schemaVersion: 1 }),
      /sources must be an array/,
    );
  });

  it("source evidence rejects raw resolved values", () => {
    assert.throws(
      () =>
        questionSourceEvidence({
          schemaVersion: 1,
          sources: [
            {
              questionIndex: 0,
              references: ["workbook:source_1:cell:Sheet1:A1"],
              resolvedValue: 1200,
              snapshotIndex: 0,
              sourceId: "source_1",
              sourceName: "Source 1",
              workbookCalculationId: "019e9315-6a87-715f-9861-8654df070c04",
              workbookId: evidenceWorkbookId,
              workbookSnapshotId: "019e9315-6a87-715f-9861-8654df070c05",
            },
          ],
        }),
      /resolvedValue is not allowed/,
    );
  });
});

function blueprintInput() {
  return {
    createdByUserId: ownerUserId,
    currentVersionId: questionBlueprintVersionId(
      "019e9315-6a87-715f-9861-8654df070c07",
    ),
    description: questionBlueprintDescription(null),
    document: emptyDocument(),
    id: questionBlueprintId("019e9315-6a87-715f-9861-8654df070c03"),
    name: questionBlueprintName("Revenue"),
    ownerUserId,
    sources: [],
    visibility: questionBlueprintVisibility("private"),
  };
}

function storedBlueprint(overrides: { document?: unknown; sources?: unknown }) {
  return {
    ...blueprintInput(),
    archivedAt: null,
    createdAt,
    currentVersionId: questionBlueprintVersionId(
      "019e9315-6a87-715f-9861-8654df070c07",
    ),
    document: emptyDocument(),
    sources: [],
    status: "active",
    updatedAt: createdAt,
    ...overrides,
  };
}

function emptyDocument() {
  return questionBlueprintDocument({
    blocks: [],
    references: [],
    responseFields: [],
    schemaVersion: 2,
  });
}

function documentWithBlocks(blocks: unknown[]) {
  return questionBlueprintDocument({
    blocks,
    references: [],
    responseFields: [{ id: "answer", type: "text" }],
    schemaVersion: 2,
  });
}

function textBlock(id: string, text: string) {
  return {
    content: [{ text, type: "text" }],
    id,
    kind: "primitive",
    type: "text",
  };
}

function textBodyBlock(id: string, text: string) {
  return {
    content: [{ displayValue: text, referenceId: id, type: "value" }],
    id,
    kind: "primitive",
    type: "text",
  };
}

function inputBlock(id: string, responseFieldId: string) {
  return {
    grading: { mode: "manual" },
    id,
    kind: "primitive",
    points: 1,
    responseFieldId,
    type: "input",
  };
}

function inputBodyBlock(id: string, responseFieldId: string) {
  return {
    id,
    kind: "primitive",
    responseFieldId,
    type: "input",
  };
}

function tableBlock(id: string, cells: unknown[]) {
  return {
    cells,
    columns: [{ id: "column_1", label: "Column" }],
    id,
    kind: "complex",
    rows: [
      { id: "row_1", label: "Row one" },
      { id: "row_2", label: "Row two" },
    ],
    showColumnNames: true,
    showRowNames: true,
    type: "table",
  };
}

function tableCell(
  id: string,
  rowId: string,
  columnId: string,
  blocks: unknown[],
) {
  return {
    blocks,
    columnId,
    id,
    rowId,
  };
}

function documentWithWorkbookReference(sourceId: string) {
  return questionBlueprintDocument({
    blocks: [],
    references: [
      {
        id: `workbook:${sourceId}:cell:Sheet1:A1`,
        source: {
          ref: "Sheet1!A1",
          schemaVersion: 1,
          sourceId,
          type: "workbook_cell",
        },
      },
    ],
    responseFields: [],
    schemaVersion: 2,
  });
}

function workbookSource(sourceId: string) {
  return {
    byteSize: 1234,
    checksumSha256:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    fileId: "019e9315-6a87-715f-9861-8654df070cb3",
    name: "Source 1",
    originalName: "source-1.xlsx",
    sourceArtifactId: evidenceSourceArtifactId,
    sourceDocumentId: evidenceSourceDocumentId,
    sourceId,
    sourceRevisionId: evidenceSourceRevisionId,
    type: "workbook" as const,
    workbookId: evidenceWorkbookId,
  };
}
