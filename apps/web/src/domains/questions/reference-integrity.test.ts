import { describe, expect, it } from "vitest";
import {
  type ComposedEditorModel,
  createTableBlock,
  richContentFromInlineContent,
} from "./authoring";
import { getTableCellPrimitiveBlocks } from "./authoring/table-model";
import {
  getReferenceIntegrityIssues,
  getReferenceUsageLocations,
  type ReferenceIntegrityWorkbookSource,
  removeReferenceUsageFromComposedEditorModel,
} from "./reference-integrity";
import { parseWorkbookRef } from "./workbook-reference";

describe("reference integrity", () => {
  it("reports every current usage location for one workbook reference", () => {
    const model = modelWithAllUsageLocations();

    const issues = getReferenceIntegrityIssues({
      model,
      sources: [sourceWithStatus("source_1", "unavailable")],
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]?.locations.map((location) => location.type)).toEqual([
      "text_block",
      "rich_text_block",
      "response_answer",
      "table_content_cell",
      "table_answer_cell",
    ]);
  });

  it("keeps usage locations as the source of truth", () => {
    const usage = getReferenceUsageLocations(modelWithAllUsageLocations());

    expect(usage.get("range_ref")?.map((location) => location.type)).toEqual([
      "text_block",
      "rich_text_block",
      "response_answer",
      "table_content_cell",
      "table_answer_cell",
    ]);
  });

  it("extracts and removes reference usages inside nested containers", () => {
    const base = modelWithAllUsageLocations();
    const model: ComposedEditorModel = {
      ...base,
      blocks: [
        {
          blocks: [
            {
              blocks: base.blocks,
              containerType: "step",
              id: "step_1",
              type: "container",
            },
          ],
          containerType: "page",
          id: "page_1",
          type: "container",
        },
      ],
    };
    const usages = getReferenceUsageLocations(model).get("range_ref") ?? [];
    expect(usages.map((usage) => usage.type)).toEqual([
      "text_block",
      "rich_text_block",
      "response_answer",
      "table_content_cell",
      "table_answer_cell",
    ]);

    let updated = model;
    for (const usage of usages) {
      updated = removeReferenceUsageFromComposedEditorModel({
        model: updated,
        referenceId: "range_ref",
        usage,
      });
    }
    expect(getReferenceUsageLocations(updated).has("range_ref")).toBe(false);
  });

  it("extracts and removes rich text references inside nested table cells", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          blocks: [
            createTableBlock("table_1", {
              blockId: "table_1",
              cells: [
                {
                  blocks: [
                    {
                      content: richContentFromInlineContent([
                        { referenceId: "range_ref", type: "reference" },
                      ]),
                      id: "table_rich_text_1",
                      type: "rich_text",
                    },
                  ],
                  columnId: "column_1",
                  id: "cell_1",
                  rowId: "row_1",
                },
              ],
              columns: [{ id: "column_1", label: "Column" }],
              prompt: "",
              responseFields: [],
              rows: [{ id: "row_1", label: "Row" }],
              showColumnNames: true,
              showRowNames: true,
            }),
          ],
          containerType: "page",
          id: "page_1",
          type: "container",
        },
      ],
      references: [
        {
          id: "range_ref",
          source: {
            ref: "Sheet1!A1:B2",
            sourceId: "source_1",
            type: "workbook_range",
          },
        },
      ],
      responseFields: [],
      schemaVersion: 2,
    };
    const usage = getReferenceUsageLocations(model).get("range_ref")?.[0];
    if (!usage) {
      throw new Error("Expected nested table rich text usage.");
    }
    expect(usage).toMatchObject({
      blockId: "table_1",
      cellId: "cell_1",
      richNodePath: [0],
      type: "table_content_cell",
    });

    const updated = removeReferenceUsageFromComposedEditorModel({
      model,
      referenceId: "range_ref",
      usage,
    });
    expect(getReferenceUsageLocations(updated).has("range_ref")).toBe(false);
  });

  it("reports a partial range when a used offset is missing", () => {
    const model = modelWithRangeCellUsage({ columnOffset: 1, rowOffset: 0 });

    expect(
      getReferenceIntegrityIssues({
        model,
        sources: [availableSource("source_1", ["Sheet1!A1"])],
      }),
    ).toMatchObject([
      {
        code: "inserted_value_unavailable",
        referenceId: "range_ref",
      },
    ]);
  });

  it("accepts a complete range for whole-range usage", () => {
    const model = modelWithWholeRangeUsage();

    expect(
      getReferenceIntegrityIssues({
        model,
        sources: [
          availableSource("source_1", [
            "Sheet1!A1",
            "Sheet1!B1",
            "Sheet1!A2",
            "Sheet1!B2",
          ]),
        ],
      }),
    ).toEqual([]);
  });

  it("does not treat a partial whole range as available", () => {
    const model = modelWithWholeRangeUsage();

    expect(
      getReferenceIntegrityIssues({
        model,
        sources: [availableSource("source_1", ["Sheet1!A1", "Sheet1!B1"])],
      }),
    ).toMatchObject([
      {
        code: "inserted_value_unavailable",
        referenceId: "range_ref",
      },
    ]);
  });

  it("reports out-of-range range cell usage as unavailable", () => {
    const model = modelWithRangeCellUsage({ columnOffset: 3, rowOffset: 0 });

    expect(
      getReferenceIntegrityIssues({
        model,
        sources: [
          availableSource("source_1", [
            "Sheet1!A1",
            "Sheet1!B1",
            "Sheet1!A2",
            "Sheet1!B2",
          ]),
        ],
      }),
    ).toMatchObject([
      {
        code: "inserted_value_unavailable",
        referenceId: "range_ref",
      },
    ]);
  });

  it("reports negative range cell row offsets as unavailable", () => {
    const model = modelWithRangeCellUsage({ columnOffset: 0, rowOffset: -1 });

    expect(
      getReferenceIntegrityIssues({
        model,
        sources: [availableSource("source_1", ["Sheet1!A1"])],
      }),
    ).toMatchObject([{ code: "inserted_value_unavailable" }]);
  });

  it("reports negative range cell column offsets as unavailable", () => {
    const model = modelWithRangeCellUsage({ columnOffset: -1, rowOffset: 0 });

    expect(
      getReferenceIntegrityIssues({
        model,
        sources: [availableSource("source_1", ["Sheet1!A1"])],
      }),
    ).toMatchObject([{ code: "inserted_value_unavailable" }]);
  });

  it("accepts range cell usage at the start and end of a range", () => {
    expect(
      getReferenceIntegrityIssues({
        model: modelWithRangeCellUsage({ columnOffset: 0, rowOffset: 0 }),
        sources: [availableSource("source_1", ["Sheet1!A1"])],
      }),
    ).toEqual([]);
    expect(
      getReferenceIntegrityIssues({
        model: modelWithRangeCellUsage({ columnOffset: 1, rowOffset: 1 }),
        sources: [availableSource("source_1", ["Sheet1!B2"])],
      }),
    ).toEqual([]);
  });

  it("covers table cells created from range-backed references", () => {
    const model = modelWithTableRangeCells();

    expect(
      getReferenceIntegrityIssues({
        model,
        sources: [availableSource("source_1", ["Sheet1!A1"])],
      }),
    ).toMatchObject([
      {
        code: "inserted_value_unavailable",
        referenceId: "range_ref",
        locations: [
          expect.objectContaining({
            cellId: "content_cell",
            type: "table_content_cell",
          }),
          expect.objectContaining({
            cellId: "answer_cell",
            type: "table_answer_cell",
          }),
        ],
      },
    ]);
  });

  it("reports unknown and checking workbook states without calling them unavailable", () => {
    const model = modelWithWholeRangeUsage();

    expect(
      getReferenceIntegrityIssues({
        model,
        sources: [sourceWithStatus("source_1", "unknown")],
      }),
    ).toMatchObject([{ code: "inserted_value_checking" }]);
    expect(
      getReferenceIntegrityIssues({
        model,
        sources: [sourceWithStatus("source_1", "checking")],
      }),
    ).toMatchObject([{ code: "inserted_value_checking" }]);
  });

  it("removes inline inserted values and turns answer references into static values", () => {
    const model = modelWithAllUsageLocations();
    const issue = getReferenceIntegrityIssues({
      model,
      sources: [sourceWithStatus("source_1", "unavailable")],
    })[0];

    if (!issue) {
      throw new Error("Expected an integrity issue.");
    }

    const resolved = issue.locations.reduce(
      (currentModel, usage) =>
        removeReferenceUsageFromComposedEditorModel({
          model: currentModel,
          referenceId: issue.referenceId,
          usage,
        }),
      model,
    );

    expect(
      getReferenceUsageLocations(resolved).get("range_ref"),
    ).toBeUndefined();
  });

  it("removes only one repeated text occurrence", () => {
    const model = modelWithRepeatedTextReferences();
    const usage = getReferenceUsageLocations(model).get("range_ref")?.[0];

    if (!usage) {
      throw new Error("Expected a usage.");
    }

    const resolved = removeReferenceUsageFromComposedEditorModel({
      model,
      referenceId: "range_ref",
      usage,
    });

    expect(getTextBlockContent(resolved, "text_1")).toEqual([
      { referenceId: "range_ref", type: "reference" },
    ]);
  });

  it("removes only one repeated rich text occurrence", () => {
    const model = modelWithRepeatedRichTextReferences();
    const usage = getReferenceUsageLocations(model).get("range_ref")?.[1];

    if (!usage) {
      throw new Error("Expected a usage.");
    }

    const resolved = removeReferenceUsageFromComposedEditorModel({
      model,
      referenceId: "range_ref",
      usage,
    });

    expect(getReferenceUsageLocations(resolved).get("range_ref")).toHaveLength(
      1,
    );
    expect(
      getReferenceUsageLocations(resolved).get("range_ref")?.[0],
    ).toMatchObject({
      richNodePath: [0],
      type: "rich_text_block",
    });
  });

  it("removes only one repeated table content cell occurrence", () => {
    const model = modelWithRepeatedTableContentReferences();
    const usage = getReferenceUsageLocations(model).get("range_ref")?.[0];

    if (!usage) {
      throw new Error("Expected a usage.");
    }

    const resolved = removeReferenceUsageFromComposedEditorModel({
      model,
      referenceId: "range_ref",
      usage,
    });

    expect(getTableContentCellContent(resolved, "content_cell")).toEqual([
      { referenceId: "range_ref", type: "reference" },
    ]);
  });

  it("removes a table content reference from only the targeted primitive", () => {
    const model = modelWithMultipleReferencedTableTextPrimitives();
    const usage = getReferenceUsageLocations(model)
      .get("range_ref")
      ?.find((item) => item.type === "table_content_cell");

    if (usage?.type !== "table_content_cell") {
      throw new Error("Expected a table content usage.");
    }

    const resolved = removeReferenceUsageFromComposedEditorModel({
      model,
      referenceId: "range_ref",
      usage,
    });

    expect(
      getTableContentCellBlockContent(resolved, "content_cell", "table_text_1"),
    ).toEqual([]);
    expect(
      getTableContentCellBlockContent(resolved, "content_cell", "table_text_2"),
    ).toEqual([{ referenceId: "range_ref", type: "reference" }]);
  });

  it("removes only one repeated range cell occurrence with the same offset", () => {
    const rangeCell = { columnOffset: 1, rowOffset: 0 };
    const model = modelWithRepeatedTextReferences(rangeCell);
    const usage = getReferenceUsageLocations(model).get("range_ref")?.[0];

    if (!usage) {
      throw new Error("Expected a usage.");
    }

    const resolved = removeReferenceUsageFromComposedEditorModel({
      model,
      referenceId: "range_ref",
      usage,
    });

    expect(getTextBlockContent(resolved, "text_1")).toEqual([
      { rangeCell, referenceId: "range_ref", type: "reference" },
    ]);
  });
});

