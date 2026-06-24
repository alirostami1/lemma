import { describe, expect, it } from "vitest";
import type { QuestionBlueprintDocument } from "#/api/generated/model";
import { QuestionBodySchemaVersion } from "#/api/generated/model/questionBodySchemaVersion";
import type { TableEditorModel } from "#/domains/questions/authoring";
import {
  type ComposedEditorModel,
  coerceAnswerValue,
  coerceLiteralExpressionValue,
  createDefaultComposedEditorModel,
  createTableBlock,
  createTableFromWorkbookRangeReference,
  extractUsedReferenceIdsFromComposedEditorModel,
  extractWorkbookReferenceRefsFromComposedEditorModel,
  nextAvailableResponseFieldId,
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
    expect(coerceAnswerValue("true", { id: "bool", type: "boolean" })).toBe(
      true,
    );
    expect(coerceAnswerValue("false", { id: "bool", type: "boolean" })).toBe(
      false,
    );
  });

  it("coerces authored literal response values by response field type", () => {
    expect(
      coerceLiteralExpressionValue("001", { id: "text", type: "text" }),
    ).toBe("001");
    expect(
      coerceLiteralExpressionValue("1.0", { id: "number", type: "number" }),
    ).toBe(1);
    expect(
      coerceLiteralExpressionValue("false", { id: "bool", type: "boolean" }),
    ).toBe(false);
    expect(coerceLiteralExpressionValue("1.0")).toBe(1);
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

  it("creates range-backed table cells without generated cell references", () => {
    const currentModel: TableEditorModel = {
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
      existingReferenceIds: ["range"],
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
        columnId: "column_1",
        content: [
          {
            fallbackText: "A1",
            rangeCell: { columnOffset: 0, rowOffset: 0 },
            referenceId: "range",
            type: "reference",
          },
        ],
        id: "cell_1_1",
        rowId: "row_1",
        type: "content",
      },
      {
        columnId: "column_2",
        content: [
          {
            fallbackText: "B1",
            rangeCell: { columnOffset: 1, rowOffset: 0 },
            referenceId: "range",
            type: "reference",
          },
        ],
        id: "cell_1_2",
        rowId: "row_1",
        type: "content",
      },
      {
        columnId: "column_1",
        content: [
          {
            fallbackText: "A2",
            rangeCell: { columnOffset: 0, rowOffset: 1 },
            referenceId: "range",
            type: "reference",
          },
        ],
        id: "cell_2_1",
        rowId: "row_2",
        type: "content",
      },
      {
        columnId: "column_2",
        content: [
          {
            fallbackText: "B2",
            rangeCell: { columnOffset: 1, rowOffset: 1 },
            referenceId: "range",
            type: "reference",
          },
        ],
        id: "cell_2_2",
        rowId: "row_2",
        type: "content",
      },
    ]);
  });

  it("creates canonical blocks for text and response blocks", () => {
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
          required: true,
          type: "number",
        },
      ],
      schemaVersion: 1,
    };

    expect(composedEditorModelToQuestionBlueprintDocument(model)).toEqual({
      blocks: [
        {
          content: [{ text: "What is 2 + 2?", type: "text" }],
          id: "text_1",
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
          source: { schemaVersion: 1, type: "literal", value: 4 },
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
    };

    expect(extractUsedReferenceIdsFromComposedEditorModel(model)).toEqual([]);
    expect(extractWorkbookReferenceRefsFromComposedEditorModel(model)).toEqual(
      [],
    );
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
            {
              columnId: "column_1",
              content: [{ referenceId: "content_ref", type: "reference" }],
              id: "cell_1",
              rowId: "row_1",
              type: "content",
            },
            {
              columnId: "column_1",
              correctValueSource: {
                referenceId: "answer_ref",
                type: "reference",
              },
              grading: { mode: "exact" },
              id: "cell_2",
              points: 2,
              responseFieldId: "answer_1",
              rowId: "row_1",
              type: "response",
            },
          ],
          columns: [{ id: "column_1", label: "Column 1" }],
          prompt: "",
          responseFields: [
            {
              id: "answer_1",
              label: "Answer",
              required: true,
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
      schemaVersion: 1,
    };

    const blueprint = composedEditorModelToQuestionBlueprintDocument(model);
    expect(questionBlueprintDocumentToComposedEditorModel(blueprint)).toEqual(
      model,
    );
  });

  it("collects workbook refs from standalone response blocks", () => {
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
      schemaVersion: 1,
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
            {
              columnId: "column_1",
              content: [{ referenceId: "table_source", type: "reference" }],
              id: "cell_1",
              rowId: "row_1",
              type: "content",
            },
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
            {
              columnId: "column_1",
              content: [{ referenceId: "missing", type: "reference" }],
              id: "cell_1",
              rowId: "row_1",
              type: "content",
            },
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
      schemaVersion: 1,
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
            {
              columnId: "column_1",
              correctValueSource: { referenceId: "missing", type: "reference" },
              grading: { mode: "exact" },
              id: "cell_1",
              points: 1,
              responseFieldId: "answer_1",
              rowId: "row_1",
              type: "response",
            },
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
            cells: [
              {
                columnId: "column_1",
                correctValueSource: { type: "literal", value: 1 },
                grading: { mode: "exact" },
                id: "cell_1",
                points: 1,
                responseFieldId: "answer_1",
                rowId: "row_1",
                type: "response",
              },
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
      schemaVersion: 1,
    };

    expect(nextAvailableResponseFieldId(model)).toBe("answer_2");
  });

  it("preserves table conversion inside composed documents", () => {
    const tableModel: TableEditorModel = {
      cells: [
        {
          columnId: "column_1",
          content: [{ text: "Alpha", type: "text" }],
          id: "cell_1",
          rowId: "row_1",
          type: "content",
        },
        {
          columnId: "column_2",
          correctValueSource: { type: "literal", value: 3 },
          grading: { mode: "exact" },
          id: "cell_2",
          points: 2,
          responseFieldId: "answer_1",
          rowId: "row_1",
          type: "response",
        },
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
          required: true,
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
      schemaVersion: 1,
    };

    const blueprint = composedEditorModelToQuestionBlueprintDocument(model);
    expect(blueprint.blocks).toHaveLength(3);
    expect(blueprint.blocks[1]).toMatchObject({
      content: [{ text: "Ignored in composed mode", type: "text" }],
      id: "table_1_prompt",
      type: "text",
    });
    expect(blueprint.blocks[2]).toMatchObject({
      id: "table_1",
      type: "table",
    });
    const tableBlock = blueprint.blocks[2];
    if (tableBlock.type !== "table") {
      throw new Error("Expected table block.");
    }
    expect(tableBlock.cells).toEqual([
      {
        columnId: "column_1",
        content: [{ text: "Alpha", type: "text" }],
        id: "cell_1",
        rowId: "row_1",
        type: "content",
      },
      {
        columnId: "column_2",
        correctValueSource: { schemaVersion: 1, type: "literal", value: 3 },
        grading: { mode: "exact" },
        id: "cell_2",
        points: 2,
        responseFieldId: "table_1_answer_1",
        rowId: "row_1",
        type: "response",
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

  it("loads canonical text and response blocks back into the composed model", () => {
    const blueprint: QuestionBlueprintDocument = {
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
          correctValueSource: {
            schemaVersion: 1,
            type: "literal",
            value: "42",
          },
          grading: { mode: "exact" },
          id: "response_1",
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
          required: true,
          type: "text",
        },
      ],
      schemaVersion: 1,
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
          required: true,
          type: "text",
        },
      ],
      schemaVersion: 1,
    });
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
    };

    expect(() => validateComposedEditorModel(model)).not.toThrow();
  });
});

