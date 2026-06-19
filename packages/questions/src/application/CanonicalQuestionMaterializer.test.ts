import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { JsonValue } from "@lemma/domain";
import {
  type QuestionReferenceSource,
  questionBlueprintDocument,
  type WorkbookSnapshotId,
} from "../domain/index.js";
import { CanonicalQuestionMaterializer } from "./CanonicalQuestionMaterializer.js";

const workbookSnapshotId =
  "019e9315-6a87-715f-9861-8654df070c4c" as WorkbookSnapshotId;
const secondWorkbookSnapshotId =
  "019e9315-6a87-715f-9861-8654df070c4d" as WorkbookSnapshotId;

describe("CanonicalQuestionMaterializer", () => {
  it("freezes literal and workbook references into body, solution, and source plan", async () => {
    const resolvedSources: QuestionReferenceSource[] = [];
    const materializer = new CanonicalQuestionMaterializer({
      async resolveReference({ source }): Promise<JsonValue> {
        resolvedSources.push(source);
        return source.type === "workbook_range" ? [["1200"]] : 1200;
      },
    });
    const document = questionBlueprintDocument({
      schemaVersion: 1,
      references: [
        {
          id: "label",
          source: { schemaVersion: 1, type: "literal", value: "Revenue" },
        },
        {
          id: "revenue",
          source: {
            schemaVersion: 1,
            type: "workbook_cell",
            sourceId: "source_1",
            ref: "Sheet1!A1",
          },
        },
        {
          id: "revenue_range",
          source: {
            schemaVersion: 1,
            type: "workbook_range",
            sourceId: "source_1",
            ref: "Sheet1!A1:A2",
          },
        },
      ],
      responseFields: [{ id: "answer", type: "number" }],
      blocks: [
        {
          id: "prompt",
          type: "text",
          content: [
            { type: "reference", referenceId: "label" },
            { type: "text", text: ": " },
            { type: "reference", referenceId: "revenue" },
          ],
        },
        {
          id: "answer",
          type: "response",
          responseFieldId: "answer",
          correctValueSource: {
            schemaVersion: 1,
            type: "reference",
            referenceId: "revenue",
          },
          points: 1,
          grading: { mode: "exact" },
        },
      ],
    });

    const result = await materializer.materialize({
      document,
      workbookSnapshotId,
    });

    assert.deepEqual(
      resolvedSources.map((source) => source.type),
      ["workbook_cell", "workbook_range"],
    );
    assert.deepEqual(result.body.blocks[0], {
      id: "prompt",
      type: "text",
      content: [
        { type: "value", referenceId: "label", displayValue: "Revenue" },
        { type: "text", text: ": " },
        { type: "value", referenceId: "revenue", displayValue: "1200" },
      ],
    });
    assert.deepEqual(result.solution.rules[0], {
      type: "exact",
      responseFieldId: "answer",
      correctValue: 1200,
      points: 1,
    });
    assert.deepEqual(
      result.sourcePlan.references.map((reference) => ({
        id: reference.id,
        resolved: reference.resolved,
      })),
      [
        { id: "label", resolved: true },
        { id: "revenue", resolved: true },
        { id: "revenue_range", resolved: true },
      ],
    );
  });

  it("renders range cell inline references from a workbook range value", async () => {
    const materializer = new CanonicalQuestionMaterializer({
      async resolveReference(): Promise<JsonValue> {
        return [
          ["A1", "B1"],
          ["A2", "B2"],
        ];
      },
    });
    const document = questionBlueprintDocument({
      schemaVersion: 1,
      references: [
        {
          id: "range",
          source: {
            schemaVersion: 1,
            type: "workbook_range",
            sourceId: "source_1",
            ref: "Sheet1!A1:B2",
          },
        },
      ],
      responseFields: [],
      blocks: [
        {
          id: "table",
          type: "table",
          showColumnNames: true,
          showRowNames: true,
          columns: [{ id: "column_1", label: "Column 1" }],
          rows: [{ id: "row_1", label: "Row 1" }],
          cells: [
            {
              id: "cell_1_1",
              rowId: "row_1",
              columnId: "column_1",
              type: "content",
              content: [
                {
                  type: "reference",
                  referenceId: "range",
                  rangeCell: { rowOffset: 1, columnOffset: 0 },
                  fallbackText: "fallback",
                },
              ],
            },
          ],
        },
      ],
    });

    const result = await materializer.materialize({
      document,
      workbookSnapshotId,
    });

    assert.deepEqual(result.body.blocks[0], {
      id: "table",
      type: "table",
      showColumnNames: true,
      showRowNames: true,
      columns: [{ id: "column_1", label: "Column 1" }],
      rows: [{ id: "row_1", label: "Row 1" }],
      cells: [
        {
          id: "cell_1_1",
          rowId: "row_1",
          columnId: "column_1",
          type: "content",
          text: "A2",
        },
      ],
    });
  });

  it("resolves workbook references with the snapshot for their source", async () => {
    const resolvedSnapshotIds: (WorkbookSnapshotId | null | undefined)[] = [];
    const materializer = new CanonicalQuestionMaterializer({
      async resolveReference({ workbookSnapshotId }): Promise<JsonValue> {
        resolvedSnapshotIds.push(workbookSnapshotId);
        return workbookSnapshotId === secondWorkbookSnapshotId ? 2400 : 1200;
      },
    });
    const document = questionBlueprintDocument({
      schemaVersion: 1,
      references: [
        {
          id: "primary",
          source: {
            schemaVersion: 1,
            type: "workbook_cell",
            sourceId: "source_1",
            ref: "Sheet1!A1",
          },
        },
        {
          id: "secondary",
          source: {
            schemaVersion: 1,
            type: "workbook_cell",
            sourceId: "source_2",
            ref: "Sheet1!A1",
          },
        },
      ],
      responseFields: [],
      blocks: [
        {
          id: "prompt",
          type: "text",
          content: [
            { type: "reference", referenceId: "primary" },
            { type: "text", text: "/" },
            { type: "reference", referenceId: "secondary" },
          ],
        },
      ],
    });

    const result = await materializer.materialize({
      document,
      workbookSnapshotId,
      workbookSnapshotIdsBySourceId: new Map([
        ["source_1", workbookSnapshotId],
        ["source_2", secondWorkbookSnapshotId],
      ]),
    });

    assert.deepEqual(resolvedSnapshotIds, [
      workbookSnapshotId,
      secondWorkbookSnapshotId,
    ]);
    assert.deepEqual(result.body.blocks[0], {
      id: "prompt",
      type: "text",
      content: [
        { type: "value", referenceId: "primary", displayValue: "1200" },
        { type: "text", text: "/" },
        { type: "value", referenceId: "secondary", displayValue: "2400" },
      ],
    });
  });
});
