import { describe, expect, it } from "vitest";
import type { QuestionBlueprintDocument } from "#/api/generated/model";
import { QuestionBodySchemaVersion } from "#/api/generated/model/questionBodySchemaVersion";
import type { TableEditorModel } from "#/domains/questions/authoring";
import {
  type ComposedEditorModel,
  coerceAnswerValue,
  coerceLiteralExpressionValue,
  createDefaultComposedEditorModel,
  createTableFromWorkbookRangeReference,
  createTableBlock,
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
  questionBlueprintDocumentToComposedEditorModel,
  questionBlueprintDocumentToTableEditorModel,
  composedEditorModelToQuestionBlueprintDocument,
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
    ).toBe(
      "001",
    );
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
      schemaVersion: 1,
      responses: [
        {
          responseFieldId: "answer_1",
          value: { nested: ["x", 2, null] },
        },
      ],
    });
    expect(
      questionAnswerToTableAnswerState({
        schemaVersion: 1,
        responses: [
          {
            responseFieldId: "answer_1",
            value: { nested: ["x", 2, null] },
          },
        ],
      }),
    ).toEqual({ answer_1: { nested: ["x", 2, null] } });
  });
});

describe("question generation input mapping", () => {
  it("maps saved blueprint generation inputs with workbook sources", () => {
    expect(
      toCreateQuestionGenerationRunInput({
        count: 3,
        targetQuestionSetId: "question_set_1",
        sourceWorkbookId: "workbook_1",
        blueprintId: "blueprint_1",
      }),
    ).toEqual({
      count: 3,
      targetQuestionSetId: "question_set_1",
      blueprintId: "blueprint_1",
      sourceWorkbookId: "workbook_1",
    });
  });

  it("maps saved blueprint generation inputs without a workbook source", () => {
    expect(
      toCreateQuestionGenerationRunInput({
        count: 1,
        targetQuestionSetId: "question_set_1",
        sourceWorkbookId: null,
        blueprintId: "blueprint_1",
        blueprintVersionId: "blueprint_version_1",
      }),
    ).toEqual({
      count: 1,
      targetQuestionSetId: "question_set_1",
      blueprintId: "blueprint_1",
      blueprintVersionId: "blueprint_version_1",
      sourceWorkbookId: null,
    });
  });
});

