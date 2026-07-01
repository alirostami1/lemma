import { describe, expect, it } from "vitest";
import type { QuestionBlueprintDocument } from "#/api/generated/model";
import { QuestionBodySchemaVersion } from "#/api/generated/model/questionBodySchemaVersion";
import type {
  ComposedInlineContent,
  TableEditorCell,
  TableEditorInputBlock,
  TableEditorModel,
} from "#/domains/questions/authoring";
import {
  type ComposedEditorModel,
  coerceAnswerValue,
  coerceLiteralExpressionValue,
  createDefaultComposedEditorModel,
  createResponseBlock,
  createTableBlock,
  createTableFromWorkbookRangeReference,
  extractUsedReferenceIdsFromComposedEditorModel,
  extractWorkbookReferenceRefsFromComposedEditorModel,
  nextAvailableResponseFieldId,
  richContentFromInlineContent,
} from "#/domains/questions/authoring";
import {
  formatInlineBlueprint,
  parseInlineBlueprint,
} from "#/domains/questions/authoring/inline-content";
import {
  questionAnswerToTableAnswerState,
  tableAnswerStateToQuestionAnswer,
  toCreateQuestionGenerationRunInput,
} from "./blueprint";
import {
  composedEditorModelToQuestionBlueprintDocument,
  questionBlueprintDocumentToComposedEditorModel,
  questionBlueprintDocumentToTableEditorModel,
  questionBodyToTableBlockPreviewModel,
  tableEditorModelToQuestionBlueprintDocument,
  validateComposedEditorModel,
} from "./canonical-authoring";

describe("table answer values", () => {
  it("coerces by response field type", () => {
    expect(coerceAnswerValue("001", { id: "text", type: "text" })).toBe("001");
    expect(coerceAnswerValue("1.0", { id: "number", type: "number" })).toBe(1);
    expect(coerceAnswerValue("a", { id: "select", type: "select" })).toBe("a");
  });

  it("coerces authored literal response values by response field type", () => {
    expect(
      coerceLiteralExpressionValue("001", { id: "text", type: "text" }),
    ).toBe("001");
    expect(
      coerceLiteralExpressionValue("1.0", { id: "number", type: "number" }),
    ).toBe(1);
    expect(coerceLiteralExpressionValue("1.0")).toBe(1);
    expect(coerceLiteralExpressionValue("false")).toBe(false);
    expect(coerceLiteralExpressionValue('{"a":1}')).toBe('{"a":1}');
  });

  it("maps canonical answer JSON without stringifying objects", () => {
    expect(
      tableAnswerStateToQuestionAnswer({
        answer_1: { nested: ["x", 2, null] },
      }),
    ).toEqual({
      responses: [
        {
          responseFieldId: "answer_1",
          value: { nested: ["x", 2, null] },
        },
      ],
      schemaVersion: 1,
    });
    expect(
      questionAnswerToTableAnswerState({
        responses: [
          {
            responseFieldId: "answer_1",
            value: { nested: ["x", 2, null] },
          },
        ],
        schemaVersion: 1,
      }),
    ).toEqual({ answer_1: { nested: ["x", 2, null] } });
  });
});

describe("question generation input mapping", () => {
  it("maps saved blueprint generation inputs with workbook sources", () => {
    expect(
      toCreateQuestionGenerationRunInput({
        blueprintId: "blueprint_1",
        count: 3,
        targetQuestionSetId: "question_set_1",
      }),
    ).toEqual({
      blueprintId: "blueprint_1",
      count: 3,
      targetQuestionSetId: "question_set_1",
    });
  });

  it("maps saved blueprint generation inputs without a workbook source", () => {
    expect(
      toCreateQuestionGenerationRunInput({
        blueprintId: "blueprint_1",
        count: 1,
        targetQuestionSetId: "question_set_1",
      }),
    ).toEqual({
      blueprintId: "blueprint_1",
      count: 1,
      targetQuestionSetId: "question_set_1",
    });
  });
});