describe("table blueprint conversions", () => {
  it("keeps literal table content inline", () => {
    const model: TableEditorModel = {
      cells: [
        {
          columnId: "column_1",
          content: [{ text: "Alpha", type: "text" }],
          id: "cell_1",
          rowId: "row_1",
          type: "content",
        },
        {
          columnId: "column_2",
          correctValueSource: { type: "literal", value: 3 },
          grading: { mode: "exact" },
          id: "cell_2",
          points: 2,
          responseFieldId: "answer_1",
          rowId: "row_1",
          type: "response",
        },
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
          required: true,
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
      columnId: "column_1",
      content: [{ text: "Alpha", type: "text" }],
      id: "cell_1",
      rowId: "row_1",
      type: "content",
    });
    expect(responseCell).toEqual({
      columnId: "column_2",
      correctValueSource: { schemaVersion: 1, type: "literal", value: 3 },
      grading: { mode: "exact" },
      id: "cell_2",
      points: 2,
      responseFieldId: "answer_1",
      rowId: "row_1",
      type: "response",
    });
  });

  it("maps rendered table bodies to preview cells with text", () => {
    const preview = questionBodyToTableBlockPreviewModel({
      blocks: [
        {
          content: [{ text: "Prompt", type: "text" }],
          id: "prompt",
          type: "text",
        },
        {
          cells: [
            {
              columnId: "column_1",
              id: "cell_1",
              rowId: "row_1",
              text: "A1",
              type: "content",
            },
            {
              columnId: "column_2",
              id: "cell_2",
              responseFieldId: "answer_1",
              rowId: "row_1",
              type: "response",
            },
          ],
          columns: [
            { id: "column_1", label: "Column 1" },
            { id: "column_2", label: "Column 2" },
          ],
          id: "table",
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
      schemaVersion: QuestionBodySchemaVersion.NUMBER_1,
    });

    expect(preview.cells).toEqual([
      {
        columnId: "column_1",
        content: [{ text: "A1", type: "text" }],
        id: "cell_1",
        rowId: "row_1",
        type: "content",
      },
      {
        columnId: "column_2",
        id: "cell_2",
        responseFieldId: "answer_1",
        rowId: "row_1",
        type: "response",
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
          id: "prompt",
          type: "text",
        },
        {
          cells: [
            {
              columnId: "column_1",
              id: "cell_1",
              rowId: "row_1",
              text: "A1",
              type: "content",
            },
          ],
          columns: [{ id: "column_1", label: "Column 1" }],
          id: "table",
          rows: [{ id: "row_1", label: "Row 1" }],
          showColumnNames: true,
          showRowNames: true,
          type: "table",
        },
      ],
      responseFields: [],
      schemaVersion: QuestionBodySchemaVersion.NUMBER_1,
    });

    expect(preview.prompt).toBe("Revenue: 123");
  });
});

describe("table blueprint response fields", () => {
  it("preserves response field metadata when loading and saving", () => {
    const blueprint: QuestionBlueprintDocument = {
      blocks: [
        {
          content: [{ text: "Prompt", type: "text" }],
          id: "prompt",
          type: "text",
        },
        {
          cells: [
            {
              columnId: "column_1",
              correctValueSource: {
                schemaVersion: 1,
                type: "literal",
                value: "001",
              },
              grading: { mode: "exact" },
              id: "cell_1",
              points: 2,
              responseFieldId: "answer_1",
              rowId: "row_1",
              type: "response",
            },
          ],
          columns: [{ id: "column_1", label: "Column 1" }],
          id: "table",
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
      schemaVersion: 1,
    };

    const model = questionBlueprintDocumentToTableEditorModel(blueprint);

    expect(model.responseFields).toEqual(blueprint.responseFields);
    expect(
      tableEditorModelToQuestionBlueprintDocument(model).responseFields,
    ).toEqual(blueprint.responseFields);
  });

  it("preserves response field types when saving table models", () => {
    const model: TableEditorModel = {
      cells: [
        {
          columnId: "column_1",
          correctValueSource: { type: "literal", value: 3 },
          grading: { mode: "exact" },
          id: "cell_1",
          points: 1,
          responseFieldId: "answer_1",
          rowId: "row_1",
          type: "response",
        },
      ],
      columns: [{ id: "column_1", label: "Column 1" }],
      prompt: "Prompt",
      responseFields: [
        {
          id: "answer_1",
          label: "Amount",
          required: true,
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
        required: true,
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
      schemaVersion: 1,
    };

    expect(() =>
      // @ts-expect-error invalid persisted response field fixture
      questionBlueprintDocumentToComposedEditorModel(blueprint),
    ).toThrow("Unsupported response field type: json");
  });

  it("rejects reference-backed content cells in standalone table conversion", () => {
    const model = createModelWithResponseFields([]);
    model.cells = [
      {
        columnId: "column_1",
        content: [{ referenceId: "content_ref", type: "reference" }],
        id: "cell_1",
        rowId: "row_1",
        type: "content",
      },
    ];

    expect(() => tableEditorModelToQuestionBlueprintDocument(model)).toThrow(
      "Standalone table content cell cell_1 references a reference",
    );
  });

  it("rejects reference-backed answer cells in standalone table conversion", () => {
    const model = createModelWithResponseFields([
      { id: "answer_1", type: "number" },
    ]);

    model.cells = [
      {
        columnId: "column_1",
        correctValueSource: { referenceId: "answer_ref", type: "reference" },
        grading: { mode: "exact" },
        id: "cell_1",
        points: 1,
        responseFieldId: "answer_1",
        rowId: "row_1",
        type: "response",
      },
    ];

    expect(() => tableEditorModelToQuestionBlueprintDocument(model)).toThrow(
      "Standalone table answer cell cell_1 references answer_ref",
    );
  });

  it("throws when a response cell references a missing response field", () => {
    const model = createModelWithResponseFields([]);

    expect(() => tableEditorModelToQuestionBlueprintDocument(model)).toThrow(
      "Response cell cell_1 references missing response field answer_1.",
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
              {
                columnId: "column_1",
                correctValueSource: { type: "literal", value: 3 },
                grading: { mode: "exact" },
                id: "cell_1",
                points: 1,
                responseFieldId: "answer_1",
                rowId: "row_1",
                type: "response",
              },
            ],
            columns: [{ id: "column_1", label: "Column 1" }],
            prompt: "Prompt",
            responseFields: [
              {
                id: "answer_1",
                label: "Answer",
                required: true,
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
              {
                columnId: "column_1",
                correctValueSource: { type: "literal", value: 4 },
                grading: { mode: "exact" },
                id: "cell_1",
                points: 1,
                responseFieldId: "answer_1",
                rowId: "row_1",
                type: "response",
              },
            ],
            columns: [{ id: "column_1", label: "Column 1" }],
            prompt: "Prompt",
            responseFields: [
              {
                id: "answer_1",
                label: "Answer",
                required: true,
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
        expect.objectContaining({
          responseFieldId: "table_1_answer_1",
        }),
      ],
      id: "table_1",
    });
    expect(tableBlocks[1]).toMatchObject({
      cells: [
        expect.objectContaining({
          responseFieldId: "table_2_answer_1",
        }),
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
            cells: [
              {
                columnId: "column_1",
                correctValueSource: { type: "literal", value: 3 },
                grading: { mode: "exact" },
                id: "cell_1",
                points: 1,
                responseFieldId: "answer_1",
                rowId: "row_1",
                type: "response",
              },
            ],
            columns: [{ id: "column_1", label: "Column 1" }],
            prompt: "Prompt",
            responseFields: [
              {
                id: "answer_1",
                label: "Answer",
                required: true,
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
        columnId: "column_1",
        correctValueSource: { type: "literal", value: 3 },
        grading: { mode: "exact" },
        id: "cell_1",
        points: 1,
        responseFieldId: "answer_1",
        rowId: "row_1",
        type: "response",
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
