import { describe, expect, it } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { buildQuestionBlueprintDraft } from "./blueprint-draft";

describe("buildQuestionBlueprintDraft", () => {
  it("omits unused references from the saved document", () => {
    const model: ComposedEditorModel = {
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "reference", referenceId: "used" }],
        },
      ],
      responseFields: [],
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
    };

    const result = buildQuestionBlueprintDraft({
      name: "Blueprint",
      description: "",
      model,
      workbookId: null,
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
      schemaVersion: 1,
      blocks: [
        {
          id: "rich_text_1",
          type: "rich_text",
          content: {
            type: "doc",
            content: [
              {
                type: "heading",
                level: 2,
                content: [
                  { type: "text", text: "Revenue for " },
                  { type: "reference", referenceId: "period" },
                ],
              },
              {
                type: "bullet_list",
                items: [
                  {
                    type: "list_item",
                    content: [
                      {
                        type: "paragraph",
                        content: [
                          { type: "text", text: "Amount: " },
                          { type: "reference", referenceId: "range" },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
        {
          id: "table_1",
          type: "table",
          table: {
            prompt: "",
            columns: [
              { id: "column_1", label: "Column 1" },
              { id: "column_2", label: "Column 2" },
            ],
            rows: [{ id: "row_1", label: "Row 1" }],
            showColumnNames: true,
            showRowNames: true,
            responseFields: [
              {
                id: "table_answer_1",
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
                content: [
                  {
                    type: "reference",
                    referenceId: "range",
                    rangeCell: { rowOffset: 1, columnOffset: 0 },
                    fallbackText: "200",
                  },
                ],
              },
              {
                id: "cell_2",
                rowId: "row_1",
                columnId: "column_2",
                type: "response",
                responseFieldId: "table_answer_1",
                correctValueSource: {
                  type: "reference",
                  referenceId: "answer",
                },
                points: 2,
                grading: { mode: "exact" },
              },
            ],
          },
        },
      ],
      responseFields: [],
      references: [
        {
          id: "period",
          source: { type: "literal", value: "Q2" },
        },
        {
          id: "range",
          source: {
            type: "workbook_range",
            sourceId: "source_1",
            ref: "Sheet1!A1:B2",
          },
        },
        {
          id: "answer",
          source: {
            type: "workbook_cell",
            sourceId: "source_1",
            ref: "Sheet1!C1",
          },
        },
        {
          id: "unused",
          source: {
            type: "workbook_cell",
            sourceId: "source_1",
            ref: "Sheet1!Z99",
          },
        },
      ],
    };

    const result = buildQuestionBlueprintDraft({
      name: " Revenue blueprint ",
      description: "  ",
      model,
      workbookId: "workbook_1",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        name: "Revenue blueprint",
        description: null,
        workbookId: "workbook_1",
        document: {
          schemaVersion: 1,
          references: [
            {
              id: "period",
              source: { schemaVersion: 1, type: "literal", value: "Q2" },
            },
            {
              id: "range",
              source: {
                schemaVersion: 1,
                type: "workbook_range",
                sourceId: "source_1",
                ref: "Sheet1!A1:B2",
              },
            },
            {
              id: "answer",
              source: {
                schemaVersion: 1,
                type: "workbook_cell",
                sourceId: "source_1",
                ref: "Sheet1!C1",
              },
            },
          ],
          responseFields: [
            {
              id: "table_1_table_answer_1",
              type: "number",
              label: "Answer",
              required: true,
            },
          ],
          blocks: [
            {
              id: "rich_text_1",
              type: "rich_text",
              content: {
                type: "doc",
                content: [
                  {
                    type: "heading",
                    attrs: { level: 2 },
                    content: [
                      { type: "text", text: "Revenue for {{ .period }}" },
                    ],
                  },
                  {
                    type: "bullet_list",
                    content: [
                      {
                        type: "list_item",
                        content: [
                          {
                            type: "paragraph",
                            content: [
                              {
                                type: "text",
                                text: "Amount: {{ .range }}",
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
            {
              id: "table_1",
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
                  content: [
                    {
                      type: "reference",
                      referenceId: "range",
                      rangeCell: { rowOffset: 1, columnOffset: 0 },
                      fallbackText: "200",
                    },
                  ],
                },
                {
                  id: "cell_2",
                  rowId: "row_1",
                  columnId: "column_2",
                  type: "response",
                  responseFieldId: "table_1_table_answer_1",
                  correctValueSource: {
                    schemaVersion: 1,
                    type: "reference",
                    referenceId: "answer",
                  },
                  points: 2,
                  grading: { mode: "exact" },
                },
              ],
            },
          ],
        },
      },
    });
  });
});