describe("composed blueprint conversions", () => {
  it("parses inline references", () => {
    expect(parseInlineBlueprint("Revenue: {{ .revenue }}")).toEqual([
      { type: "text", text: "Revenue: " },
      { type: "reference", referenceId: "revenue" },
    ]);
  });

  it("parses range cell inline references", () => {
    expect(parseInlineBlueprint("Revenue: {{ .range[1,2] }}")).toEqual([
      { type: "text", text: "Revenue: " },
      {
        type: "reference",
        referenceId: "range",
        rangeCell: { rowOffset: 1, columnOffset: 2 },
      },
    ]);
  });

  it("formats inline references", () => {
    expect(
      formatInlineBlueprint([
        { type: "text", text: "Revenue: " },
        { type: "reference", referenceId: "revenue" },
      ]),
    ).toBe("Revenue: {{ .revenue }}");
  });

  it("formats range cell inline references", () => {
    expect(
      formatInlineBlueprint([
        { type: "text", text: "Revenue: " },
        {
          type: "reference",
          referenceId: "range",
          rangeCell: { rowOffset: 1, columnOffset: 2 },
        },
      ]),
    ).toBe("Revenue: {{ .range[1,2] }}");
  });

  it("creates range-backed table cells without generated cell references", () => {
    const currentModel: TableEditorModel = {
      prompt: "",
      columns: [],
      rows: [],
      showColumnNames: true,
      showRowNames: true,
      responseFields: [],
      cells: [],
    };

    const result = createTableFromWorkbookRangeReference({
      currentModel,
      rangeReference: {
        id: "range",
        source: { type: "workbook_range", ref: "Sheet1!A1:B2" },
      },
      values: [
        ["A1", "B1"],
        ["A2", "B2"],
      ],
      existingReferenceIds: ["range"],
    });

    expect(result.references).toEqual([]);
    expect(result.table.cells).toEqual([
      {
        id: "cell_1_1",
        rowId: "row_1",
        columnId: "column_1",
        type: "content",
        content: [
          {
            type: "reference",
            referenceId: "range",
            rangeCell: { rowOffset: 0, columnOffset: 0 },
            fallbackText: "A1",
          },
        ],
      },
      {
        id: "cell_1_2",
        rowId: "row_1",
        columnId: "column_2",
        type: "content",
        content: [
          {
            type: "reference",
            referenceId: "range",
            rangeCell: { rowOffset: 0, columnOffset: 1 },
            fallbackText: "B1",
          },
        ],
      },
      {
        id: "cell_2_1",
        rowId: "row_2",
        columnId: "column_1",
        type: "content",
        content: [
          {
            type: "reference",
            referenceId: "range",
            rangeCell: { rowOffset: 1, columnOffset: 0 },
            fallbackText: "A2",
          },
        ],
      },
      {
        id: "cell_2_2",
        rowId: "row_2",
        columnId: "column_2",
        type: "content",
        content: [
          {
            type: "reference",
            referenceId: "range",
            rangeCell: { rowOffset: 1, columnOffset: 1 },
            fallbackText: "B2",
          },
        ],
      },
    ]);
  });

  it("creates canonical blocks for text and response blocks", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "text", text: "What is 2 + 2?" }],
        },
        {
          id: "response_1",
          type: "response",
          responseFieldId: "answer_1",
          label: "Answer",
          placeholder: "Type a number",
          correctValueSource: { type: "reference", referenceId: "answer_source" },
          points: 2,
          grading: { mode: "exact" },
        },
      ],
      responseFields: [
        {
          id: "answer_1",
          type: "number",
          label: "Answer",
          required: true,
        },
      ],
      references: [
        {
          id: "answer_source",
          source: { type: "literal", value: 4 },
        },
      ],
    };

    expect(composedEditorModelToQuestionBlueprintDocument(model)).toEqual({
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "text", text: "What is 2 + 2?" }],
        },
        {
          id: "response_1",
          type: "response",
          responseFieldId: "answer_1",
          label: "Answer",
          placeholder: "Type a number",
          correctValueSource: {
            schemaVersion: 1,
            type: "reference",
            referenceId: "answer_source",
          },
          points: 2,
          grading: { mode: "exact" },
        },
      ],
      responseFields: [
        {
          id: "answer_1",
          type: "number",
          label: "Answer",
          required: true,
        },
      ],
      references: [
        {
          id: "answer_source",
          source: { schemaVersion: 1, type: "literal", value: 4 },
        },
      ],
    });
  });

  it("treats literal-only composed documents as static", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "text", text: "Static prompt" }],
        },
        {
          id: "response_1",
          type: "response",
          responseFieldId: "answer_1",
          correctValueSource: { type: "reference", referenceId: "answer_source" },
          points: 1,
          grading: { mode: "exact" },
        },
      ],
      responseFields: [
        {
          id: "answer_1",
          type: "text",
        },
      ],
      references: [
        {
          id: "answer_source",
          source: { type: "literal", value: "ok" },
        },
      ],
    };

    expect(extractWorkbookReferenceRefsFromComposedEditorModel(model)).toEqual([]);
  });

  it("keeps literal references static in canonical conversion", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [
            { type: "text", text: "Rate: " },
            { type: "reference", referenceId: "rate" },
          ],
        },
      ],
      responseFields: [],
      references: [
        {
          id: "rate",
          source: { type: "literal", value: 0.5 },
        },
      ],
    };

    const blueprint = composedEditorModelToQuestionBlueprintDocument(model);
    expect(blueprint.references).toEqual([
      {
        id: "rate",
        source: { schemaVersion: 1, type: "literal", value: 0.5 },
      },
    ]);
    expect(blueprint.blocks[0]).toEqual({
      id: "text_1",
      type: "text",
      content: [
        { type: "text", text: "Rate: " },
        { type: "reference", referenceId: "rate" },
      ],
    });
    expect(extractWorkbookReferenceRefsFromComposedEditorModel(model)).toEqual([]);
  });

  it("ignores unused workbook-backed references for workbook source detection", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "text", text: "Static prompt" }],
        },
      ],
      responseFields: [],
      references: [
        {
          id: "unused_ref",
          source: { type: "workbook_cell", ref: "'Sheet1'!A1" },
        },
      ],
    };

    expect(extractUsedReferenceIdsFromComposedEditorModel(model)).toEqual([]);
    expect(extractWorkbookReferenceRefsFromComposedEditorModel(model)).toEqual([]);
  });

  it("collects workbook refs from workbook-backed references", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "reference", referenceId: "revenue" }],
        },
      ],
      responseFields: [],
      references: [
        {
          id: "revenue",
          source: { type: "workbook_cell", ref: "'Sheet1'!A1" },
        },
      ],
    };

    expect(composedEditorModelToQuestionBlueprintDocument(model).references).toEqual([
      {
        id: "revenue",
        source: { schemaVersion: 1, type: "workbook_cell", ref: "'Sheet1'!A1" },
      },
    ]);
    expect(extractWorkbookReferenceRefsFromComposedEditorModel(model)).toEqual([
      "'Sheet1'!A1",
    ]);
  });

  it("keeps used literal references out of workbook source detection", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "reference", referenceId: "literal_ref" }],
        },
      ],
      responseFields: [],
      references: [
        {
          id: "literal_ref",
          source: { type: "literal", value: "Alpha" },
        },
      ],
    };

    expect(extractUsedReferenceIdsFromComposedEditorModel(model)).toEqual([
      "literal_ref",
    ]);
  expect(extractWorkbookReferenceRefsFromComposedEditorModel(model)).toEqual([]);
  });

  it("round-trips reference-backed table content and answer values", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        createTableBlock("table_1", {
          prompt: "",
          columns: [{ id: "column_1", label: "Column 1" }],
          rows: [{ id: "row_1", label: "Row 1" }],
          showColumnNames: true,
          showRowNames: true,
          responseFields: [
            {
              id: "answer_1",
              type: "number",
              label: "Answer",
              required: true,
            },
          ],
          cells: [
            {
              id: "cell_1",
              rowId: "row_1",
              columnId: "column_1",
              type: "content",
              content: [{ type: "reference", referenceId: "content_ref" }],
            },
            {
              id: "cell_2",
              rowId: "row_1",
              columnId: "column_1",
              type: "response",
              responseFieldId: "answer_1",
              correctValueSource: { type: "reference", referenceId: "answer_ref" },
              points: 2,
              grading: { mode: "exact" },
            },
          ],
        }),
      ],
      responseFields: [],
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
    };

    const blueprint = composedEditorModelToQuestionBlueprintDocument(model);
    expect(questionBlueprintDocumentToComposedEditorModel(blueprint)).toEqual(model);
  });

  it("collects workbook refs from standalone response blocks", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "response_1",
          type: "response",
          responseFieldId: "answer_1",
          correctValueSource: { type: "reference", referenceId: "answer_source" },
          points: 1,
          grading: { mode: "exact" },
        },
      ],
      responseFields: [
        {
          id: "answer_1",
          type: "number",
        },
      ],
      references: [
        {
          id: "answer_source",
          source: { type: "workbook_cell", ref: "'Sheet1'!B2" },
        },
      ],
    };

    expect(extractWorkbookReferenceRefsFromComposedEditorModel(model)).toEqual([
      "'Sheet1'!B2",
    ]);
  });

  it("collects workbook refs from table cell sources", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        createTableBlock("table_1", {
          prompt: "",
          columns: [{ id: "column_1", label: "Column 1" }],
          rows: [{ id: "row_1", label: "Row 1" }],
          showColumnNames: true,
          showRowNames: true,
          responseFields: [],
          cells: [
            {
              id: "cell_1",
              rowId: "row_1",
              columnId: "column_1",
              type: "content",
              content: [{ type: "reference", referenceId: "table_source" }],
            },
          ],
        }),
      ],
      responseFields: [],
      references: [
        {
          id: "table_source",
          source: { type: "workbook_range", ref: "'Sheet1'!A1:B2" },
        },
      ],
    };

    expect(extractWorkbookReferenceRefsFromComposedEditorModel(model)).toEqual([
      "'Sheet1'!A1:B2",
    ]);
  });

  it("rejects unknown references", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "reference", referenceId: "missing" }],
        },
      ],
      responseFields: [],
      references: [],
    };

    expect(() => validateComposedEditorModel(model)).toThrow(
      "Unknown reference: missing",
    );
  });

  it("rejects missing references in answer values", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "response_1",
          type: "response",
          responseFieldId: "answer_1",
          correctValueSource: { type: "reference", referenceId: "missing" },
          points: 1,
          grading: { mode: "exact" },
        },
      ],
      responseFields: [
        {
          id: "answer_1",
          type: "text",
        },
      ],
      references: [],
    };

    expect(() => validateComposedEditorModel(model)).toThrow(
      "Unknown reference: missing",
    );
  });

  it("rejects missing references in table content cells", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        createTableBlock("table_1", {
          prompt: "",
          columns: [{ id: "column_1", label: "Column 1" }],
          rows: [{ id: "row_1", label: "Row 1" }],
          showColumnNames: true,
          showRowNames: true,
          responseFields: [],
          cells: [
            {
              id: "cell_1",
              rowId: "row_1",
              columnId: "column_1",
              type: "content",
              content: [{ type: "reference", referenceId: "missing" }],
            },
          ],
        }),
      ],
      responseFields: [],
      references: [],
    };

    expect(() => validateComposedEditorModel(model)).toThrow(
      "Unknown reference: missing",
    );
  });

  it("rejects missing references in table answer cells", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        createTableBlock("table_1", {
          prompt: "",
          columns: [{ id: "column_1", label: "Column 1" }],
          rows: [{ id: "row_1", label: "Row 1" }],
          showColumnNames: true,
          showRowNames: true,
          responseFields: [
            {
              id: "answer_1",
              type: "number",
            },
          ],
          cells: [
            {
              id: "cell_1",
              rowId: "row_1",
              columnId: "column_1",
              type: "response",
              responseFieldId: "answer_1",
              correctValueSource: { type: "reference", referenceId: "missing" },
              points: 1,
              grading: { mode: "exact" },
            },
          ],
        }),
      ],
      responseFields: [],
      references: [],
    };

    expect(() => validateComposedEditorModel(model)).toThrow(
      "Unknown reference: missing",
    );
  });

  it("rejects duplicate reference ids", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [],
      responseFields: [],
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
    };

    expect(() => validateComposedEditorModel(model)).toThrow(
      "Duplicate reference id: dup",
    );
  });

  it("rejects invalid reference ids", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [],
      responseFields: [],
      references: [
        {
          id: "bad id",
          source: { type: "literal", value: 1 },
        },
      ],
    };

    expect(() => validateComposedEditorModel(model)).toThrow(
      "Invalid reference id: bad id",
    );
  });

  it("allocates standalone response field IDs after table block IDs", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "table_1",
          type: "table",
          table: {
            prompt: "",
            columns: [{ id: "column_1", label: "Column 1" }],
            rows: [{ id: "row_1", label: "Row 1" }],
            showColumnNames: true,
            showRowNames: true,
            responseFields: [
              {
                id: "answer_1",
                type: "number",
              },
            ],
            cells: [
              {
                id: "cell_1",
                rowId: "row_1",
                columnId: "column_1",
                type: "response",
                responseFieldId: "answer_1",
                correctValueSource: { type: "literal", value: 1 },
                points: 1,
                grading: { mode: "exact" },
              },
            ],
          },
        },
      ],
      responseFields: [],
      references: [],
    };

    expect(nextAvailableResponseFieldId(model)).toBe("answer_2");
  });

  it("preserves table conversion inside composed documents", () => {
    const tableModel: TableEditorModel = {
      prompt: "Ignored in composed mode",
      columns: [
        { id: "column_1", label: "Column 1" },
        { id: "column_2", label: "Column 2" },
      ],
      rows: [{ id: "row_1", label: "Row 1" }],
      showColumnNames: true,
      showRowNames: true,
      responseFields: [
        {
          id: "answer_1",
          type: "number",
          label: "Answer",
          required: true,
        },
      ],
      cells: [
        {
          id: "cell_1",
          rowId: "row_1",
          columnId: "column_1",
          type: "content",
          content: [{ type: "text", text: "Alpha" }],
        },
        {
          id: "cell_2",
          rowId: "row_1",
          columnId: "column_2",
          type: "response",
          responseFieldId: "answer_1",
          correctValueSource: { type: "literal", value: 3 },
          points: 2,
          grading: { mode: "exact" },
        },
      ],
    };
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "text", text: "Solve this." }],
        },
        createTableBlock("table_1", tableModel),
      ],
      responseFields: [],
      references: [],
    };

    const blueprint = composedEditorModelToQuestionBlueprintDocument(model);
    expect(blueprint.blocks).toHaveLength(3);
    expect(blueprint.blocks[1]).toMatchObject({
      id: "table_1_prompt",
      type: "text",
      content: [{ type: "text", text: "Ignored in composed mode" }],
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
        id: "cell_1",
        rowId: "row_1",
        columnId: "column_1",
        type: "content",
        content: [{ type: "text", text: "Alpha" }],
      },
      {
        id: "cell_2",
        rowId: "row_1",
        columnId: "column_2",
        type: "response",
        responseFieldId: "table_1_answer_1",
        correctValueSource: { schemaVersion: 1, type: "literal", value: 3 },
        points: 2,
        grading: { mode: "exact" },
      },
    ]);
    expect(blueprint.responseFields).toEqual([
      {
        id: "table_1_answer_1",
        type: "number",
        label: "Answer",
        required: true,
      },
    ]);
  });

  it("loads canonical text and response blocks back into the composed model", () => {
    const blueprint: QuestionBlueprintDocument = {
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "text", text: "Prompt" }],
        },
        {
          id: "separator_1",
          type: "separator",
        },
        {
          id: "response_1",
          type: "response",
          responseFieldId: "answer_1",
          label: "Answer",
          placeholder: "Type here",
          correctValueSource: {
            schemaVersion: 1,
            type: "literal",
            value: "42",
          },
          points: 1,
          grading: { mode: "exact" },
        },
      ],
      responseFields: [
        {
          id: "answer_1",
          type: "text",
          label: "Answer",
          required: true,
        },
      ],
      references: [],
    };

    expect(questionBlueprintDocumentToComposedEditorModel(blueprint)).toEqual({
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "text", text: "Prompt" }],
        },
        {
          id: "separator_1",
          type: "separator",
        },
        {
          id: "response_1",
          type: "response",
          responseFieldId: "answer_1",
          label: "Answer",
          placeholder: "Type here",
          correctValueSource: { type: "literal", value: "42" },
          points: 1,
          grading: { mode: "exact" },
        },
      ],
      responseFields: [
        {
          id: "answer_1",
          type: "text",
          label: "Answer",
          required: true,
        },
      ],
      references: [],
    });
  });

  it("loads references from canonical blueprints", () => {
    const blueprint: QuestionBlueprintDocument = {
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [
            { type: "text", text: "Revenue: " },
            { type: "reference", referenceId: "revenue" },
          ],
        },
      ],
      responseFields: [],
      references: [
        {
          id: "revenue",
          source: { schemaVersion: 1, type: "literal", value: 123 },
        },
      ],
    };

    expect(questionBlueprintDocumentToComposedEditorModel(blueprint)).toEqual({
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [
            { type: "text", text: "Revenue: " },
            { type: "reference", referenceId: "revenue" },
          ],
        },
      ],
      responseFields: [],
      references: [
        {
          id: "revenue",
          source: { type: "literal", value: 123 },
        },
      ],
    });
  });

  it("round-trips rich text blocks without references", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "rich_1",
          type: "rich_text",
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Prompt" }],
              },
            ],
          },
        },
      ],
      responseFields: [],
      references: [],
    };

    const blueprint = composedEditorModelToQuestionBlueprintDocument(model);
    expect(blueprint.blocks[0]).toEqual({
      id: "rich_1",
      type: "rich_text",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Prompt" }],
          },
        ],
      },
    });
    expect(questionBlueprintDocumentToComposedEditorModel(blueprint)).toEqual(model);
  });

  it("round-trips rich text references as structured inline content", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "rich_1",
          type: "rich_text",
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "Revenue: " },
                  { type: "reference", referenceId: "revenue" },
                ],
              },
            ],
          },
        },
      ],
      responseFields: [],
      references: [
        {
          id: "revenue",
          source: { type: "literal", value: 123 },
        },
      ],
    };

    const blueprint = composedEditorModelToQuestionBlueprintDocument(model);
    expect(blueprint.blocks[0]).toEqual({
      id: "rich_1",
      type: "rich_text",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Revenue: {{ .revenue }}" }],
          },
        ],
      },
    });
    expect(questionBlueprintDocumentToComposedEditorModel(blueprint)).toEqual(
      model,
    );
  });

  it("validates manually-constructed rich text reference nodes", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "rich_1",
          type: "rich_text",
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "reference", referenceId: "revenue" }],
              },
            ],
          },
        },
      ],
      responseFields: [],
      references: [
        {
          id: "revenue",
          source: { type: "literal", value: 123 },
        },
      ],
    };

    expect(() => validateComposedEditorModel(model)).not.toThrow();
  });
});