function modelWithAllUsageLocations(): ComposedEditorModel {
  return {
    blocks: [
      {
        content: [{ referenceId: "range_ref", type: "reference" }],
        id: "text_1",
        type: "text",
      },
      {
        content: richContentFromInlineContent([
          { referenceId: "range_ref", type: "reference" },
        ]),
        id: "rich_text_1",
        type: "rich_text",
      },
      {
        correctValueSource: { referenceId: "range_ref", type: "reference" },
        grading: { mode: "exact" },
        id: "response_1",
        points: 1,
        responseFieldId: "answer_1",
        type: "response",
      },
      createTableBlock("table_1", {
        cells: [
          {
            blocks: [
              {
                content: [{ referenceId: "range_ref", type: "reference" }],
                id: "table_text_1",
                type: "text",
              },
            ],
            columnId: "column_1",
            id: "content_cell",
            rowId: "row_1",
          },
          {
            blocks: [
              {
                correctValueSource: {
                  referenceId: "range_ref",
                  type: "reference",
                },
                grading: { mode: "exact" },
                id: "table_input_1",
                points: 1,
                responseFieldId: "answer_2",
                type: "input",
              },
            ],
            columnId: "column_2",
            id: "answer_cell",
            rowId: "row_1",
          },
        ],
        columns: [
          { id: "column_1", label: "Column 1" },
          { id: "column_2", label: "Column 2" },
        ],
        prompt: "",
        responseFields: [
          { id: "answer_2", label: "Answer", required: true, type: "number" },
        ],
        rows: [{ id: "row_1", label: "Row 1" }],
        showColumnNames: true,
        showRowNames: true,
      }),
    ],
    references: [
      {
        id: "range_ref",
        source: {
          ref: "Sheet1!A1:B2",
          sourceId: "source_1",
          type: "workbook_range",
        },
      },
    ],
    responseFields: [{ id: "answer_1", label: "Answer", type: "number" }],
    schemaVersion: 2,
  };
}