describe("composed blueprint conversions", () => {
  it("parses inline references", () => {
    expect(parseInlineBlueprint("Revenue: {{ .revenue }}")).toEqual([
      { text: "Revenue: ", type: "text" },
      { referenceId: "revenue", type: "reference" },
    ]);
  });

  it("parses range cell inline references", () => {
    expect(parseInlineBlueprint("Revenue: {{ .range[1,2] }}")).toEqual([
      { text: "Revenue: ", type: "text" },
      {
        rangeCell: { columnOffset: 2, rowOffset: 1 },
        referenceId: "range",
        type: "reference",
      },
    ]);
  });

  it("formats inline references", () => {
    expect(
      formatInlineBlueprint([
        { text: "Revenue: ", type: "text" },
        { referenceId: "revenue", type: "reference" },
      ]),
    ).toBe("Revenue: {{ .revenue }}");
  });

  it("formats range cell inline references", () => {
    expect(
      formatInlineBlueprint([
        { text: "Revenue: ", type: "text" },
        {
          rangeCell: { columnOffset: 2, rowOffset: 1 },
          referenceId: "range",
          type: "reference",
        },
      ]),
    ).toBe("Revenue: {{ .range[1,2] }}");
  });

  it("formats non-simple inline references with the shared bracket grammar", () => {
    const content = [
      {
        referenceId: "workbook:source_1:cell:Sheet1:A1",
        type: "reference" as const,
      },
    ];

    const formatted = formatInlineBlueprint(content);

    expect(formatted).toBe('{{ .["workbook:source_1:cell:Sheet1:A1"] }}');
    expect(parseInlineBlueprint(formatted)).toEqual(content);
  });

  it("creates range-backed table cells without generated cell references", () => {
    const currentModel: TableEditorModel = {
      blockId: "table_1",
      cells: [],
      columns: [],
      prompt: "",
      responseFields: [],
      rows: [],
      showColumnNames: true,
      showRowNames: true,
    };

    const result = createTableFromWorkbookRangeReference({
      currentModel,
      rangeReference: {
        id: "range",
        source: {
          ref: "Sheet1!A1:B2",
          sourceId: "source_1",
          type: "workbook_range",
        },
      },
      values: [
        ["A1", "B1"],
        ["A2", "B2"],
      ],
    });

    expect(result.references).toEqual([]);
    expect(result.table.cells).toEqual([
      {
        blocks: [
          {
            content: [
              {
                fallbackText: "A1",
                rangeCell: { columnOffset: 0, rowOffset: 0 },
                referenceId: "range",
                type: "reference",
              },
            ],
            id: "table_1_cell_1_1_text",
            type: "text",
          },
        ],
        columnId: "column_1",
        id: "cell_1_1",
        rowId: "row_1",
      },
      {
        blocks: [
          {
            content: [
              {
                fallbackText: "B1",
                rangeCell: { columnOffset: 1, rowOffset: 0 },
                referenceId: "range",
                type: "reference",
              },
            ],
            id: "table_1_cell_1_2_text",
            type: "text",
          },
        ],
        columnId: "column_2",
        id: "cell_1_2",
        rowId: "row_1",
      },
      {
        blocks: [
          {
            content: [
              {
                fallbackText: "A2",
                rangeCell: { columnOffset: 0, rowOffset: 1 },
                referenceId: "range",
                type: "reference",
              },
            ],
            id: "table_1_cell_2_1_text",
            type: "text",
          },
        ],
        columnId: "column_1",
        id: "cell_2_1",
        rowId: "row_2",
      },
      {
        blocks: [
          {
            content: [
              {
                fallbackText: "B2",
                rangeCell: { columnOffset: 1, rowOffset: 1 },
                referenceId: "range",
                type: "reference",
              },
            ],
            id: "table_1_cell_2_2_text",
            type: "text",
          },
        ],
        columnId: "column_2",
        id: "cell_2_2",
        rowId: "row_2",
      },
    ]);
  });

  it("namespaces range-backed table primitive ids by table block id", () => {
    const createRangeTable = (blockId: string) =>
      createTableFromWorkbookRangeReference({
        currentModel: {
          blockId,
          cells: [],
          columns: [],
          prompt: "",
          responseFields: [],
          rows: [],
          showColumnNames: true,
          showRowNames: true,
        },
        rangeReference: {
          id: "range",
          source: {
            ref: "Sheet1!A1:A1",
            sourceId: "source_1",
            type: "workbook_range",
          },
        },
        values: [["A1"]],
      }).table;

    const primitiveIds = [
      createRangeTable("table_1"),
      createRangeTable("table_2"),
    ]
      .flatMap((table) => table.cells)
      .flatMap((cell) => cell.blocks.map((block) => block.id));

    expect(primitiveIds).toEqual([
      "table_1_cell_1_1_text",
      "table_2_cell_1_1_text",
    ]);
    expect(new Set(primitiveIds).size).toBe(primitiveIds.length);
  });

  it("creates canonical primitives for text and answer inputs", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ text: "What is 2 + 2?", type: "text" }],
          id: "text_1",
          type: "text",
        },
        {
          correctValueSource: {
            referenceId: "answer_source",
            type: "reference",
          },
          grading: { mode: "exact" },
          id: "response_1",
          label: "Answer",
          placeholder: "Type a number",
          points: 2,
          responseFieldId: "answer_1",
          type: "response",
        },
      ],
      references: [
        {
          id: "answer_source",
          source: { type: "literal", value: 4 },
        },
      ],
      responseFields: [
        {
          id: "answer_1",
          label: "Answer",
          type: "number",
        },
      ],
      schemaVersion: 2,
    };

    expect(composedEditorModelToQuestionBlueprintDocument(model)).toEqual({
      blocks: [
        {
          content: [{ text: "What is 2 + 2?", type: "text" }],
          id: "text_1",
          kind: "primitive",
          type: "text",
        },
        {
          correctValueSource: {
            referenceId: "answer_source",
            schemaVersion: 1,
            type: "reference",
          },
          grading: { mode: "exact" },
          id: "response_1",
          input: {
            schemaVersion: 1,
            type: "number",
          },
          kind: "primitive",
          label: "Answer",
          placeholder: "Type a number",
          points: 2,
          responseFieldId: "answer_1",
          type: "input",
        },
      ],
      references: [
        {
          id: "answer_source",
          source: { schemaVersion: 1, type: "literal", value: 4 },
        },
      ],
      responseFields: [
        {
          id: "answer_1",
          label: "Answer",
          type: "number",
        },
      ],
      schemaVersion: 2,
    });
  });

  it("treats literal-only composed documents as static", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ text: "Static prompt", type: "text" }],
          id: "text_1",
          type: "text",
        },
        {
          correctValueSource: {
            referenceId: "answer_source",
            type: "reference",
          },
          grading: { mode: "exact" },
          id: "response_1",
          points: 1,
          responseFieldId: "answer_1",
          type: "response",
        },
      ],
      references: [
        {
          id: "answer_source",
          source: { type: "literal", value: "ok" },
        },
      ],
      responseFields: [
        {
          id: "answer_1",
          type: "text",
        },
      ],
      schemaVersion: 2,
    };

    expect(extractWorkbookReferenceRefsFromComposedEditorModel(model)).toEqual(
      [],
    );
  });

  it("keeps literal references static in canonical conversion", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [
            { text: "Rate: ", type: "text" },
            { referenceId: "rate", type: "reference" },
          ],
          id: "text_1",
          type: "text",
        },
      ],
      references: [
        {
          id: "rate",
          source: { type: "literal", value: 0.5 },
        },
      ],
      responseFields: [],
      schemaVersion: 2,
    };

    const blueprint = composedEditorModelToQuestionBlueprintDocument(model);
    expect(blueprint.references).toEqual([
      {
        id: "rate",
        source: { schemaVersion: 1, type: "literal", value: 0.5 },
      },
    ]);
    expect(blueprint.blocks[0]).toEqual({
      content: [
        { text: "Rate: ", type: "text" },
        { referenceId: "rate", type: "reference" },
      ],
      id: "text_1",
      kind: "primitive",
      type: "text",
    });
    expect(extractWorkbookReferenceRefsFromComposedEditorModel(model)).toEqual(
      [],
    );
  });

  it("ignores unused workbook-backed references for workbook source detection", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ text: "Static prompt", type: "text" }],
          id: "text_1",
          type: "text",
        },
      ],
      references: [
        {
          id: "unused_ref",
          source: {
            ref: "'Sheet1'!A1",
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
      ],
      responseFields: [],
      schemaVersion: 2,
    };

    expect(extractUsedReferenceIdsFromComposedEditorModel(model)).toEqual([]);
    expect(extractWorkbookReferenceRefsFromComposedEditorModel(model)).toEqual(
      [],
    );
  });

  it("strips unused references during canonical conversion", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ referenceId: "used_ref", type: "reference" }],
          id: "text_1",
          type: "text",
        },
      ],
      references: [
        {
          id: "used_ref",
          source: { type: "literal", value: "Alpha" },
        },
        {
          id: "unused_ref",
          source: {
            ref: "'Sheet1'!A1",
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
      ],
      responseFields: [],
      schemaVersion: 2,
    };

    const document = composedEditorModelToQuestionBlueprintDocument(model);

    expect(document.references).toEqual([
      {
        id: "used_ref",
        source: {
          schemaVersion: 1,
          type: "literal",
          value: "Alpha",
        },
      },
    ]);
    expect(model.references.map((reference) => reference.id)).toEqual([
      "used_ref",
      "unused_ref",
    ]);
  });

  it("collects workbook refs from workbook-backed references", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ referenceId: "revenue", type: "reference" }],
          id: "text_1",
          type: "text",
        },
      ],
      references: [
        {
          id: "revenue",
          source: {
            ref: "'Sheet1'!A1",
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
      ],
      responseFields: [],
      schemaVersion: 2,
    };

    expect(
      composedEditorModelToQuestionBlueprintDocument(model).references,
    ).toEqual([
      {
        id: "revenue",
        source: {
          ref: "'Sheet1'!A1",
          schemaVersion: 1,
          sourceId: "source_1",
          type: "workbook_cell",
        },
      },
    ]);
    expect(extractWorkbookReferenceRefsFromComposedEditorModel(model)).toEqual([
      "'Sheet1'!A1",
    ]);
  });

  it("keeps used literal references out of workbook source detection", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ referenceId: "literal_ref", type: "reference" }],
          id: "text_1",
          type: "text",
        },
      ],
      references: [
        {
          id: "literal_ref",
          source: { type: "literal", value: "Alpha" },
        },
      ],
      responseFields: [],
      schemaVersion: 2,
    };

    expect(extractUsedReferenceIdsFromComposedEditorModel(model)).toEqual([
      "literal_ref",
    ]);
    expect(extractWorkbookReferenceRefsFromComposedEditorModel(model)).toEqual(
      [],
    );
  });

  it("round-trips reference-backed table content and answer values", () => {
    const model: ComposedEditorModel = {
      blocks: [
        createTableBlock("table_1", {
          cells: [
            createTextTableCell({
              blockId: "cell_1_text",
              columnId: "column_1",
              content: [{ referenceId: "content_ref", type: "reference" }],
              id: "cell_1",
              rowId: "row_1",
            }),
            createInputTableCell({
              blockId: "cell_2_input",
              columnId: "column_1",
              correctValueSource: {
                referenceId: "answer_ref",
                type: "reference",
              },
              grading: { mode: "exact" },
              id: "cell_2",
              input: {
                type: "number",
                validation: { required: true },
              },
              points: 2,
              responseFieldId: "answer_1",
              rowId: "row_1",
            }),
          ],
          columns: [{ id: "column_1", label: "Column 1" }],
          prompt: "",
          responseFields: [
            {
              id: "answer_1",
              label: "Answer",
              type: "number",
            },
          ],
          rows: [{ id: "row_1", label: "Row 1" }],
          showColumnNames: true,
          showRowNames: true,
        }),
      ],
      references: [
        {
          id: "content_ref",
          source: { type: "literal", value: "Alpha" },
        },
        {
          id: "answer_ref",
          source: { type: "literal", value: 3 },
        },
      ],
      responseFields: [],
      schemaVersion: 2,
    };

    const blueprint = composedEditorModelToQuestionBlueprintDocument(model);
    expect(questionBlueprintDocumentToComposedEditorModel(blueprint)).toEqual(
      model,
    );
  });

  it("collects workbook refs from standalone answer inputs", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          correctValueSource: {
            referenceId: "answer_source",
            type: "reference",
          },
          grading: { mode: "exact" },
          id: "response_1",
          points: 1,
          responseFieldId: "answer_1",
          type: "response",
        },
      ],
      references: [
        {
          id: "answer_source",
          source: {
            ref: "'Sheet1'!B2",
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
      ],
      responseFields: [
        {
          id: "answer_1",
          type: "number",
        },
      ],
      schemaVersion: 2,
    };

    expect(extractWorkbookReferenceRefsFromComposedEditorModel(model)).toEqual([
      "'Sheet1'!B2",
    ]);
  });

  it("collects workbook refs from table cell sources", () => {
    const model: ComposedEditorModel = {
      blocks: [
        createTableBlock("table_1", {
          cells: [
            createTextTableCell({
              blockId: "cell_1_text",
              columnId: "column_1",
              content: [{ referenceId: "table_source", type: "reference" }],
              id: "cell_1",
              rowId: "row_1",
            }),
          ],
          columns: [{ id: "column_1", label: "Column 1" }],
          prompt: "",
          responseFields: [],
          rows: [{ id: "row_1", label: "Row 1" }],
          showColumnNames: true,
          showRowNames: true,
        }),
      ],
      references: [
        {
          id: "table_source",
          source: {
            ref: "'Sheet1'!A1:B2",
            sourceId: "source_1",
            type: "workbook_range",
          },
        },
      ],
      responseFields: [],
      schemaVersion: 2,
    };

    expect(extractWorkbookReferenceRefsFromComposedEditorModel(model)).toEqual([
      "'Sheet1'!A1:B2",
    ]);
  });

  it("rejects unknown references", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ referenceId: "missing", type: "reference" }],
          id: "text_1",
          type: "text",
        },
      ],
      references: [],
      responseFields: [],
      schemaVersion: 2,
    };

    expect(() => validateComposedEditorModel(model)).toThrow(
      "Unknown reference: missing",
    );
  });

  it("rejects missing references in answer values", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          correctValueSource: { referenceId: "missing", type: "reference" },
          grading: { mode: "exact" },
          id: "response_1",
          points: 1,
          responseFieldId: "answer_1",
          type: "response",
        },
      ],
      references: [],
      responseFields: [
        {
          id: "answer_1",
          type: "text",
        },
      ],
      schemaVersion: 2,
    };

    expect(() => validateComposedEditorModel(model)).toThrow(
      "Unknown reference: missing",
    );
  });

  it("rejects missing references in table content cells", () => {
    const model: ComposedEditorModel = {
      blocks: [
        createTableBlock("table_1", {
          cells: [
            createTextTableCell({
              blockId: "cell_1_text",
              columnId: "column_1",
              content: [{ referenceId: "missing", type: "reference" }],
              id: "cell_1",
              rowId: "row_1",
            }),
          ],
          columns: [{ id: "column_1", label: "Column 1" }],
          prompt: "",
          responseFields: [],
          rows: [{ id: "row_1", label: "Row 1" }],
          showColumnNames: true,
          showRowNames: true,
        }),
      ],
      references: [],
      responseFields: [],
      schemaVersion: 2,
    };

    expect(() => validateComposedEditorModel(model)).toThrow(
      "Unknown reference: missing",
    );
  });

  it("rejects missing references in table answer cells", () => {
    const model: ComposedEditorModel = {
      blocks: [
        createTableBlock("table_1", {
          cells: [
            createInputTableCell({
              blockId: "cell_1_input",
              columnId: "column_1",
              correctValueSource: { referenceId: "missing", type: "reference" },
              grading: { mode: "exact" },
              id: "cell_1",
              points: 1,
              responseFieldId: "answer_1",
              rowId: "row_1",
            }),
          ],
          columns: [{ id: "column_1", label: "Column 1" }],
          prompt: "",
          responseFields: [
            {
              id: "answer_1",
              type: "number",
            },
          ],
          rows: [{ id: "row_1", label: "Row 1" }],
          showColumnNames: true,
          showRowNames: true,
        }),
      ],
      references: [],
      responseFields: [],
      schemaVersion: 2,
    };

    expect(() => validateComposedEditorModel(model)).toThrow(
      "Unknown reference: missing",
    );
  });

  it("rejects duplicate reference ids", () => {
    const model: ComposedEditorModel = {
      blocks: [],
      references: [
        {
          id: "dup",
          source: { type: "literal", value: 1 },
        },
        {
          id: "dup",
          source: { type: "literal", value: 2 },
        },
      ],
      responseFields: [],
      schemaVersion: 2,
    };

    expect(() => validateComposedEditorModel(model)).toThrow(
      "Duplicate reference id: dup",
    );
  });

  it("rejects invalid reference ids", () => {
    const model: ComposedEditorModel = {
      blocks: [],
      references: [
        {
          id: "bad id",
          source: { type: "literal", value: 1 },
        },
      ],
      responseFields: [],
      schemaVersion: 2,
    };

    expect(() => validateComposedEditorModel(model)).toThrow(
      "Invalid reference id: bad id",
    );
  });

  it("allocates standalone response field IDs after table block IDs", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          id: "table_1",
          table: {
            blockId: "table_1",
            cells: [
              createInputTableCell({
                blockId: "cell_1_input",
                columnId: "column_1",
                correctValueSource: { type: "literal", value: 1 },
                grading: { mode: "exact" },
                id: "cell_1",
                points: 1,
                responseFieldId: "answer_1",
                rowId: "row_1",
              }),
            ],
            columns: [{ id: "column_1", label: "Column 1" }],
            prompt: "",
            responseFields: [
              {
                id: "answer_1",
                type: "number",
              },
            ],
            rows: [{ id: "row_1", label: "Row 1" }],
            showColumnNames: true,
            showRowNames: true,
          },
          type: "table",
        },
      ],
      references: [],
      responseFields: [],
      schemaVersion: 2,
    };

    expect(nextAvailableResponseFieldId(model)).toBe("answer_2");
  });

  it("preserves table conversion inside composed documents", () => {
    const tableModel: TableEditorModel = {
      cells: [
        createTextTableCell({
          blockId: "cell_1_text",
          columnId: "column_1",
          content: [{ text: "Alpha", type: "text" }],
          id: "cell_1",
          rowId: "row_1",
        }),
        createInputTableCell({
          blockId: "cell_2_input",
          columnId: "column_2",
          correctValueSource: { type: "literal", value: 3 },
          grading: { mode: "exact" },
          id: "cell_2",
          input: {
            type: "number",
            validation: { required: true },
          },
          points: 2,
          responseFieldId: "answer_1",
          rowId: "row_1",
        }),
      ],
      columns: [
        { id: "column_1", label: "Column 1" },
        { id: "column_2", label: "Column 2" },
      ],
      prompt: "Ignored in composed mode",
      responseFields: [
        {
          id: "answer_1",
          label: "Answer",
          type: "number",
        },
      ],
      rows: [{ id: "row_1", label: "Row 1" }],
      showColumnNames: true,
      showRowNames: true,
    };
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ text: "Solve this.", type: "text" }],
          id: "text_1",
          type: "text",
        },
        createTableBlock("table_1", tableModel),
      ],
      references: [],
      responseFields: [],
      schemaVersion: 2,
    };

    const blueprint = composedEditorModelToQuestionBlueprintDocument(model);
    expect(blueprint.blocks).toHaveLength(3);
    expect(blueprint.blocks[1]).toMatchObject({
      content: [{ text: "Ignored in composed mode", type: "text" }],
      id: "table_1_prompt",
      kind: "primitive",
      type: "text",
    });
    expect(blueprint.blocks[2]).toMatchObject({
      id: "table_1",
      kind: "complex",
      type: "table",
    });
    const tableBlock = blueprint.blocks[2];
    if (tableBlock.type !== "table") {
      throw new Error("Expected table block.");
    }
    expect(tableBlock.cells).toEqual([
      {
        blocks: [
          {
            content: [{ text: "Alpha", type: "text" }],
            id: "cell_1_text",
            kind: "primitive",
            type: "text",
          },
        ],
        columnId: "column_1",
        id: "cell_1",
        rowId: "row_1",
      },
      {
        blocks: [
          {
            correctValueSource: { schemaVersion: 1, type: "literal", value: 3 },
            grading: { mode: "exact" },
            id: "cell_2_input",
            input: {
              schemaVersion: 1,
              type: "number",
              validation: {
                required: true,
              },
            },
            kind: "primitive",
            points: 2,
            responseFieldId: "table_1_answer_1",
            type: "input",
          },
        ],
        columnId: "column_2",
        id: "cell_2",
        rowId: "row_1",
      },
    ]);
    expect(blueprint.responseFields).toEqual([
      {
        id: "table_1_answer_1",
        label: "Answer",
        required: true,
        type: "number",
      },
    ]);
  });

  it("loads canonical text and input primitives back into the composed model", () => {
    const blueprint: QuestionBlueprintDocument = {
      blocks: [
        {
          content: [{ text: "Prompt", type: "text" }],
          id: "text_1",
          kind: "primitive",
          type: "text",
        },
        {
          id: "separator_1",
          kind: "primitive",
          type: "separator",
        },
        {
          correctValueSource: {
            schemaVersion: 1,
            type: "literal",
            value: "42",
          },
          grading: { mode: "exact" },
          id: "response_1",
          input: {
            schemaVersion: 1,
            type: "text",
          },
          kind: "primitive",
          label: "Answer",
          placeholder: "Type here",
          points: 1,
          responseFieldId: "answer_1",
          type: "input",
        },
      ],
      references: [],
      responseFields: [
        {
          id: "answer_1",
          label: "Answer",
          required: true,
          type: "text",
        },
      ],
      schemaVersion: 2,
    };

    expect(questionBlueprintDocumentToComposedEditorModel(blueprint)).toEqual({
      blocks: [
        {
          content: [{ text: "Prompt", type: "text" }],
          id: "text_1",
          type: "text",
        },
        {
          id: "separator_1",
          type: "separator",
        },
        {
          correctValueSource: { type: "literal", value: "42" },
          grading: { mode: "exact" },
          id: "response_1",
          input: {
            type: "text",
            validation: { required: true },
          },
          label: "Answer",
          placeholder: "Type here",
          points: 1,
          responseFieldId: "answer_1",
          type: "response",
        },
      ],
      references: [],
      responseFields: [
        {
          id: "answer_1",
          label: "Answer",
          type: "text",
        },
      ],
      schemaVersion: 2,
    });
  });

  it("derives serialized required from the input primitive", () => {
    const blueprint = composedEditorModelToQuestionBlueprintDocument({
      blocks: [
        {
          correctValueSource: { type: "literal", value: "42" },
          grading: { mode: "exact" },
          id: "response_1",
          input: {
            type: "text",
            validation: { required: false },
          },
          points: 1,
          responseFieldId: "answer_1",
          type: "response",
        },
      ],
      references: [],
      responseFields: [{ id: "answer_1", label: "Answer", type: "text" }],
      schemaVersion: 2,
    });

    expect(blueprint.responseFields).toEqual([
      {
        id: "answer_1",
        label: "Answer",
        required: false,
        type: "text",
      },
    ]);
  });

  it("derives table serialized required from the cell input primitive", () => {
    const blueprint = composedEditorModelToQuestionBlueprintDocument({
      blocks: [
        {
          id: "table_1",
          table: {
            cells: [
              {
                blocks: [
                  {
                    correctValueSource: { type: "literal", value: 4 },
                    grading: { mode: "exact" },
                    id: "cell_input_1",
                    input: {
                      type: "number",
                      validation: { required: false },
                    },
                    points: 1,
                    responseFieldId: "answer_1",
                    type: "input",
                  },
                ],
                columnId: "column_1",
                id: "cell_1",
                rowId: "row_1",
              },
            ],
            columns: [{ id: "column_1", label: "Column" }],
            prompt: "",
            responseFields: [
              { id: "answer_1", label: "Answer", type: "number" },
            ],
            rows: [{ id: "row_1", label: "Row" }],
            showColumnNames: true,
            showRowNames: true,
          },
          type: "table",
        },
      ],
      references: [],
      responseFields: [],
      schemaVersion: 2,
    });

    expect(blueprint.responseFields).toContainEqual({
      id: "table_1_answer_1",
      label: "Answer",
      required: false,
      type: "number",
    });
  });

  it("rejects canonical required mismatches on load", () => {
    const blueprint: QuestionBlueprintDocument = {
      blocks: [
        {
          correctValueSource: {
            schemaVersion: 1,
            type: "literal",
            value: "42",
          },
          grading: { mode: "exact" },
          id: "response_1",
          input: {
            schemaVersion: 1,
            type: "text",
            validation: { required: false },
          },
          kind: "primitive",
          points: 1,
          responseFieldId: "answer_1",
          type: "input",
        },
      ],
      references: [],
      responseFields: [
        {
          id: "answer_1",
          required: true,
          type: "text",
        },
      ],
      schemaVersion: 2,
    };

    expect(() =>
      questionBlueprintDocumentToComposedEditorModel(blueprint),
    ).toThrow("Input required setting must match response field.");
  });

  it("migrates table legacy response required into cell input validation", () => {
    const blueprint: QuestionBlueprintDocument = {
      blocks: [
        {
          cells: [
            {
              blocks: [
                {
                  correctValueSource: {
                    schemaVersion: 1,
                    type: "literal",
                    value: 4,
                  },
                  grading: { mode: "exact" },
                  id: "cell_input_1",
                  input: {
                    schemaVersion: 1,
                    type: "number",
                  },
                  kind: "primitive",
                  points: 1,
                  responseFieldId: "table_1_answer_1",
                  type: "input",
                },
              ],
              columnId: "column_1",
              id: "cell_1",
              rowId: "row_1",
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
      ],
      references: [],
      responseFields: [
        {
          id: "table_1_answer_1",
          required: true,
          type: "number",
        },
      ],
      schemaVersion: 2,
    };

    const model = questionBlueprintDocumentToComposedEditorModel(blueprint);
    const table = model.blocks[0];
    if (table?.type !== "table") {
      throw new Error("Expected table.");
    }
    const cellBlock = table.table.cells[0]?.blocks[0];

    expect(cellBlock).toMatchObject({
      input: { validation: { required: true } },
      type: "input",
    });
    expect(table.table.responseFields).toEqual([
      { id: "answer_1", type: "number" },
    ]);
  });

  it("round-trips manual inputs without correct value sources", () => {
    const blueprint: QuestionBlueprintDocument = {
      blocks: [
        {
          grading: { mode: "manual" },
          id: "manual_input",
          input: {
            schemaVersion: 1,
            type: "text",
          },
          kind: "primitive",
          points: 1,
          responseFieldId: "answer_1",
          type: "input",
        },
        {
          cells: [
            {
              blocks: [
                {
                  grading: { mode: "manual" },
                  id: "table_manual_input",
                  input: {
                    schemaVersion: 1,
                    type: "text",
                  },
                  kind: "primitive",
                  points: 1,
                  responseFieldId: "table_1_answer_1",
                  type: "input",
                },
              ],
              columnId: "column_1",
              id: "cell_1",
              rowId: "row_1",
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
      ],
      references: [],
      responseFields: [
        { id: "answer_1", type: "text" },
        { id: "table_1_answer_1", type: "text" },
      ],
      schemaVersion: 2,
    };

    const model = questionBlueprintDocumentToComposedEditorModel(blueprint);
    const topLevelInput = model.blocks[0];
    const table = model.blocks[1];
    expect(
      topLevelInput?.type === "response"
        ? topLevelInput.correctValueSource
        : "unexpected",
    ).toBeUndefined();
    expect(
      table?.type === "table" &&
        table.table.cells[0]?.blocks[0]?.type === "input"
        ? table.table.cells[0].blocks[0].correctValueSource
        : "unexpected",
    ).toBeUndefined();

    const serialized = composedEditorModelToQuestionBlueprintDocument(model);
    expect(serialized.blocks[0]).not.toHaveProperty("correctValueSource");
    expect(
      serialized.blocks[1]?.kind === "complex"
        ? serialized.blocks[1].cells[0]?.blocks[0]
        : null,
    ).not.toHaveProperty("correctValueSource");
  });

  it("round-trips select input primitive config", () => {
    const model: ComposedEditorModel = {
      blocks: [
        createResponseBlock("response_1", "answer_1", {
          input: {
            defaultValueSource: { type: "literal", value: "b" },
            optionsSource: {
              type: "literal",
              value: [
                { label: "Alpha", value: "a" },
                { label: "Bravo", value: "b" },
              ],
            },
            type: "select",
            validation: { allowedValues: ["a", "b"], required: true },
          },
        }),
      ],
      references: [],
      responseFields: [{ id: "answer_1", type: "select" }],
      schemaVersion: 2,
    };

    const blueprint = composedEditorModelToQuestionBlueprintDocument(model);
    expect(blueprint.blocks[0]).toMatchObject({
      input: {
        defaultValueSource: { schemaVersion: 1, type: "literal", value: "b" },
        optionsSource: {
          schemaVersion: 1,
          type: "literal",
          value: [
            { label: "Alpha", value: "a" },
            { label: "Bravo", value: "b" },
          ],
        },
        schemaVersion: 1,
        type: "select",
        validation: { allowedValues: ["a", "b"], required: true },
      },
      type: "input",
    });

    expect(questionBlueprintDocumentToComposedEditorModel(blueprint)).toEqual(
      model,
    );
  });

  it("loads references from canonical blueprints", () => {
    const blueprint: QuestionBlueprintDocument = {
      blocks: [
        {
          content: [
            { text: "Revenue: ", type: "text" },
            { referenceId: "revenue", type: "reference" },
          ],
          id: "text_1",
          kind: "primitive",
          type: "text",
        },
      ],
      references: [
        {
          id: "revenue",
          source: { schemaVersion: 1, type: "literal", value: 123 },
        },
      ],
      responseFields: [],
      schemaVersion: 2,
    };

    expect(questionBlueprintDocumentToComposedEditorModel(blueprint)).toEqual({
      blocks: [
        {
          content: [
            { text: "Revenue: ", type: "text" },
            { referenceId: "revenue", type: "reference" },
          ],
          id: "text_1",
          type: "text",
        },
      ],
      references: [
        {
          id: "revenue",
          source: { type: "literal", value: 123 },
        },
      ],
      responseFields: [],
      schemaVersion: 2,
    });
  });

  it("round-trips rich text blocks without references", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: {
            content: [
              {
                content: [{ text: "Prompt", type: "text" }],
                type: "paragraph",
              },
            ],
            type: "doc",
          },
          id: "rich_1",
          type: "rich_text",
        },
      ],
      references: [],
      responseFields: [],
      schemaVersion: 2,
    };

    const blueprint = composedEditorModelToQuestionBlueprintDocument(model);
    expect(blueprint.blocks[0]).toEqual({
      content: {
        content: [
          {
            content: [{ text: "Prompt", type: "text" }],
            type: "paragraph",
          },
        ],
        type: "doc",
      },
      id: "rich_1",
      kind: "primitive",
      type: "rich_text",
    });
    expect(questionBlueprintDocumentToComposedEditorModel(blueprint)).toEqual(
      model,
    );
  });

  it("round-trips rich text references as structured inline content", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: {
            content: [
              {
                content: [
                  { text: "Revenue: ", type: "text" },
                  { referenceId: "revenue", type: "reference" },
                ],
                type: "paragraph",
              },
            ],
            type: "doc",
          },
          id: "rich_1",
          type: "rich_text",
        },
      ],
      references: [
        {
          id: "revenue",
          source: { type: "literal", value: 123 },
        },
      ],
      responseFields: [],
      schemaVersion: 2,
    };

    const blueprint = composedEditorModelToQuestionBlueprintDocument(model);
    expect(blueprint.blocks[0]).toEqual({
      content: {
        content: [
          {
            content: [{ text: "Revenue: {{ .revenue }}", type: "text" }],
            type: "paragraph",
          },
        ],
        type: "doc",
      },
      id: "rich_1",
      kind: "primitive",
      type: "rich_text",
    });
    expect(questionBlueprintDocumentToComposedEditorModel(blueprint)).toEqual(
      model,
    );
  });

  it("round-trips rich text heading references as structured inline content", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: {
            content: [
              {
                content: [
                  { text: "Revenue ", type: "text" },
                  { referenceId: "revenue", type: "reference" },
                ],
                level: 1,
                type: "heading",
              },
              {
                content: [
                  { text: "Margin ", type: "text" },
                  { referenceId: "margin", type: "reference" },
                ],
                level: 2,
                type: "heading",
              },
            ],
            type: "doc",
          },
          id: "rich_1",
          type: "rich_text",
        },
      ],
      references: [
        {
          id: "revenue",
          source: { type: "literal", value: 123 },
        },
        {
          id: "margin",
          source: { type: "literal", value: 0.32 },
        },
      ],
      responseFields: [],
      schemaVersion: 2,
    };

    const blueprint = composedEditorModelToQuestionBlueprintDocument(model);
    expect(blueprint.blocks[0]).toEqual({
      content: {
        content: [
          {
            attrs: { level: 1 },
            content: [{ text: "Revenue {{ .revenue }}", type: "text" }],
            type: "heading",
          },
          {
            attrs: { level: 2 },
            content: [{ text: "Margin {{ .margin }}", type: "text" }],
            type: "heading",
          },
        ],
        type: "doc",
      },
      id: "rich_1",
      kind: "primitive",
      type: "rich_text",
    });
    expect(questionBlueprintDocumentToComposedEditorModel(blueprint)).toEqual(
      model,
    );
  });

  it("validates manually-constructed rich text reference nodes", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: {
            content: [
              {
                content: [{ referenceId: "revenue", type: "reference" }],
                type: "paragraph",
              },
            ],
            type: "doc",
          },
          id: "rich_1",
          type: "rich_text",
        },
      ],
      references: [
        {
          id: "revenue",
          source: { type: "literal", value: 123 },
        },
      ],
      responseFields: [],
      schemaVersion: 2,
    };

    expect(() => validateComposedEditorModel(model)).not.toThrow();
  });
});