describe("table blueprint conversions", () => {
  it("keeps literal table content inline", () => {
    const model: TableEditorModel = {
      prompt: "Prompt",
      columns: [
        { id: "column_1", label: "Column 1" },
        { id: "column_2", label: "Column 2" },
      ],
      rows: [{ id: "row_1", label: "Row 1" }],
      showColumnNames: true,
      showRowNames: true,
      responseFields: [
        {
          id: "answer_1",
          type: "number",
          label: "Answer",
          required: true,
        },
      ],
      cells: [
        {
          id: "cell_1",
          rowId: "row_1",
          columnId: "column_1",
          type: "content",
          content: [{ type: "text", text: "Alpha" }],
        },
        {
          id: "cell_2",
          rowId: "row_1",
          columnId: "column_2",
          type: "response",
          responseFieldId: "answer_1",
          correctValueSource: { type: "literal", value: 3 },
          points: 2,
          grading: { mode: "exact" },
        },
      ],
    };

    const blueprint = tableEditorModelToQuestionBlueprintDocument(model);
    expect(blueprint.blocks[0]).toEqual({
      id: "prompt",
      type: "text",
      content: [{ type: "text", text: "Prompt" }],
    });

    expect(blueprint.references).toEqual([]);

    const tableBlock = blueprint.blocks.find((block) => block.type === "table");
    expect(tableBlock).toBeDefined();
    if (!tableBlock || tableBlock.type !== "table") {
      throw new Error("Expected table block.");
    }
    const contentCell = tableBlock.cells.find(
      (cell: (typeof tableBlock.cells)[number]) => cell.id === "cell_1",
    );
    const responseCell = tableBlock.cells.find(
      (cell: (typeof tableBlock.cells)[number]) => cell.id === "cell_2",
    );
    expect(contentCell).toEqual({
      id: "cell_1",
      rowId: "row_1",
      columnId: "column_1",
      type: "content",
      content: [
        { type: "text", text: "Alpha" },
      ],
    });
    expect(responseCell).toEqual({
      id: "cell_2",
      rowId: "row_1",
      columnId: "column_2",
      type: "response",
      responseFieldId: "answer_1",
      correctValueSource: { schemaVersion: 1, type: "literal", value: 3 },
      points: 2,
      grading: { mode: "exact" },
    });
  });

  it("maps rendered table bodies to preview cells with text", () => {
    const preview = questionBodyToTableBlockPreviewModel({
      schemaVersion: QuestionBodySchemaVersion.NUMBER_1,
      blocks: [
        {
          id: "prompt",
          type: "text",
          content: [{ type: "text", text: "Prompt" }],
        },
        {
          id: "table",
          type: "table",
          columns: [
            { id: "column_1", label: "Column 1" },
            { id: "column_2", label: "Column 2" },
          ],
          rows: [{ id: "row_1", label: "Row 1" }],
          showColumnNames: true,
          showRowNames: true,
          cells: [
            {
              id: "cell_1",
              rowId: "row_1",
              columnId: "column_1",
              type: "content",
              text: "A1",
            },
            {
              id: "cell_2",
              rowId: "row_1",
              columnId: "column_2",
              type: "response",
              responseFieldId: "answer_1",
            },
          ],
        },
      ],
      responseFields: [
        {
          id: "answer_1",
          type: "number",
          label: "Answer",
          required: true,
        },
      ],
    });

    expect(preview.cells).toEqual([
      {
        id: "cell_1",
        rowId: "row_1",
        columnId: "column_1",
        type: "content",
        content: [{ type: "text", text: "A1" }],
      },
      {
        id: "cell_2",
        rowId: "row_1",
        columnId: "column_2",
        type: "response",
        responseFieldId: "answer_1",
      },
    ]);
  });

  it("renders inline display values in the prompt preview", () => {
    const preview = questionBodyToTableBlockPreviewModel({
      schemaVersion: QuestionBodySchemaVersion.NUMBER_1,
      blocks: [
        {
          id: "prompt",
          type: "text",
          content: [
            { type: "text", text: "Revenue: " },
            {
              type: "value",
              referenceId: "revenue",
              displayValue: "123",
            },
          ],
        },
        {
          id: "table",
          type: "table",
          columns: [{ id: "column_1", label: "Column 1" }],
          rows: [{ id: "row_1", label: "Row 1" }],
          showColumnNames: true,
          showRowNames: true,
          cells: [
            {
              id: "cell_1",
              rowId: "row_1",
              columnId: "column_1",
              type: "content",
              text: "A1",
            },
          ],
        },
      ],
      responseFields: [],
    });

    expect(preview.prompt).toBe("Revenue: 123");
  });
});

