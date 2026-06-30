import { describe, expect, it } from "vitest";
import { createDefaultComposedEditorModel } from "#/domains/questions/authoring";
import {
  buildSourceUsageBySourceId,
  createNextSourceId,
  getSourceRemovalState,
  getUsedSourceIdsFromBlueprintDocument,
  getUsedSourceIdsFromComposedEditorModel,
} from "./source-usage";
import type { StudioWorkbookSource } from "./studio-source-model";

describe("source-usage", () => {
  it("collects used source ids from workbook references", () => {
    const used = getUsedSourceIdsFromBlueprintDocument({
      blocks: [],
      references: [
        {
          id: "ref_1",
          source: {
            ref: "Sheet1!A1",
            schemaVersion: 1,
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
        {
          id: "ref_2",
          source: {
            ref: "Sheet1!A1:A2",
            schemaVersion: 1,
            sourceId: "source_2",
            type: "workbook_range",
          },
        },
        {
          id: "ref_3",
          source: {
            ref: "Sheet1!A2",
            schemaVersion: 1,
            sourceId: "source_1",
            type: "workbook_cell",
          },
        },
      ],
      responseFields: [],
      schemaVersion: 2,
    });

    expect([...used]).toEqual(["source_1", "source_2"]);
  });

  it("derives used source ids from current authoring model", () => {
    const model = createDefaultComposedEditorModel();
    model.blocks = [
      {
        content: [
          { text: "Hello ", type: "text" },
          { referenceId: "ref_1", type: "reference" },
        ],
        id: "block_1",
        type: "text",
      },
    ];
    model.references = [
      {
        id: "ref_1",
        source: {
          ref: "Sheet1!A1",
          sourceId: "source_1",
          type: "workbook_cell",
        },
      },
      {
        id: "ref_2",
        source: {
          ref: "Sheet1!B1",
          sourceId: "source_2",
          type: "workbook_cell",
        },
      },
    ];

    expect([...getUsedSourceIdsFromComposedEditorModel(model)]).toEqual([
      "source_1",
    ]);
  });

  it("builds used where details for used references only", () => {
    const model = createDefaultComposedEditorModel();
    model.blocks = [
      {
        content: [{ referenceId: "ref_1", type: "reference" }],
        id: "block_1",
        type: "text",
      },
    ];
    model.references = [
      {
        id: "ref_1",
        source: {
          ref: "Sheet1!A1:B2",
          sourceId: "source_1",
          type: "workbook_range",
        },
      },
      {
        id: "ref_2",
        source: {
          ref: "Sheet1!C3",
          sourceId: "source_1",
          type: "workbook_cell",
        },
      },
    ];

    const usage = buildSourceUsageBySourceId({
      model,
      sources: [persistedSource("source_1"), persistedSource("source_2")],
    });

    expect(usage.get("source_1")).toEqual({
      isUsed: true,
      referenceCount: 1,
      removal: {
        reason:
          "This workbook is used by inserted values. Remove those values before detaching it.",
        removable: false,
      },
      sourceId: "source_1",
      usedWhere: [
        {
          kind: "block",
          label: "Text block 1",
          referenceId: "ref_1",
          referenceKind: "range",
          referenceName: "workbook:source_1:range:Sheet1:A1:B2",
          sourceRef: "Sheet1!A1:B2",
        },
      ],
    });
    expect(usage.get("source_2")).toEqual({
      isUsed: false,
      referenceCount: 0,
      removal: { removable: true },
      sourceId: "source_2",
      usedWhere: [],
    });
  });

  it("preserves multiple locations for the same workbook reference", () => {
    const model = createDefaultComposedEditorModel();
    model.blocks = [
      {
        content: [{ referenceId: "ref_1", type: "reference" }],
        id: "text_1",
        type: "text",
      },
      {
        content: {
          content: [
            {
              content: [{ referenceId: "ref_1", type: "reference" }],
              type: "paragraph",
            },
          ],
          type: "doc",
        },
        id: "rich_text_1",
        type: "rich_text",
      },
    ];
    model.references = [
      {
        id: "ref_1",
        source: {
          ref: "Sheet1!A1",
          sourceId: "source_1",
          type: "workbook_cell",
        },
      },
    ];

    const usage = buildSourceUsageBySourceId({
      model,
      sources: [persistedSource("source_1")],
    });

    expect(
      usage.get("source_1")?.usedWhere.map((entry) => entry.label),
    ).toEqual(["Text block 1", "Question block 1"]);
    expect(usage.get("source_1")?.referenceCount).toBe(1);
  });

  it("summarizes repeated same-reference occurrences in one text block as one used area", () => {
    const model = {
      ...createDefaultComposedEditorModel(),
      blocks: [
        {
          content: [
            { referenceId: "ref_1", type: "reference" as const },
            { text: " and ", type: "text" as const },
            { referenceId: "ref_1", type: "reference" as const },
          ],
          id: "text_1",
          type: "text" as const,
        },
      ],
      references: [
        {
          id: "ref_1",
          source: {
            ref: "Sheet1!A1",
            sourceId: "source_1",
            type: "workbook_cell" as const,
          },
        },
      ],
      responseFields: [],
    };

    const usage = buildSourceUsageBySourceId({
      model,
      sources: [persistedSource("source_1")],
    });

    expect(usage.get("source_1")?.usedWhere).toEqual([
      expect.objectContaining({
        label: "Text block 1",
        referenceId: "ref_1",
        sourceRef: "Sheet1!A1",
      }),
    ]);
  });

  it("blocks removal for used sources", () => {
    const usageBySourceId = new Map([
      [
        "source_1",
        {
          isUsed: true,
          referenceCount: 1,
          removal: {
            reason:
              "This workbook is used by inserted values. Remove those values before detaching it.",
            removable: false as const,
          },
          sourceId: "source_1",
          usedWhere: [],
        },
      ],
    ]);

    expect(
      getSourceRemovalState({
        sourceId: "source_1",
        usageBySourceId,
      }),
    ).toEqual({
      reason:
        "This workbook is used by inserted values. Remove those values before detaching it.",
      removable: false,
    });
  });

  it("allows removal for unused sources", () => {
    expect(
      getSourceRemovalState({
        sourceId: "source_2",
        usageBySourceId: new Map(),
      }),
    ).toEqual({ removable: true });
  });

  it("creates valid unique source ids", () => {
    expect(
      createNextSourceId({
        existingSources: [
          persistedSource("quarterly-report"),
          persistedSource("quarterly-report-2"),
        ],
        preferredName: "Quarterly Report",
        type: "workbook",
      }),
    ).toBe("quarterly-report-3");
    expect(
      createNextSourceId({
        existingSources: [],
        preferredName: "123 Source",
        type: "workbook",
      }),
    ).toBe("s-123-source");
  });
});

function persistedSource(sourceId: string): StudioWorkbookSource {
  return {
    backing: {
      byteSize: null,
      kind: "persisted_workbook",
      originalName: `${sourceId}.xlsx`,
      parsedWorkbook: null,
      workbookId: `${sourceId}-workbook`,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: sourceId,
    sourceId,
    type: "workbook",
  };
}