function modelWithWholeRangeUsage(): ComposedEditorModel {
  return {
    ...modelWithAllUsageLocations(),
    blocks: [
      {
        correctValueSource: { referenceId: "range_ref", type: "reference" },
        grading: { mode: "exact" },
        id: "response_1",
        points: 1,
        responseFieldId: "answer_1",
        type: "response",
      },
    ],
    responseFields: [{ id: "answer_1", label: "Answer", type: "number" }],
  };
}

function modelWithRangeCellUsage(rangeCell: {
  rowOffset: number;
  columnOffset: number;
}): ComposedEditorModel {
  return {
    ...modelWithAllUsageLocations(),
    blocks: [
      {
        content: [{ rangeCell, referenceId: "range_ref", type: "reference" }],
        id: "text_1",
        type: "text",
      },
    ],
    responseFields: [],
  };
}

function modelWithRepeatedTextReferences(rangeCell?: {
  rowOffset: number;
  columnOffset: number;
}): ComposedEditorModel {
  return {
    ...modelWithAllUsageLocations(),
    blocks: [
      {
        content: [
          {
            ...(rangeCell ? { rangeCell } : {}),
            referenceId: "range_ref",
            type: "reference",
          },
          {
            ...(rangeCell ? { rangeCell } : {}),
            referenceId: "range_ref",
            type: "reference",
          },
        ],
        id: "text_1",
        type: "text",
      },
    ],
    responseFields: [],
  };
}

