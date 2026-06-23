import { describe, expect, it } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { buildQuestionBlueprintDraft } from "./blueprint-draft";

describe("buildQuestionBlueprintDraft", () => {
  it("omits unused references from the saved document", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ referenceId: "used", type: "reference" }],
          id: "text_1",
          type: "text",
        },
      ],
      references: [
        {
          id: "used",
          source: { type: "literal", value: "alpha" },
        },
        {
          id: "unused",
          source: { type: "literal", value: "beta" },
        },
      ],
      responseFields: [],
      schemaVersion: 1,
    };

    const result = buildQuestionBlueprintDraft({
      description: "",
      model,
      name: "Blueprint",
      sources: [],
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        document: {
          references: [
            {
              id: "used",
              source: { type: "literal", value: "alpha" },
            },
          ],
        },
      },
    });
    expect(model.references.map((reference) => reference.id)).toEqual([
      "used",
      "unused",
    ]);
  });

  it("builds a clean integrated authoring document", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: {
            content: [
              {
                content: [
                  { text: "Revenue for ", type: "text" },
                  { referenceId: "period", type: "reference" },
                ],
                level: 2,
                type: "heading",
              },
              {
                items: [
                  {
                    content: [
                      {
                        content: [
                          { text: "Amount: ", type: "text" },
                          { referenceId: "range", type: "reference" },
                        ],
                        type: "paragraph",
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
          id: "rich_text_1",
          type: "rich_text",
        },
        {
          id: "table_1",
          table: {
            cells: [
              {
                columnId: "column_1",
                content: [
                  {
                    fallbackText: "200",
                    rangeCell: { columnOffset: 0, rowOffset: 1 },
                    referenceId: "range",
                    type: "reference",
                  },
                ],
                id: "cell_1",
                rowId: "row_1",
                type: "content",
              },
              {
                columnId: "column_2",
                correctValueSource: {
                  referenceId: "answer",
                  type: "reference",
                },
                grading: { mode: "exact" },
                id: "cell_2",
                points: 2,
                responseFieldId: "table_answer_1",
                rowId: "row_1",
                type: "response",
              },
            ],
            columns: [
              { id: "column_1", label: "Column 1" },
              { id: "column_2", label: "Column 2" },
            ],
            prompt: "",
            responseFields: [
              {
                id: "table_answer_1",
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
      references: [
        {
          id: "period",
          source: { type: "literal", value: "Q2" },
        },
        {
          id: "range",
          source: {
            ref: "Sheet1!A1:B2",
            sourceId: "source_1",
            type: "workbook_range",
          },
        },
        {
          id: "answer",
          source: {
            ref: "Sheet1!C1",
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
        {
          id: "unused",
          source: {
            ref: "Sheet1!Z99",
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
      ],
      responseFields: [],
      schemaVersion: 1,
    };

    const result = buildQuestionBlueprintDraft({
      description: "  ",
      model,
      name: " Revenue blueprint ",
      sources: [
        {
          name: "Source 1",
          sourceId: "source_1",
          workbookId: "workbook_1",
        },
      ],
    });

    expect(result).toEqual({
      ok: true,
      value: {
        description: null,
        document: {
          blocks: [
            {
              content: {
                content: [
                  {
                    attrs: { level: 2 },
                    content: [
                      { text: "Revenue for {{ .period }}", type: "text" },
                    ],
                    type: "heading",
                  },
                  {
                    content: [
                      {
                        content: [
                          {
                            content: [
                              {
                                text: "Amount: {{ .range }}",
                                type: "text",
                              },
                            ],
                            type: "paragraph",
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
              id: "rich_text_1",
              type: "rich_text",
            },
            {
              cells: [
                {
                  columnId: "column_1",
                  content: [
                    {
                      fallbackText: "200",
                      rangeCell: { columnOffset: 0, rowOffset: 1 },
                      referenceId: "range",
                      type: "reference",
                    },
                  ],
                  id: "cell_1",
                  rowId: "row_1",
                  type: "content",
                },
                {
                  columnId: "column_2",
                  correctValueSource: {
                    referenceId: "answer",
                    schemaVersion: 1,
                    type: "reference",
                  },
                  grading: { mode: "exact" },
                  id: "cell_2",
                  points: 2,
                  responseFieldId: "table_1_table_answer_1",
                  rowId: "row_1",
                  type: "response",
                },
              ],
              columns: [
                { id: "column_1", label: "Column 1" },
                { id: "column_2", label: "Column 2" },
              ],
              id: "table_1",
              rows: [{ id: "row_1", label: "Row 1" }],
              showColumnNames: true,
              showRowNames: true,
              type: "table",
            },
          ],
          references: [
            {
              id: "period",
              source: { schemaVersion: 1, type: "literal", value: "Q2" },
            },
            {
              id: "range",
              source: {
                ref: "Sheet1!A1:B2",
                schemaVersion: 1,
                sourceId: "source_1",
                type: "workbook_range",
              },
            },
            {
              id: "answer",
              source: {
                ref: "Sheet1!C1",
                schemaVersion: 1,
                sourceId: "source_1",
                type: "workbook_cell",
              },
            },
          ],
          responseFields: [
            {
              id: "table_1_table_answer_1",
              label: "Answer",
              required: true,
              type: "number",
            },
          ],
          schemaVersion: 1,
        },
        name: "Revenue blueprint",
        sources: [
          {
            name: "Source 1",
            sourceId: "source_1",
            workbookId: "workbook_1",
          },
        ],
      },
    });
  });
});