describe("table blueprint response fields", () => {
  it("preserves response field metadata when loading and saving", () => {
    const blueprint: QuestionBlueprintDocument = {
      schemaVersion: 1,
      blocks: [
        {
          id: "prompt",
          type: "text",
          content: [{ type: "text", text: "Prompt" }],
        },
        {
          id: "table",
          type: "table",
          columns: [{ id: "column_1", label: "Column 1" }],
          rows: [{ id: "row_1", label: "Row 1" }],
          showColumnNames: true,
          showRowNames: true,
          cells: [
            {
              id: "cell_1",
              rowId: "row_1",
              columnId: "column_1",
              type: "response",
              responseFieldId: "answer_1",
              correctValueSource: {
                schemaVersion: 1,
                type: "literal",
                value: "001",
              },
              points: 2,
              grading: { mode: "exact" },
            },
          ],
        },
      ],
      references: [],
      responseFields: [
        {
          id: "answer_1",
          type: "text",
          label: "Student answer",
          required: false,
        },
      ],
    };

    const model = questionBlueprintDocumentToTableEditorModel(blueprint);

    expect(model.responseFields).toEqual(blueprint.responseFields);
    expect(tableEditorModelToQuestionBlueprintDocument(model).responseFields).toEqual(
      blueprint.responseFields,
    );
  });

  it("preserves response field types when saving table models", () => {
    const model: TableEditorModel = {
      prompt: "Prompt",
      columns: [{ id: "column_1", label: "Column 1" }],
      rows: [{ id: "row_1", label: "Row 1" }],
      showColumnNames: true,
      showRowNames: true,
      responseFields: [
        {
          id: "answer_1",
          type: "number",
          label: "Amount",
          required: true,
        },
      ],
      cells: [
        {
          id: "cell_1",
          rowId: "row_1",
          columnId: "column_1",
          type: "response",
          responseFieldId: "answer_1",
          correctValueSource: { type: "literal", value: 3 },
          points: 1,
          grading: { mode: "exact" },
        },
      ],
    };

    expect(tableEditorModelToQuestionBlueprintDocument(model).responseFields).toEqual([
      {
        id: "answer_1",
        type: "number",
        label: "Amount",
        required: true,
      },
    ]);
  });

  it("rejects saved blueprints with unsupported json response fields", () => {
    const blueprint = {
      schemaVersion: 1,
      blocks: [],
      references: [],
      responseFields: [
        {
          id: "answer_1",
          type: "json",
          label: "Payload",
          required: false,
        },
      ],
    } as unknown as QuestionBlueprintDocument;

    expect(() => questionBlueprintDocumentToComposedEditorModel(blueprint)).toThrow(
      "Unsupported response field type: json",
    );
  });

  it("rejects reference-backed content cells in standalone table conversion", () => {
    const model = createModelWithResponseFields([]);
    model.cells = [
      {
        id: "cell_1",
        rowId: "row_1",
        columnId: "column_1",
        type: "content",
        content: [{ type: "reference", referenceId: "content_ref" }],
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
        id: "cell_1",
        rowId: "row_1",
        columnId: "column_1",
        type: "response",
        responseFieldId: "answer_1",
        correctValueSource: { type: "reference", referenceId: "answer_ref" },
        points: 1,
        grading: { mode: "exact" },
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
          type: "table",
          table: {
            prompt: "Prompt",
            columns: [{ id: "column_1", label: "Column 1" }],
            rows: [{ id: "row_1", label: "Row 1" }],
            showColumnNames: true,
            showRowNames: true,
            responseFields: [
              {
                id: "answer_1",
                type: "number",
                label: "Answer",
                required: true,
              },
            ],
            cells: [
              {
                id: "cell_1",
                rowId: "row_1",
                columnId: "column_1",
                type: "response",
                responseFieldId: "answer_1",
                correctValueSource: { type: "literal", value: 3 },
                points: 1,
                grading: { mode: "exact" },
              },
            ],
          },
        },
        {
          id: "table_2",
          type: "table",
          table: {
            prompt: "Prompt",
            columns: [{ id: "column_1", label: "Column 1" }],
            rows: [{ id: "row_1", label: "Row 1" }],
            showColumnNames: true,
            showRowNames: true,
            responseFields: [
              {
                id: "answer_1",
                type: "number",
                label: "Answer",
                required: true,
              },
            ],
            cells: [
              {
                id: "cell_1",
                rowId: "row_1",
                columnId: "column_1",
                type: "response",
                responseFieldId: "answer_1",
                correctValueSource: { type: "literal", value: 4 },
                points: 1,
                grading: { mode: "exact" },
              },
            ],
          },
        },
      ],
      responseFields: [],
      references: [],
    };

    const blueprint = composedEditorModelToQuestionBlueprintDocument(model);

    expect(blueprint.responseFields.map((field) => field.id)).toEqual([
      "table_1_answer_1",
      "table_2_answer_1",
    ]);
    const tableBlocks = blueprint.blocks.filter((block) => block.type === "table");
    expect(tableBlocks).toHaveLength(2);
    expect(tableBlocks[0]).toMatchObject({
      id: "table_1",
      cells: [
        expect.objectContaining({
          responseFieldId: "table_1_answer_1",
        }),
      ],
    });
    expect(tableBlocks[1]).toMatchObject({
      id: "table_2",
      cells: [
        expect.objectContaining({
          responseFieldId: "table_2_answer_1",
        }),
      ],
    });
  });

  it("round-trips namespaced table answer fields back to local ids", () => {
    const model: ComposedEditorModel = {
      ...createDefaultComposedEditorModel(),
      blocks: [
        {
          id: "table_1",
          type: "table",
          table: {
            prompt: "Prompt",
            columns: [{ id: "column_1", label: "Column 1" }],
            rows: [{ id: "row_1", label: "Row 1" }],
            showColumnNames: true,
            showRowNames: true,
            responseFields: [
              {
                id: "answer_1",
                type: "number",
                label: "Answer",
                required: true,
              },
            ],
            cells: [
              {
                id: "cell_1",
                rowId: "row_1",
                columnId: "column_1",
                type: "response",
                responseFieldId: "answer_1",
                correctValueSource: { type: "literal", value: 3 },
                points: 1,
                grading: { mode: "exact" },
              },
            ],
          },
        },
      ],
      responseFields: [],
      references: [],
    };

    const blueprint = composedEditorModelToQuestionBlueprintDocument(model);
    expect(questionBlueprintDocumentToComposedEditorModel(blueprint)).toEqual(model);
  });
});

function createModelWithResponseFields(
  responseFields: TableEditorModel["responseFields"],
): TableEditorModel {
  return {
    prompt: "Prompt",
    columns: [{ id: "column_1", label: "Column 1" }],
    rows: [{ id: "row_1", label: "Row 1" }],
    showColumnNames: true,
    showRowNames: true,
    responseFields,
    cells: [
      {
        id: "cell_1",
        rowId: "row_1",
        columnId: "column_1",
        type: "response",
        responseFieldId: "answer_1",
        correctValueSource: { type: "literal", value: 3 },
        points: 1,
        grading: { mode: "exact" },
      },
    ],
  };
}