function modelWithRepeatedRichTextReferences(): ComposedEditorModel {
  return {
    ...modelWithAllUsageLocations(),
    blocks: [
      {
        content: {
          content: [
            {
              content: [{ referenceId: "range_ref", type: "reference" }],
              type: "paragraph",
            },
            {
              items: [
                {
                  content: [
                    {
                      content: [
                        { referenceId: "range_ref", type: "reference" },
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
    ],
    responseFields: [],
  };
}

function modelWithRepeatedTableContentReferences(): ComposedEditorModel {
  return {
    ...modelWithAllUsageLocations(),
    blocks: [
      createTableBlock("table_1", {
        cells: [
          {
            blocks: [
              {
                content: [
                  { referenceId: "range_ref", type: "reference" },
                  { referenceId: "range_ref", type: "reference" },
                ],
                id: "table_text_1",
                type: "text",
              },
            ],
            columnId: "column_1",
            id: "content_cell",
            rowId: "row_1",
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
    responseFields: [],
  };
}

function modelWithMultipleReferencedTableTextPrimitives(): ComposedEditorModel {
  return {
    ...modelWithAllUsageLocations(),
    blocks: [
      createTableBlock("table_1", {
        cells: [
          {
            blocks: [
              {
                content: [{ referenceId: "range_ref", type: "reference" }],
                id: "table_text_1",
                type: "text",
              },
              {
                content: [{ referenceId: "range_ref", type: "reference" }],
                id: "table_text_2",
                type: "text",
              },
            ],
            columnId: "column_1",
            id: "content_cell",
            rowId: "row_1",
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
    responseFields: [],
  };
}

function modelWithTableRangeCells(): ComposedEditorModel {
  return {
    ...modelWithAllUsageLocations(),
    blocks: [
      createTableBlock("table_1", {
        cells: [
          {
            blocks: [
              {
                content: [
                  {
                    rangeCell: { columnOffset: 1, rowOffset: 0 },
                    referenceId: "range_ref",
                    type: "reference",
                  },
                ],
                id: "table_text_1",
                type: "text",
              },
            ],
            columnId: "column_1",
            id: "content_cell",
            rowId: "row_1",
          },
          {
            blocks: [
              {
                correctValueSource: {
                  referenceId: "range_ref",
                  type: "reference",
                },
                grading: { mode: "exact" },
                id: "table_input_1",
                points: 1,
                responseFieldId: "answer_1",
                type: "input",
              },
            ],
            columnId: "column_2",
            id: "answer_cell",
            rowId: "row_1",
          },
        ],
        columns: [
          { id: "column_1", label: "Column 1" },
          { id: "column_2", label: "Column 2" },
        ],
        prompt: "",
        responseFields: [
          { id: "answer_1", label: "Answer", required: true, type: "number" },
        ],
        rows: [{ id: "row_1", label: "Row 1" }],
        showColumnNames: true,
        showRowNames: true,
      }),
    ],
    responseFields: [],
  };
}

function getTextBlockContent(model: ComposedEditorModel, blockId: string) {
  const block = model.blocks.find(
    (candidate) => candidate.id === blockId && candidate.type === "text",
  );
  return block?.type === "text" ? block.content : [];
}

function getTableContentCellContent(
  model: ComposedEditorModel,
  cellId: string,
) {
  const table = model.blocks.find((block) => block.type === "table");
  if (table?.type !== "table") {
    return [];
  }
  const cell = table.table.cells.find((candidate) => candidate.id === cellId);
  return cell
    ? (getTableCellPrimitiveBlocks(cell).find((block) => block.type === "text")
        ?.content ?? [])
    : [];
}

function getTableContentCellBlockContent(
  model: ComposedEditorModel,
  cellId: string,
  cellBlockId: string,
) {
  const table = model.blocks.find((block) => block.type === "table");
  if (table?.type !== "table") {
    return [];
  }
  const cell = table.table.cells.find((candidate) => candidate.id === cellId);
  if (!cell) {
    return [];
  }
  const block = getTableCellPrimitiveBlocks(cell).find(
    (candidate) => candidate.id === cellBlockId,
  );
  return block?.type === "text" ? block.content : [];
}

function availableSource(
  sourceId: string,
  refs: readonly string[],
): ReferenceIntegrityWorkbookSource {
  const cells = new Set(
    refs.map((ref) => {
      const parsed = parseWorkbookRef(ref);
      if (!parsed) {
        throw new Error(`Invalid test ref: ${ref}`);
      }
      return cellKey({
        columnIndex: parsed.startColumnIndex,
        rowIndex: parsed.startRowIndex,
        sheetName: parsed.sheetName,
      });
    }),
  );

  return {
    availability: {
      hasCell: (address) => cells.has(cellKey(address)),
      status: "available",
    },
    sourceId,
    type: "workbook",
  };
}

function sourceWithStatus(
  sourceId: string,
  status: "unavailable" | "unknown" | "checking",
): ReferenceIntegrityWorkbookSource {
  return {
    availability: { status },
    sourceId,
    type: "workbook",
  };
}

function cellKey(input: {
  sheetName: string;
  rowIndex: number;
  columnIndex: number;
}) {
  return `${input.sheetName}:${input.rowIndex}:${input.columnIndex}`;
}
