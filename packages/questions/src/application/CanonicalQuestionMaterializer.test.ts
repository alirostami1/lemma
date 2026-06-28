import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { JsonValue } from "@lemma/domain";
import {
  type QuestionReferenceSource,
  questionBlueprintDocument,
  sourceArtifactId,
  sourceDocumentId,
  sourceRevisionId,
  type WorkbookCalculationId,
  type WorkbookId,
  type WorkbookSnapshotId,
} from "../domain/index.js";
import { CanonicalQuestionMaterializer } from "./CanonicalQuestionMaterializer.js";
import type { WorkbookSnapshotForQuestionGeneration } from "./ports.js";

const workbookSnapshotId =
  "019e9315-6a87-715f-9861-8654df070c4c" as WorkbookSnapshotId;
const secondWorkbookSnapshotId =
  "019e9315-6a87-715f-9861-8654df070c4d" as WorkbookSnapshotId;
const workbookId = "019e9315-6a87-715f-9861-8654df070c4e" as WorkbookId;
const secondWorkbookId = "019e9315-6a87-715f-9861-8654df070c4f" as WorkbookId;
const firstSourceDocumentId = sourceDocumentId(
  "019e9315-6a87-715f-9861-8654df070c52",
);
const firstSourceRevisionId = sourceRevisionId(
  "019e9315-6a87-715f-9861-8654df070c53",
);
const firstSourceArtifactId = sourceArtifactId(
  "019e9315-6a87-715f-9861-8654df070c54",
);
const secondSourceDocumentId = sourceDocumentId(
  "019e9315-6a87-715f-9861-8654df070c55",
);
const secondSourceRevisionId = sourceRevisionId(
  "019e9315-6a87-715f-9861-8654df070c56",
);
const secondSourceArtifactId = sourceArtifactId(
  "019e9315-6a87-715f-9861-8654df070c57",
);
const generationRunId = "019e9315-6a87-715f-9861-8654df070c50";
const workbookCalculationId =
  "019e9315-6a87-715f-9861-8654df070c51" as WorkbookCalculationId;
const sourceLineageBySourceId = new Map<
  string,
  WorkbookSnapshotForQuestionGeneration
