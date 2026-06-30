// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { LocalWorkbookParseResult } from "#/domains/workbooks/local-xlsx";
import type { StudioWorkbookSource } from "./source/studio-source-model";
import { useReferencePreviewController } from "./use-reference-preview-controller";

describe("useReferencePreviewController", () => {
  it("uses parsed local workbooks and ignores unavailable workbook states", () => {
    const model = createModel();

    const { result } = renderHook(() =>
      useReferencePreviewController({
        model,
        sources: [
          localSource("source_1", parsedWorkbook()),
          restoringSource("source_2"),
          missingSource("source_3"),
          persistedSource("source_4"),
        ],
      }),
    );

    expect(result.current.referencePreviewCache.ref_1).toEqual(
      expect.objectContaining({
        displayValue: "42",
        rawValue: "42",
        status: "resolved",
      }),
    );
    expect(result.current.referencePreviewCache.ref_2).toEqual(
      expect.objectContaining({ status: "missing_source" }),
    );
    expect(result.current.referencePreviewCache.ref_3).toEqual(
      expect.objectContaining({ status: "missing_source" }),
    );
    expect(result.current.referencePreviewCache.ref_4).toEqual(
      expect.objectContaining({ status: "missing_source" }),
    );
  });
});

function createModel(): ComposedEditorModel {
  return {
    blocks: [],
    references: [
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
          ref: "Sheet1!A1",
          sourceId: "source_2",
          type: "workbook_cell",
        },
      },
      {
        id: "ref_3",
        source: {
          ref: "Sheet1!A1",
          sourceId: "source_3",
          type: "workbook_cell",
        },
      },
      {
        id: "ref_4",
        source: {
          ref: "Sheet1!A1",
          sourceId: "source_4",
          type: "workbook_cell",
        },
      },
    ],
    responseFields: [],
    schemaVersion: 2,
  };
}

function parsedWorkbook(): LocalWorkbookParseResult {
  return {
    byteSize: 4,
    cellsByKey: new Map([
      [
        "Sheet1::A1",
        {
          address: "A1",
          displayValue: "42",
          formula: null,
          hasCachedValue: true,
          rawValue: 42,
          sheetName: "Sheet1",
          type: "number",
        },
      ],
    ]),
    fileName: "source.xlsx",
    parsedAt: new Date("2026-06-21T00:00:00.000Z"),
    sheetCount: 1,
    sheets: [
      { columnCount: 1, name: "Sheet1", rowCount: 1, usedRange: "Sheet1!A1" },
    ],
  };
}

function localSource(
  sourceId: string,
  workbook: LocalWorkbookParseResult,
): StudioWorkbookSource {
  return {
    backing: {
      byteSize: 4,
      file: new File(["test"], `${sourceId}.xlsx`),
      kind: "local_file",
      lastModified: 1,
      originalName: `${sourceId}.xlsx`,
      parsedWorkbook: workbook,
      parseError: null,
      parseStatus: "parsed",
      uploadError: null,
      uploadStatus: "not_uploaded",
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: sourceId,
    sourceId,
    type: "workbook",
  };
}

function restoringSource(sourceId: string): StudioWorkbookSource {
  return {
    backing: {
      byteSize: 4,
      kind: "restoring_local_file",
      lastModified: 1,
      originalName: `${sourceId}.xlsx`,
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: sourceId,
    sourceId,
    type: "workbook",
  };
}

function missingSource(sourceId: string): StudioWorkbookSource {
  return {
    backing: {
      byteSize: 4,
      kind: "missing_local_file",
      lastModified: 1,
      originalName: `${sourceId}.xlsx`,
      parseError: "Workbook file missing. Reattach the file to continue.",
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: sourceId,
    sourceId,
    type: "workbook",
  };
}

function persistedSource(sourceId: string): StudioWorkbookSource {
  return {
    backing: {
      byteSize: null,
      kind: "persisted_workbook",
      originalName: `${sourceId}.xlsx`,
      parsedWorkbook: null,
      workbookId: `workbook_${sourceId}`,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: sourceId,
    sourceId,
    type: "workbook",
  };
}
