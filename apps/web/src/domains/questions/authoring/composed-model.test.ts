import { describe, expect, it } from "vitest";
import {
  type ComposedEditorModel,
  createDefaultComposedEditorModel,
  createReferenceDraft,
  createResponseBlock,
  createTextBlock,
  extractUsedReferenceIdsFromComposedEditorModel,
  extractWorkbookReferenceRefsFromComposedEditorModel,
  getComposedEditorReferenceUsage,
  getReferenceUsage,
  getUnusedComposedReferences,
  stripUnusedComposedReferences,
  tableEditorModelToStaticPreviewModel,
} from "#/domains/questions/authoring";

describe("composed authoring helpers", () => {
  it("creates a default composed editor model", () => {
    expect(createDefaultComposedEditorModel()).toEqual({
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "text", text: "Write the question here." }],
        },
        {
          id: "response_1",
          type: "response",
          responseFieldId: "answer_1",
          placeholder: "Answer",
          correctValueSource: { type: "literal", value: "" },
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

  it("creates a reference draft with a fresh id", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [],
      responseFields: [],
      references: [
        { id: "reference_1", source: { type: "literal", value: "alpha" } },
      ],
    };

    expect(createReferenceDraft(model)).toEqual({
      id: "reference_2",
      source: { type: "literal", value: "" },
    });
  });

  it("extracts used reference ids and workbook refs", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        createTextBlock("text_1", "Hello"),
        {
          id: "text_2",
          type: "text",
          content: [
            { type: "reference", referenceId: "reference_1" },
            { type: "reference", referenceId: "reference_2" },
          ],
        },
        createResponseBlock("response_1", "answer_1", {
          correctValueSource: {
            type: "reference",
            referenceId: "answer_source",
          },
        }),
      ],
      responseFields: [
        {
          id: "answer_1",
          type: "text",
        },
      ],
      references: [
        {
          id: "reference_1",
          source: { type: "workbook_range", ref: "'Sheet1'!A1:B2" },
        },
        {
          id: "reference_2",
          source: { type: "literal", value: "Bravo" },
        },
        {
          id: "answer_source",
          source: { type: "workbook_cell", ref: "'Sheet1'!A1" },
        },
      ],
    };

    expect(extractUsedReferenceIdsFromComposedEditorModel(model)).toEqual([
      "reference_1",
      "reference_2",
      "answer_source",
    ]);
    expect(extractWorkbookReferenceRefsFromComposedEditorModel(model)).toEqual([
      "'Sheet1'!A1:B2",
      "'Sheet1'!A1",
    ]);
  });

  it("tracks exact reference usage locations", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "reference", referenceId: "reference_1" }],
        },
        {
          id: "response_1",
          type: "response",
          responseFieldId: "answer_1",
          correctValueSource: {
            type: "reference",
            referenceId: "answer_source",
          },
          points: 1,
          grading: { mode: "exact" },
        },
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
                id: "table_answer_1",
                type: "text",
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
                responseFieldId: "table_answer_1",
                correctValueSource: {
                  type: "reference",
                  referenceId: "table_ref",
                },
                points: 1,
                grading: { mode: "exact" },
              },
            ],
          },
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
          id: "reference_1",
          source: { type: "literal", value: "alpha" },
        },
        {
          id: "answer_source",
          source: { type: "literal", value: "beta" },
        },
        {
          id: "content_ref",
          source: { type: "literal", value: "gamma" },
        },
        {
          id: "table_ref",
          source: { type: "literal", value: "delta" },
        },
      ],
    };

    expect(getReferenceUsage(model)).toEqual(
      new Map([
        ["reference_1", [{ type: "text_block", blockId: "text_1" }]],
        [
          "answer_source",
          [
            {
              type: "response_answer",
              blockId: "response_1",
              responseFieldId: "answer_1",
            },
          ],
        ],
        [
          "content_ref",
          [
            {
              type: "table_content_cell",
              blockId: "table_1",
              cellId: "cell_1",
            },
          ],
        ],
        [
          "table_ref",
          [
            {
              type: "table_answer_cell",
              blockId: "table_1",
              cellId: "cell_2",
              responseFieldId: "table_answer_1",
            },
          ],
        ],
      ]),
    );
  });

  it("strips unused references without changing live content", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "reference", referenceId: "used_text" }],
        },
        createResponseBlock("response_1", "answer_1", {
          correctValueSource: { type: "reference", referenceId: "used_answer" },
        }),
      ],
      responseFields: [
        {
          id: "answer_1",
          type: "text",
        },
      ],
      references: [
        {
          id: "used_text",
          source: { type: "literal", value: "alpha" },
        },
        {
          id: "used_answer",
          source: { type: "literal", value: "beta" },
        },
        {
          id: "unused",
          source: { type: "literal", value: "gamma" },
        },
      ],
    };

    expect(getComposedEditorReferenceUsage(model)).toEqual(
      getReferenceUsage(model),
    );
    expect(
      getUnusedComposedReferences(model).map((reference) => reference.id),
    ).toEqual(["unused"]);
    expect(stripUnusedComposedReferences(model)).toEqual({
      ...model,
      references: model.references.slice(0, 2),
    });
    expect(model.references.map((reference) => reference.id)).toEqual([
      "used_text",
      "used_answer",
      "unused",
    ]);
  });

  it("converts a table editor model to a static preview model", () => {
    expect(
      tableEditorModelToStaticPreviewModel({
        prompt: "Prompt",
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
            content: [{ type: "text", text: "001" }],
          },
        ],
      }),
    ).toEqual({
      prompt: "Prompt",
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
          content: [{ type: "text", text: "001" }],
        },
      ],
    });
  });
});
