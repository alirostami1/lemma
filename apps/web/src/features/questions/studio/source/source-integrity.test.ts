import { describe, expect, it } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  createLocalWorkbookCellKey,
  type LocalWorkbookCellValue,
  type LocalWorkbookParseResult,
} from "#/domains/workbooks/local-xlsx";
import {
  getStudioSourceIntegrityIssues,
  getUnavailableUsedReferenceIdsForParsedWorkbookReplacement,
} from "./source-integrity";
import type { StudioWorkbookSource } from "./studio-source-model";

describe("source integrity", () => {
  it("reports used inserted values when a local workbook is unavailable", () => {
    expect(
      getStudioSourceIntegrityIssues({
        model: modelWithWorkbookReference("ref_1", "source_1", "Sheet1!A1"),
        sources: [missingSource("source_1")],
      }),
    ).toMatchObject([
      {
        code: "inserted_value_unavailable",
        referenceId: "ref_1",
      },
    ]);
  });

  it("ignores unavailable workbook values that are not inserted", () => {
    expect(
      getStudioSourceIntegrityIssues({
        model: modelWithWorkbookReference("ref_1", "source_1", "Sheet1!A1", {
          blocks: [
            {
              content: [{ text: "Static", type: "text" }],
              id: "text_1",
              type: "text",
            },
          ],
        }),
        sources: [missingSource("source_1")],
      }),
    ).toEqual([]);
  });

  it("detects used values missing from a parsed workbook", () => {
    expect(
      getUnavailableUsedReferenceIdsForParsedWorkbookReplacement({
        model: modelWithWorkbookReference("ref_1", "source_1", "Sheet1!B2"),
        sourceId: "source_1",
        workbook: workbookWithCell("Sheet1", "A1", "Alpha"),
      }),
    ).toEqual(["ref_1"]);
  });

  it("accepts used values present in a parsed workbook", () => {
    expect(
      getUnavailableUsedReferenceIdsForParsedWorkbookReplacement({
        model: modelWithWorkbookReference("ref_1", "source_1", "Sheet1!A1"),
        sourceId: "source_1",
        workbook: workbookWithCell("Sheet1", "A1", "Alpha"),
      }),
    ).toEqual([]);
  });

  it("maps draft file states into checking, unavailable, and available issues", () => {
    const model = modelWithWorkbookReference("ref_1", "source_1", "Sheet1!A1");

    expect(
      getStudioSourceIntegrityIssues({
        model,
        sources: [draftFileSource("source_1", "idle", null)],
      }),
    ).toMatchObject([{ code: "inserted_value_checking" }]);
    expect(
      getStudioSourceIntegrityIssues({
        model,
        sources: [draftFileSource("source_1", "loading", null)],
      }),
    ).toMatchObject([{ code: "inserted_value_checking" }]);
    expect(
      getStudioSourceIntegrityIssues({
        model,
        sources: [draftFileSource("source_1", "failed", null)],
      }),
    ).toMatchObject([{ code: "inserted_value_unavailable" }]);
    expect(
      getStudioSourceIntegrityIssues({
        model,
        sources: [
          draftFileSource(
            "source_1",
            "loaded",
            workbookWithCell("Sheet1", "A1", "Alpha"),
          ),
        ],
      }),
    ).toEqual([]);
  });
});

function modelWithWorkbookReference(
  referenceId: string,
  sourceId: string,
  ref: string,
  overrides: Partial<ComposedEditorModel> = {},
): ComposedEditorModel {
  return {
    blocks: [
      {
        content: [{ referenceId, type: "reference" }],
        id: "text_1",
        type: "text",
      },
    ],
    ...overrides,
    references: [
      {
        id: referenceId,
        source: {
          ref,
          sourceId,
          type: "workbook_cell",
        },
      },
    ],
    responseFields: [],
    schemaVersion: 2,
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

function draftFileSource(
  sourceId: string,
  previewStatus: "idle" | "loading" | "loaded" | "failed",
  parsedWorkbook: LocalWorkbookParseResult | null,
): StudioWorkbookSource {
  return {
    backing: {
      byteSize: 4,
      checksumSha256: "checksum-1",
      fileId: "file-1",
      kind: "draft_file",
      originalName: `${sourceId}.xlsx`,
      parsedWorkbook,
      previewError: previewStatus === "failed" ? "Failed" : null,
      previewStatus,
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: sourceId,
    sourceId,
    type: "workbook",
  };
}

function workbookWithCell(
  sheetName: string,
  address: string,
  displayValue: string,
): LocalWorkbookParseResult {
  const cell: LocalWorkbookCellValue = {
    address,
    displayValue,
    formula: null,
    hasCachedValue: true,
    rawValue: displayValue,
    sheetName,
    type: "string",
  };

  return {
    byteSize: 4,
    cellsByKey: new Map([
      [createLocalWorkbookCellKey(sheetName, address), cell],
    ]),
    fileName: "source.xlsx",
    parsedAt: new Date("2026-06-21T00:00:00.000Z"),
    sheetCount: 1,
    sheets: [
      {
        columnCount: 1,
        name: sheetName,
        rowCount: 1,
        usedRange: `${sheetName}!${address}`,
      },
    ],
  };
}