describe("table blueprint conversions", () => {
  it("round-trips every ordered primitive in a composed table cell", () => {
    const table = createTableBlock("table_1", {
      blockId: "table_1",
      cells: [
        {
          blocks: [
            {
              content: [{ text: "Before", type: "text" }],
              id: "cell_text_1",
              type: "text",
            },
            {
              grading: { mode: "manual" },
              id: "cell_input_1",
              input: { type: "text" },
              points: 1,
              responseFieldId: "answer_1",
              type: "input",
            },
            {
              content: [{ text: "After", type: "text" }],
              id: "cell_text_2",
              type: "text",
            },
            {
              content: richContentFromInlineContent([
                { text: "Rich", type: "text" },
              ]),
              id: "cell_rich_text_1",
              type: "rich_text",
            },
            { id: "cell_separator_1", type: "separator" },
          ],
          columnId: "column_1",
          id: "cell_1",
          rowId: "row_1",
        },
      ],
      columns: [{ id: "column_1", label: "Column" }],
      prompt: "",
      responseFields: [{ id: "answer_1", type: "text" }],
      rows: [{ id: "row_1", label: "Row" }],
      showColumnNames: true,
      showRowNames: true,
    });
    const model: ComposedEditorModel = {
      blocks: [table],
      references: [],
      responseFields: [],
      schemaVersion: 2,
    };

    const roundTripped = questionBlueprintDocumentToComposedEditorModel(
      composedEditorModelToQuestionBlueprintDocument(model),
    );
    const roundTrippedTable = roundTripped.blocks[0];
    expect(
      roundTrippedTable?.type === "table"
        ? roundTrippedTable.table.cells[0]?.blocks
        : null,
    ).toEqual(table.table.cells[0]?.blocks);
  });

  it("keeps literal table content inline", () => {
    const model: TableEditorModel = {
      cells: [
        createTextTableCell({
          blockId: "cell_1_text",
          columnId: "column_1",
          content: [{ text: "Alpha", type: "text" }],
          id: "cell_1",
          rowId: "row_1",
        }),
        createInputTableCell({
          blockId: "cell_2_input",
          columnId: "column_2",
          correctValueSource: { type: "literal", value: 3 },
          grading: { mode: "exact" },
          id: "cell_2",
          input: {
            type: "number",
            validation: { required: true },
          },
          points: 2,
          responseFieldId: "answer_1",
          rowId: "row_1",
        }),
      ],
      columns: [
        { id: "column_1", label: "Column 1" },
        { id: "column_2", label: "Column 2" },
      ],
      prompt: "Prompt",
      responseFields: [
        {
          id: "answer_1",
          label: "Answer",
          type: "number",
        },
      ],
      rows: [{ id: "row_1", label: "Row 1" }],
      showColumnNames: true,
      showRowNames: true,
    };

    const blueprint = tableEditorModelToQuestionBlueprintDocument(model);
    expect(blueprint.blocks[0]).toEqual({
      content: [{ text: "Prompt", type: "text" }],
      id: "prompt",
      kind: "primitive",
      type: "text",
    });

    expect(blueprint.references).toEqual([]);

    const tableBlock = blueprint.blocks.find((block) => block.type === "table");
    expect(tableBlock).toBeDefined();
    if (tableBlock?.type !== "table") {
      throw new Error("Expected table block.");
    }
    const contentCell = tableBlock.cells.find(
      (cell: (typeof tableBlock.cells)[number]) => cell.id === "cell_1",
    );
    const responseCell = tableBlock.cells.find(
      (cell: (typeof tableBlock.cells)[number]) => cell.id === "cell_2",
    );
    expect(contentCell).toEqual({
      blocks: [
        {
          content: [{ text: "Alpha", type: "text" }],
          id: "cell_1_text",
          kind: "primitive",
          type: "text",
        },
      ],
      columnId: "column_1",
      id: "cell_1",
      rowId: "row_1",
    });
    expect(responseCell).toEqual({
      blocks: [
        {
          correctValueSource: { schemaVersion: 1, type: "literal", value: 3 },
          grading: { mode: "exact" },
          id: "cell_2_input",
          input: {
            schemaVersion: 1,
            type: "number",
            validation: {
              required: true,
            },
          },
          kind: "primitive",
          points: 2,
          responseFieldId: "answer_1",
          type: "input",
        },
      ],
      columnId: "column_2",
      id: "cell_2",
      rowId: "row_1",
    });
  });

  it("maps rendered table bodies to preview cells with text", () => {
    const preview = questionBodyToTableBlockPreviewModel({
      blocks: [
        {
          content: [{ text: "Prompt", type: "text" }],
          id: "prompt",
          kind: "primitive",
          type: "text",
        },
        {
          cells: [
            {
              blocks: [
                {
                  content: [{ text: "A1", type: "text" }],
                  id: "cell_1_text",
                  kind: "primitive",
                  type: "text",
                },
              ],
              columnId: "column_1",
              id: "cell_1",
              rowId: "row_1",
            },
            {
              blocks: [
                {
                  id: "cell_2_input",
                  input: {
                    schemaVersion: 1,
                    type: "text",
                  },
                  kind: "primitive",
                  responseFieldId: "answer_1",
                  type: "input",
                },
              ],
              columnId: "column_2",
              id: "cell_2",
              rowId: "row_1",
            },
          ],
          columns: [
            { id: "column_1", label: "Column 1" },
            { id: "column_2", label: "Column 2" },
          ],
          id: "table",
          kind: "complex",
          rows: [{ id: "row_1", label: "Row 1" }],
          showColumnNames: true,
          showRowNames: true,
          type: "table",
        },
      ],
      responseFields: [
        {
          id: "answer_1",
          label: "Answer",
          required: true,
          type: "number",
        },
      ],
      schemaVersion: QuestionBodySchemaVersion.NUMBER_2,
    });

    expect(preview.prompt).toBe("Prompt");
    expect(preview.cells).toEqual([
      {
        blocks: [
          {
            content: [{ text: "A1", type: "text" }],
            id: "cell_1_text",
            type: "text",
          },
        ],
        columnId: "column_1",
        id: "cell_1",
        rowId: "row_1",
      },
      {
        blocks: [
          {
            id: "cell_2_input",
            inputState: {
              input: {
                type: "text",
                validation: {
                  required: true,
                },
              },
              status: "materialized",
            },
            label: undefined,
            placeholder: undefined,
            responseFieldId: "answer_1",
            type: "input",
          },
        ],
        columnId: "column_2",
        id: "cell_2",
        rowId: "row_1",
      },
    ]);
  });

  it("renders inline display values in the prompt preview", () => {
    const preview = questionBodyToTableBlockPreviewModel({
      blocks: [
        {
          content: [
            { text: "Revenue: ", type: "text" },
            {
              displayValue: "123",
              referenceId: "revenue",
              type: "value",
            },
          ],
          id: "table_prompt",
          kind: "primitive",
          type: "text",
        },
        {
          cells: [
            {
              blocks: [
                {
                  content: [{ text: "A1", type: "text" }],
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
          columns: [{ id: "column_1", label: "Column 1" }],
          id: "table",
          kind: "complex",
          rows: [{ id: "row_1", label: "Row 1" }],
          showColumnNames: true,
          showRowNames: true,
          type: "table",
        },
      ],
      responseFields: [],
      schemaVersion: QuestionBodySchemaVersion.NUMBER_2,
    });

    expect(preview.prompt).toBe("Revenue: 123");
  });

  it("maps same-list composed table prompt ids to preview prompt text", () => {
    const preview = questionBodyToTableBlockPreviewModel({
      blocks: [
        {
          content: [{ text: "Composed prompt", type: "text" }],
          id: "table_1_prompt",
          kind: "primitive",
          type: "text",
        },
        {
          cells: [
            {
              blocks: [
                {
                  content: [{ text: "A1", type: "text" }],
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
          columns: [{ id: "column_1", label: "Column 1" }],
          id: "table_1",
          kind: "complex",
          rows: [{ id: "row_1", label: "Row 1" }],
          showColumnNames: true,
          showRowNames: true,
          type: "table",
        },
      ],
      responseFields: [],
      schemaVersion: QuestionBodySchemaVersion.NUMBER_2,
    });

    expect(preview.prompt).toBe("Composed prompt");
  });

  it("maps nested rendered table bodies with same-list prompt convention", () => {
    const preview = questionBodyToTableBlockPreviewModel({
      blocks: [
        {
          blocks: [
            {
              blocks: [
                {
                  content: [{ text: "Nested prompt", type: "text" }],
                  id: "table_1_prompt",
                  kind: "primitive",
                  type: "text",
                },
                {
                  cells: [
                    {
                      blocks: [
                        {
                          content: [{ text: "A1", type: "text" }],
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
                  columns: [{ id: "column_1", label: "Column 1" }],
                  id: "table_1",
                  kind: "complex",
                  rows: [{ id: "row_1", label: "Row 1" }],
                  showColumnNames: true,
                  showRowNames: true,
                  type: "table",
                },
              ],
              id: "step_1",
              kind: "container",
              title: "Step",
              type: "step",
            },
          ],
          id: "page_1",
          kind: "container",
          title: "Page",
          type: "page",
        },
      ],
      responseFields: [],
      schemaVersion: QuestionBodySchemaVersion.NUMBER_2,
    });

    expect(preview.prompt).toBe("Nested prompt");
    expect(preview.cells[0]?.blocks[0]).toMatchObject({
      id: "cell_1_text",
      type: "text",
    });
  });

  it("does not use unrelated top-level prompt text for a nested table", () => {
    const preview = questionBodyToTableBlockPreviewModel({
      blocks: [
        {
          content: [{ text: "Unrelated", type: "text" }],
          id: "prompt",
          kind: "primitive",
          type: "text",
        },
        {
          blocks: [
            {
              cells: [
                {
                  blocks: [
                    {
                      content: [{ text: "A1", type: "text" }],
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
              columns: [{ id: "column_1", label: "Column 1" }],
              id: "table",
              kind: "complex",
              rows: [{ id: "row_1", label: "Row 1" }],
              showColumnNames: true,
              showRowNames: true,
              type: "table",
            },
          ],
          id: "page_1",
          kind: "container",
          type: "page",
        },
      ],
      responseFields: [],
      schemaVersion: QuestionBodySchemaVersion.NUMBER_2,
    });

    expect(preview.prompt).toBe("");
  });

  it("does not use a prompt text block that is not adjacent to the table", () => {
    const preview = questionBodyToTableBlockPreviewModel({
      blocks: [
        {
          content: [{ text: "Non-adjacent prompt", type: "text" }],
          id: "table_1_prompt",
          kind: "primitive",
          type: "text",
        },
        {
          id: "separator_1",
          kind: "primitive",
          type: "separator",
        },
        {
          cells: [
            {
              blocks: [
                {
                  content: [{ text: "A1", type: "text" }],
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
          columns: [{ id: "column_1", label: "Column 1" }],
          id: "table_1",
          kind: "complex",
          rows: [{ id: "row_1", label: "Row 1" }],
          showColumnNames: true,
          showRowNames: true,
          type: "table",
        },
      ],
      responseFields: [],
      schemaVersion: QuestionBodySchemaVersion.NUMBER_2,
    });

    expect(preview.prompt).toBe("");
  });
});

describe("table blueprint response fields", () => {
  it("preserves response field metadata when loading and saving", () => {
    const blueprint: QuestionBlueprintDocument = {
      blocks: [
        {
          content: [{ text: "Prompt", type: "text" }],
          id: "prompt",
          kind: "primitive",
          type: "text",
        },
        {
          cells: [
            {
              blocks: [
                {
                  correctValueSource: {
                    schemaVersion: 1,
                    type: "literal",
                    value: "001",
                  },
                  grading: { mode: "exact" },
                  id: "cell_1_input",
                  input: {
                    schemaVersion: 1,
                    type: "text",
                  },
                  kind: "primitive",
                  points: 2,
                  responseFieldId: "answer_1",
                  type: "input",
                },
              ],
              columnId: "column_1",
              id: "cell_1",
              rowId: "row_1",
            },
          ],
          columns: [{ id: "column_1", label: "Column 1" }],
          id: "table",
          kind: "complex",
          rows: [{ id: "row_1", label: "Row 1" }],
          showColumnNames: true,
          showRowNames: true,
          type: "table",
        },
      ],
      references: [],
      responseFields: [
        {
          id: "answer_1",
          label: "Student answer",
          required: false,
          type: "text",
        },
      ],
      schemaVersion: 2,
    };

    const model = questionBlueprintDocumentToTableEditorModel(blueprint);

    expect(model.responseFields).toEqual([
      {
        id: "answer_1",
        label: "Student answer",
        type: "text",
      },
    ]);
    expect(model.cells[0]?.blocks[0]).toMatchObject({
      input: { validation: { required: false } },
    });
    expect(
      tableEditorModelToQuestionBlueprintDocument(model).responseFields,
    ).toEqual(blueprint.responseFields);
  });

  it("preserves response field types when saving table models", () => {
    const model: TableEditorModel = {
      cells: [
        createInputTableCell({
          blockId: "cell_1_input",
          columnId: "column_1",
          correctValueSource: { type: "literal", value: 3 },
          grading: { mode: "exact" },
          id: "cell_1",
          points: 1,
          responseFieldId: "answer_1",
          rowId: "row_1",
        }),
      ],
      columns: [{ id: "column_1", label: "Column 1" }],
      prompt: "Prompt",
      responseFields: [
        {
          id: "answer_1",
          label: "Amount",
          type: "number",
        },
      ],
      rows: [{ id: "row_1", label: "Row 1" }],
      showColumnNames: true,
      showRowNames: true,
    };

    expect(
      tableEditorModelToQuestionBlueprintDocument(model).responseFields,
    ).toEqual([
      {
        id: "answer_1",
        label: "Amount",
        type: "number",
      },
    ]);
  });

  it("rejects saved blueprints with unsupported json response fields", () => {
    const blueprint = {
      blocks: [],
      references: [],
      responseFields: [
        {
          id: "answer_1",
          label: "Payload",
          required: false,
          type: "json",
        },
      ],
      schemaVersion: 2,
    };

    expect(() =>
      // @ts-expect-error invalid persisted response field fixture
      questionBlueprintDocumentToComposedEditorModel(blueprint),
    ).toThrow("Unsupported response field type: json");
  });

  it("rejects reference-backed content cells in standalone table conversion", () => {
    const model = createModelWithResponseFields([]);
    model.cells = [
      createTextTableCell({
        blockId: "cell_1_text",
        columnId: "column_1",
        content: [{ referenceId: "content_ref", type: "reference" }],
        id: "cell_1",
        rowId: "row_1",
      }),
    ];

    expect(() => tableEditorModelToQuestionBlueprintDocument(model)).toThrow(
      "Standalone table text block cell_1_text references a reference",
    );
  });

  it("rejects reference-backed answer cells in standalone table conversion", () => {
    const model = createModelWithResponseFields([
      { id: "answer_1", type: "number" },
    ]);

    model.cells = [
      createInputTableCell({
        blockId: "cell_1_input",
        columnId: "column_1",
        correctValueSource: { referenceId: "answer_ref", type: "reference" },
        grading: { mode: "exact" },
        id: "cell_1",
        points: 1,
        responseFieldId: "answer_1",
        rowId: "row_1",
      }),
    ];

    expect(() => tableEditorModelToQuestionBlueprintDocument(model)).toThrow(
      "Standalone table input block cell_1_input references answer_ref",
    );
  });

  it("throws when an input primitive references a missing response field", () => {
    const model = createModelWithResponseFields([]);

    expect(() => tableEditorModelToQuestionBlueprintDocument(model)).toThrow(
      "Input block cell_1_input in cell cell_1 references missing response field answer_1.",
    );
  });

  it("throws on duplicate response field IDs", () => {
    const model = createModelWithResponseFields([
      {
        id: "answer_1",
        type: "number",
      },
      {
        id: "answer_1",
        type: "text",
      },
    ]);

    expect(() => tableEditorModelToQuestionBlueprintDocument(model)).toThrow(
      "Response field id answer_1 is duplicated.",
    );
  });

  it("throws on empty response field IDs", () => {
    const model = createModelWithResponseFields([
      {
        id: "",
        type: "number",
      },
    ]);

    expect(() => tableEditorModelToQuestionBlueprintDocument(model)).toThrow(
      "Response field id must not be empty.",
    );
  });
});

describe("table blueprint composed namespacing", () => {
  it("namespaces table answer fields by table block id", () => {
    const model: ComposedEditorModel = {
      ...createDefaultComposedEditorModel(),
      blocks: [
        {
          id: "table_1",
          table: {
            cells: [
              createInputTableCell({
                blockId: "table_1_cell_1_input",
                columnId: "column_1",
                correctValueSource: { type: "literal", value: 3 },
                grading: { mode: "exact" },
                id: "cell_1",
                input: {
                  type: "number",
                  validation: { required: true },
                },
                points: 1,
                responseFieldId: "answer_1",
                rowId: "row_1",
              }),
            ],
            columns: [{ id: "column_1", label: "Column 1" }],
            prompt: "Prompt",
            responseFields: [
              {
                id: "answer_1",
                label: "Answer",
                type: "number",
              },
            ],
            rows: [{ id: "row_1", label: "Row 1" }],
            showColumnNames: true,
            showRowNames: true,
          },
          type: "table",
        },
        {
          id: "table_2",
          table: {
            cells: [
              createInputTableCell({
                blockId: "table_2_cell_1_input",
                columnId: "column_1",
                correctValueSource: { type: "literal", value: 4 },
                grading: { mode: "exact" },
                id: "cell_1",
                points: 1,
                responseFieldId: "answer_1",
                rowId: "row_1",
              }),
            ],
            columns: [{ id: "column_1", label: "Column 1" }],
            prompt: "Prompt",
            responseFields: [
              {
                id: "answer_1",
                label: "Answer",
                type: "number",
              },
            ],
            rows: [{ id: "row_1", label: "Row 1" }],
            showColumnNames: true,
            showRowNames: true,
          },
          type: "table",
        },
      ],
      references: [],
      responseFields: [],
    };

    const blueprint = composedEditorModelToQuestionBlueprintDocument(model);

    expect(blueprint.responseFields.map((field) => field.id)).toEqual([
      "table_1_answer_1",
      "table_2_answer_1",
    ]);
    const tableBlocks = blueprint.blocks.filter(
      (block) => block.type === "table",
    );
    expect(tableBlocks).toHaveLength(2);
    expect(tableBlocks[0]).toMatchObject({
      cells: [
        {
          blocks: [
            expect.objectContaining({
              responseFieldId: "table_1_answer_1",
            }),
          ],
        },
      ],
      id: "table_1",
    });
    expect(tableBlocks[1]).toMatchObject({
      cells: [
        {
          blocks: [
            expect.objectContaining({
              responseFieldId: "table_2_answer_1",
            }),
          ],
        },
      ],
      id: "table_2",
    });
  });

  it("round-trips namespaced table answer fields back to local ids", () => {
    const model: ComposedEditorModel = {
      ...createDefaultComposedEditorModel(),
      blocks: [
        {
          id: "table_1",
          table: {
            blockId: "table_1",
            cells: [
              createInputTableCell({
                blockId: "table_1_cell_1_input",
                columnId: "column_1",
                correctValueSource: { type: "literal", value: 3 },
                grading: { mode: "exact" },
                id: "cell_1",
                input: {
                  type: "number",
                  validation: { required: true },
                },
                points: 1,
                responseFieldId: "answer_1",
                rowId: "row_1",
              }),
            ],
            columns: [{ id: "column_1", label: "Column 1" }],
            prompt: "Prompt",
            responseFields: [
              {
                id: "answer_1",
                label: "Answer",
                type: "number",
              },
            ],
            rows: [{ id: "row_1", label: "Row 1" }],
            showColumnNames: true,
            showRowNames: true,
          },
          type: "table",
        },
      ],
      references: [],
      responseFields: [],
    };

    const blueprint = composedEditorModelToQuestionBlueprintDocument(model);
    expect(questionBlueprintDocumentToComposedEditorModel(blueprint)).toEqual(
      model,
    );
  });
});

function createModelWithResponseFields(
  responseFields: TableEditorModel["responseFields"],
): TableEditorModel {
  return {
    cells: [
      {
        blocks: [
          {
            correctValueSource: { type: "literal", value: 3 },
            grading: { mode: "exact" },
            id: "cell_1_input",
            points: 1,
            responseFieldId: "answer_1",
            type: "input",
          },
        ],
        columnId: "column_1",
        id: "cell_1",
        rowId: "row_1",
      },
    ],
    columns: [{ id: "column_1", label: "Column 1" }],
    prompt: "Prompt",
    responseFields,
    rows: [{ id: "row_1", label: "Row 1" }],
    showColumnNames: true,
    showRowNames: true,
  };
}

function createTextTableCell(input: {
  blockId: string;
  columnId: string;
  content: ComposedInlineContent[];
  id: string;
  rowId: string;
}): TableEditorCell {
  return {
    blocks: [{ content: input.content, id: input.blockId, type: "text" }],
    columnId: input.columnId,
    id: input.id,
    rowId: input.rowId,
  };
}

function createInputTableCell(
  input: Omit<TableEditorInputBlock, "id" | "type"> & {
    blockId: string;
    columnId: string;
    id: string;
    rowId: string;
  },
): TableEditorCell {
  return {
    blocks: [
      {
        correctValueSource: input.correctValueSource,
        grading: input.grading,
        id: input.blockId,
        ...(input.input ? { input: input.input } : {}),
        ...(input.label ? { label: input.label } : {}),
        ...(input.placeholder ? { placeholder: input.placeholder } : {}),
        points: input.points,
        responseFieldId: input.responseFieldId,
        type: "input",
      },
    ],
    columnId: input.columnId,
    id: input.id,
    rowId: input.rowId,
  };
}
