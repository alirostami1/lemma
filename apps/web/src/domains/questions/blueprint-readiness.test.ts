import { describe, expect, it } from "vitest";
import type { ComposedEditorModel } from "./authoring";
import { getBlueprintReadinessIssues } from "./blueprint-readiness";

describe("blueprint readiness", () => {
  it("ignores unused workbook references when validating attached sources", () => {
    const issues = getBlueprintReadinessIssues({
      attachedSources: [
        {
          name: "Current workbook",
          sourceId: "source_current",
          type: "workbook",
          workbookId: "workbook_current",
        },
      ],
      model: {
        ...readyModel(),
        references: [
          {
            id: "unused_ref",
            source: {
              ref: "Sheet1!A1",
              sourceId: "source_detached",
              type: "workbook_cell",
            },
          },
        ],
      },
      name: "Blueprint",
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "invalid_reference_source" }),
    );
  });

  it("still validates attached sources for used workbook references", () => {
    const issues = getBlueprintReadinessIssues({
      attachedSources: [
        {
          name: "Current workbook",
          sourceId: "source_current",
          type: "workbook",
          workbookId: "workbook_current",
        },
      ],
      model: {
        ...readyModel(),
        blocks: [
          {
            content: [{ referenceId: "used_ref", type: "reference" }],
            id: "text_1",
            type: "text",
          },
          ...readyModel().blocks,
        ],
        references: [
          {
            id: "used_ref",
            source: {
              ref: "Sheet1!A1",
              sourceId: "source_detached",
              type: "workbook_cell",
            },
          },
        ],
      },
      name: "Blueprint",
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "invalid_reference_source",
        target: { referenceId: "used_ref" },
      }),
    );
  });

  it("includes input primitives inside nested containers", () => {
    const model = readyModel();
    const issues = getBlueprintReadinessIssues({
      attachedSources: [],
      model: {
        ...model,
        blocks: [
          {
            blocks: [
              {
                correctValueSource: { type: "literal", value: "42" },
                grading: { mode: "exact" },
                id: "response_1",
                points: 1,
                responseFieldId: "missing_answer",
                type: "response",
              },
            ],
            containerType: "page",
            id: "page_1",
            type: "container",
          },
        ],
      },
      name: "Blueprint",
    });

    expect(issues).toContainEqual({
      code: "missing_response_field",
      target: { blockId: "response_1" },
    });
  });

  it("flags top-level non-manual inputs missing a correct value source", () => {
    const model = readyModel();
    const issues = getBlueprintReadinessIssues({
      attachedSources: [],
      model: {
        ...model,
        blocks: [
          {
            grading: { mode: "exact" },
            id: "response_1",
            points: 1,
            responseFieldId: "answer_1",
            type: "response",
          },
        ],
      },
      name: "Blueprint",
    });

    expect(issues).toContainEqual({
      code: "missing_response_source",
      target: { blockId: "response_1" },
    });
  });

  it("flags nested and table non-manual inputs missing a correct value source", () => {
    const model = readyModel();
    const issues = getBlueprintReadinessIssues({
      attachedSources: [],
      model: {
        ...model,
        blocks: [
          {
            blocks: [
              {
                grading: { mode: "case_insensitive_text" },
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
                      blocks: [
                        {
                          grading: {
                            mode: "number",
                            tolerance: { type: "absolute", value: 0 },
                          },
                          id: "cell_input_1",
                          points: 1,
                          responseFieldId: "table_answer_1",
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
                  responseFields: [{ id: "table_answer_1", type: "number" }],
                  rows: [{ id: "row_1", label: "Row" }],
                  showColumnNames: true,
                  showRowNames: true,
                },
                type: "table",
              },
            ],
            containerType: "page",
            id: "page_1",
            type: "container",
          },
        ],
      },
      name: "Blueprint",
    });

    expect(issues).toContainEqual({
      code: "missing_response_source",
      target: { blockId: "response_1" },
    });
    expect(issues).toContainEqual({
      code: "missing_table_response_source",
      target: { blockId: "table_1", cellId: "cell_1" },
    });
  });

  it("allows manual inputs without a correct value source", () => {
    const model = readyModel();
    const issues = getBlueprintReadinessIssues({
      attachedSources: [],
      model: {
        ...model,
        blocks: [
          {
            grading: { mode: "manual" },
            id: "response_1",
            points: 1,
            responseFieldId: "answer_1",
            type: "response",
          },
          {
            blocks: [
              {
                grading: { mode: "manual" },
                id: "response_2",
                points: 1,
                responseFieldId: "answer_1",
                type: "response",
              },
            ],
            containerType: "step",
            id: "step_1",
            type: "container",
          },
          {
            id: "table_1",
            table: {
              cells: [
                {
                  blocks: [
                    {
                      grading: { mode: "manual" },
                      id: "cell_input_1",
                      points: 1,
                      responseFieldId: "table_answer_1",
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
              responseFields: [{ id: "table_answer_1", type: "number" }],
              rows: [{ id: "row_1", label: "Row" }],
              showColumnNames: true,
              showRowNames: true,
            },
            type: "table",
          },
        ],
      },
      name: "Blueprint",
    });

    expect(issues).not.toContainEqual({
      code: "missing_response_source",
      target: { blockId: "response_1" },
    });
    expect(issues).not.toContainEqual({
      code: "missing_response_source",
      target: { blockId: "response_2" },
    });
    expect(issues).not.toContainEqual({
      code: "missing_table_response_source",
      target: { blockId: "table_1", cellId: "cell_1" },
    });
  });
});

function readyModel(): ComposedEditorModel {
  return {
    blocks: [
      {
        correctValueSource: { type: "literal", value: "42" },
        grading: { mode: "exact" },
        id: "response_1",
        points: 1,
        responseFieldId: "answer_1",
        type: "response",
      },
    ],
    references: [],
    responseFields: [{ id: "answer_1", label: "Answer", type: "number" }],
    schemaVersion: 2,
  };
}
