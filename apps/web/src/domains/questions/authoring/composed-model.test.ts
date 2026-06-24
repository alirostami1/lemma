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
      blocks: [
        {
          content: [{ text: "Write the question here.", type: "text" }],
          id: "text_1",
          type: "text",
        },
        {
          correctValueSource: { type: "literal", value: "" },
          grading: { mode: "exact" },
          id: "response_1",
          placeholder: "Answer",
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

  it("creates a reference draft with a fresh id", () => {
    const model: ComposedEditorModel = {
      blocks: [],
      references: [
        { id: "reference_1", source: { type: "literal", value: "alpha" } },
      ],
      responseFields: [],
      schemaVersion: 1,
    };

    expect(createReferenceDraft(model)).toEqual({
      id: "reference_2",
      source: { type: "literal", value: "" },
    });
  });

  it("extracts used reference ids and workbook refs", () => {
    const model: ComposedEditorModel = {
      blocks: [
        createTextBlock("text_1", "Hello"),
        {
          content: [
            { referenceId: "reference_1", type: "reference" },
            { referenceId: "reference_2", type: "reference" },
          ],
          id: "text_2",
          type: "text",
        },
        createResponseBlock("response_1", "answer_1", {
          correctValueSource: {
            referenceId: "answer_source",
            type: "reference",
          },
        }),
      ],
      references: [
        {
          id: "reference_1",
          source: {
            ref: "'Sheet1'!A1:B2",
            sourceId: "source_1",
            type: "workbook_range",
          },
        },
        {
          id: "reference_2",
          source: { type: "literal", value: "Bravo" },
        },
        {
          id: "answer_source",
          source: {
            ref: "'Sheet1'!A1",
            sourceId: "source_1",
            type: "workbook_cell",
          },
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
      blocks: [
        {
          content: [{ referenceId: "reference_1", type: "reference" }],
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
        {
          id: "table_1",
          table: {
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
                  referenceId: "table_ref",
                  type: "reference",
                },
                grading: { mode: "exact" },
                id: "cell_2",
                points: 1,
                responseFieldId: "table_answer_1",
                rowId: "row_1",
                type: "response",
              },
            ],
            columns: [{ id: "column_1", label: "Column 1" }],
            prompt: "",
            responseFields: [
              {
                id: "table_answer_1",
                type: "text",
              },
            ],
            rows: [{ id: "row_1", label: "Row 1" }],
            showColumnNames: true,
            showRowNames: true,
          },
          type: "table",
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
      responseFields: [
        {
          id: "answer_1",
          type: "text",
        },
      ],
      schemaVersion: 1,
    };

    expect(getReferenceUsage(model)).toEqual(
      new Map([
        ["reference_1", [{ blockId: "text_1", type: "text_block" }]],
        [
          "answer_source",
          [
            {
              blockId: "response_1",
              responseFieldId: "answer_1",
              type: "response_answer",
            },
          ],
        ],
        [
          "content_ref",
          [
            {
              blockId: "table_1",
              cellId: "cell_1",
              type: "table_content_cell",
            },
          ],
        ],
        [
          "table_ref",
          [
            {
              blockId: "table_1",
              cellId: "cell_2",
              responseFieldId: "table_answer_1",
              type: "table_answer_cell",
            },
          ],
        ],
      ]),
    );
  });

  it("strips unused references without changing live content", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ referenceId: "used_text", type: "reference" }],
          id: "text_1",
          type: "text",
        },
        createResponseBlock("response_1", "answer_1", {
          correctValueSource: { referenceId: "used_answer", type: "reference" },
        }),
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
      responseFields: [
        {
          id: "answer_1",
          type: "text",
        },
      ],
      schemaVersion: 1,
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
        cells: [
          {
            columnId: "column_1",
            content: [{ text: "001", type: "text" }],
            id: "cell_1",
            rowId: "row_1",
            type: "content",
          },
        ],
        columns: [{ id: "column_1", label: "Column 1" }],
        prompt: "Prompt",
        responseFields: [],
        rows: [{ id: "row_1", label: "Row 1" }],
        showColumnNames: true,
        showRowNames: true,
      }),
    ).toEqual({
      cells: [
        {
          columnId: "column_1",
          content: [{ text: "001", type: "text" }],
          id: "cell_1",
          rowId: "row_1",
          type: "content",
        },
      ],
      columns: [{ id: "column_1", label: "Column 1" }],
      prompt: "Prompt",
      responseFields: [],
      rows: [{ id: "row_1", label: "Row 1" }],
      showColumnNames: true,
      showRowNames: true,
    });
  });
});