>([
  [
    "source_1",
    {
      calculationId: workbookCalculationId,
      id: workbookSnapshotId,
      questionIndex: 0,
      snapshotIndex: 0,
      sourceId: "source_1",
      workbookId,
    },
  ],
  [
    "source_2",
    {
      calculationId: workbookCalculationId,
      id: secondWorkbookSnapshotId,
      questionIndex: 0,
      snapshotIndex: 1,
      sourceId: "source_2",
      workbookId: secondWorkbookId,
    },
  ],
]);

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
      blocks: [
        {
          content: [
            { referenceId: "label", type: "reference" },
            { text: ": ", type: "text" },
            {
              referenceId: "workbook:source_1:cell:Sheet1:A1",
              type: "reference",
            },
          ],
          id: "prompt",
          type: "text",
        },
        {
          correctValueSource: {
            referenceId: "workbook:source_1:cell:Sheet1:A1",
            schemaVersion: 1,
            type: "reference",
          },
          grading: { mode: "exact" },
          id: "answer",
          points: 1,
          responseFieldId: "answer",
          type: "response",
        },
      ],
      references: [
        {
          id: "label",
          source: { schemaVersion: 1, type: "literal", value: "Revenue" },
        },
        {
          id: "workbook:source_1:cell:Sheet1:A1",
          source: {
            ref: "Sheet1!A1",
            schemaVersion: 1,
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
        {
          id: "workbook:source_1:range:Sheet1:A1:A2",
          source: {
            ref: "Sheet1!A1:A2",
            schemaVersion: 1,
            sourceId: "source_1",
            type: "workbook_range",
          },
        },
      ],
      responseFields: [{ id: "answer", type: "number" }],
      schemaVersion: 1,
    });

    const result = await materializer.materialize({
      document,
      generationRunId,
      questionIndex: 0,
      sourceLineageBySourceId,
      sources: [publishedWorkbookSource("source_1", "Source 1", workbookId)],
      workbookCalculationId,
    });

    assert.deepEqual(
      resolvedSources.map((source) => source.type),
      ["workbook_cell", "workbook_range"],
    );
    assert.deepEqual(result.body.blocks[0], {
      content: [
        { displayValue: "Revenue", referenceId: "label", type: "value" },
        { text: ": ", type: "text" },
        {
          displayValue: "1200",
          referenceId: "workbook:source_1:cell:Sheet1:A1",
          type: "value",
        },
      ],
      id: "prompt",
      type: "text",
    });
    assert.deepEqual(result.solution.rules[0], {
      correctValue: 1200,
      points: 1,
      responseFieldId: "answer",
      type: "exact",
    });
    assert.deepEqual(result.sourceEvidence.sources, [
      {
        questionIndex: 0,
        references: [
          "workbook:source_1:cell:Sheet1:A1",
          "workbook:source_1:range:Sheet1:A1:A2",
        ],
        snapshotIndex: 0,
        sourceId: "source_1",
        sourceName: "Source 1",
        workbookCalculationId,
        workbookId,
        workbookSnapshotId,
      },
    ]);
    assert.equal(
      "resolvedValue" in (result.sourceEvidence.sources[0] ?? {}),
      false,
    );
    assert.deepEqual(result.sourcePlan.references, [
      { referenceId: "label", value: "Revenue" },
      {
        ref: "Sheet1!A1",
        referenceId: "workbook:source_1:cell:Sheet1:A1",
        sourceId: "source_1",
        value: 1200,
        workbookSnapshotId,
      },
      {
        ref: "Sheet1!A1:A2",
        referenceId: "workbook:source_1:range:Sheet1:A1:A2",
        sourceId: "source_1",
        value: [["1200"]],
        workbookSnapshotId,
      },
    ]);
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
      blocks: [
        {
          cells: [
            {
              columnId: "column_1",
              content: [
                {
                  fallbackText: "fallback",
                  rangeCell: { columnOffset: 0, rowOffset: 1 },
                  referenceId: "workbook:source_1:range:Sheet1:A1:B2",
                  type: "reference",
                },
              ],
              id: "cell_1_1",
              rowId: "row_1",
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
      references: [
        {
          id: "workbook:source_1:range:Sheet1:A1:B2",
          source: {
            ref: "Sheet1!A1:B2",
            schemaVersion: 1,
            sourceId: "source_1",
            type: "workbook_range",
          },
        },
      ],
      responseFields: [],
      schemaVersion: 1,
    });

    const result = await materializer.materialize({
      document,
      generationRunId,
      questionIndex: 0,
      sourceLineageBySourceId,
      sources: [publishedWorkbookSource("source_1", "Source 1", workbookId)],
      workbookCalculationId,
    });

    assert.deepEqual(result.body.blocks[0], {
      cells: [
        {
          columnId: "column_1",
          id: "cell_1_1",
          rowId: "row_1",
          text: "A2",
          type: "content",
        },
      ],
      columns: [{ id: "column_1", label: "Column 1" }],
      id: "table",
      rows: [{ id: "row_1", label: "Row 1" }],
      showColumnNames: true,
      showRowNames: true,
      type: "table",
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
      blocks: [
        {
          content: [
            {
              referenceId: "workbook:source_1:cell:Sheet1:A1",
              type: "reference",
            },
            { text: "/", type: "text" },
            {
              referenceId: "workbook:source_2:cell:Sheet1:A1",
              type: "reference",
            },
          ],
          id: "prompt",
          type: "text",
        },
      ],
      references: [
        {
          id: "workbook:source_1:cell:Sheet1:A1",
          source: {
            ref: "Sheet1!A1",
            schemaVersion: 1,
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
        {
          id: "workbook:source_2:cell:Sheet1:A1",
          source: {
            ref: "Sheet1!A1",
            schemaVersion: 1,
            sourceId: "source_2",
            type: "workbook_cell",
          },
        },
      ],
      responseFields: [],
      schemaVersion: 1,
    });

    const result = await materializer.materialize({
      document,
      generationRunId,
      questionIndex: 0,
      sourceLineageBySourceId,
      sources: [
        publishedWorkbookSource("source_1", "Source 1", workbookId),
        publishedWorkbookSource("source_2", "Source 2", secondWorkbookId),
      ],
      workbookCalculationId,
    });

    assert.deepEqual(resolvedSnapshotIds, [
      workbookSnapshotId,
      secondWorkbookSnapshotId,
    ]);
    assert.deepEqual(result.body.blocks[0], {
      content: [
        {
          displayValue: "1200",
          referenceId: "workbook:source_1:cell:Sheet1:A1",
          type: "value",
        },
        { text: "/", type: "text" },
        {
          displayValue: "2400",
          referenceId: "workbook:source_2:cell:Sheet1:A1",
          type: "value",
        },
      ],
      id: "prompt",
      type: "text",
    });
  });
});

function publishedWorkbookSource(
  sourceId: string,
  name: string,
  sourceWorkbookId: WorkbookId,
) {
  const pins =
    sourceId === "source_1"
      ? {
          sourceArtifactId: firstSourceArtifactId,
          sourceDocumentId: firstSourceDocumentId,
          sourceRevisionId: firstSourceRevisionId,
        }
      : {
          sourceArtifactId: secondSourceArtifactId,
          sourceDocumentId: secondSourceDocumentId,
          sourceRevisionId: secondSourceRevisionId,
        };
  return {
    byteSize: 1234,
    checksumSha256:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    fileId: "019e9315-6a87-715f-9861-8654df070ca1",
    name,
    originalName: `${sourceId}.xlsx`,
    ...pins,
    sourceId,
    type: "workbook" as const,
    workbookId: sourceWorkbookId,
  };
}
