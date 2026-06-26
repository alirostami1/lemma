import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalWorkbookParseResult } from "#/domains/workbooks/local-xlsx";
import {
  deserializeStudioSources,
  fromDraftSourceToStudioSource,
  hydrateStudioSourcesFromDraftAssets,
  MISSING_LOCAL_FILE_MESSAGE,
  type StudioWorkbookSource,
  serializeStudioSources,
} from "./studio-source-model";

const draftAssetMocks = vi.hoisted(() => ({
  readStudioDraftWorkbookFile: vi.fn(),
}));

const workbookParseMocks = vi.hoisted(() => ({
  parseLocalWorkbookFile: vi.fn(),
}));

vi.mock("../studio-draft-assets-store", () => ({
  readStudioDraftWorkbookFile: draftAssetMocks.readStudioDraftWorkbookFile,
}));

vi.mock("#/domains/workbooks/local-xlsx", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("#/domains/workbooks/local-xlsx")>();
  return {
    ...actual,
    parseLocalWorkbookFile: workbookParseMocks.parseLocalWorkbookFile,
  };
});

describe("studio-source-model", () => {
  beforeEach(() => {
    draftAssetMocks.readStudioDraftWorkbookFile.mockReset();
    workbookParseMocks.parseLocalWorkbookFile.mockReset();
  });

  it("serializes local file metadata without file contents", () => {
    const sources: StudioWorkbookSource[] = [
      {
        backing: {
          byteSize: 10,
          file: new File(["xlsx-bytes"], "budget.xlsx", {
            lastModified: 123,
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
          kind: "local_file",
          lastModified: 123,
          originalName: "budget.xlsx",
          parsedWorkbook: {
            byteSize: 10,
            cellsByKey: new Map([
              [
                "Sheet1!A1",
                {
                  address: "A1",
                  displayValue: "1200",
                  formula: null,
                  hasCachedValue: true,
                  rawValue: 1200,
                  sheetName: "Sheet1",
                  type: "number",
                },
              ],
            ]),
            fileName: "budget.xlsx",
            parsedAt: new Date("2026-06-21T00:00:00.000Z"),
            sheetCount: 1,
            sheets: [
              {
                columnCount: 1,
                name: "Sheet1",
                rowCount: 1,
                usedRange: "Sheet1!A1",
              },
            ],
          },
          parseError: null,
          parseStatus: "parsed",
          uploadError: null,
          uploadStatus: "not_uploaded",
          workbookId: null,
        },
        createdAt: new Date("2026-06-21T00:00:00.000Z"),
        name: "Budget",
        sourceId: "source_1",
        type: "workbook",
      },
    ];

    const serialized = serializeStudioSources(sources);

    expect(serialized).toEqual([
      {
        backing: {
          byteSize: 10,
          kind: "local_file",
          lastModified: 123,
          originalName: "budget.xlsx",
          parseStatus: "parsed",
        },
        createdAt: "2026-06-21T00:00:00.000Z",
        name: "Budget",
        sourceId: "source_1",
        type: "workbook",
      },
    ]);
    expect(JSON.stringify(serialized)).not.toContain("xlsx-bytes");
    expect(JSON.stringify(serialized)).not.toContain("1200");
  });

  it("serializes persisted, restoring, and missing source metadata", () => {
    const serialized = serializeStudioSources([
      {
        backing: {
          byteSize: null,
          kind: "persisted_workbook",
          originalName: "saved.xlsx",
          parsedWorkbook: null,
          workbookId: "workbook_1",
        },
        createdAt: new Date("2026-06-21T00:00:00.000Z"),
        name: "Saved",
        sourceId: "source_1",
        type: "workbook",
      },
      {
        backing: {
          byteSize: 12,
          kind: "restoring_local_file",
          lastModified: 456,
          originalName: "restoring.xlsx",
          workbookId: null,
        },
        createdAt: new Date("2026-06-21T00:00:00.000Z"),
        name: "Restoring",
        sourceId: "source_2",
        type: "workbook",
      },
      {
        backing: {
          byteSize: 13,
          kind: "missing_local_file",
          lastModified: 789,
          originalName: "missing.xlsx",
          parseError: "Workbook file missing. Reattach the file to continue.",
          workbookId: null,
        },
        createdAt: new Date("2026-06-21T00:00:00.000Z"),
        name: "Missing",
        sourceId: "source_3",
        type: "workbook",
      },
    ]);

    expect(serialized).toEqual([
      {
        backing: {
          byteSize: null,
          kind: "persisted_workbook",
          originalName: "saved.xlsx",
          workbookId: "workbook_1",
        },
        createdAt: "2026-06-21T00:00:00.000Z",
        name: "Saved",
        sourceId: "source_1",
        type: "workbook",
      },
      {
        backing: {
          byteSize: 12,
          kind: "restoring_local_file",
          lastModified: 456,
          originalName: "restoring.xlsx",
        },
        createdAt: "2026-06-21T00:00:00.000Z",
        name: "Restoring",
        sourceId: "source_2",
        type: "workbook",
      },
      {
        backing: {
          byteSize: 13,
          kind: "missing_local_file",
          lastModified: 789,
          originalName: "missing.xlsx",
          parseError: "Workbook file missing. Reattach the file to continue.",
        },
        createdAt: "2026-06-21T00:00:00.000Z",
        name: "Missing",
        sourceId: "source_3",
        type: "workbook",
      },
    ]);
  });

  it("deserializes local file metadata as restoring instead of missing", () => {
    expect(
      deserializeStudioSources([
        {
          backing: {
            byteSize: 10,
            kind: "local_file",
            lastModified: 123,
            originalName: "budget.xlsx",
            parseStatus: "parsed",
          },
          createdAt: "2026-06-21T00:00:00.000Z",
          name: "Budget",
          sourceId: "source_1",
          type: "workbook",
        },
      ]),
    ).toEqual([
      {
        backing: {
          byteSize: 10,
          kind: "restoring_local_file",
          lastModified: 123,
          originalName: "budget.xlsx",
          workbookId: null,
        },
        createdAt: new Date("2026-06-21T00:00:00.000Z"),
        name: "Budget",
        sourceId: "source_1",
        type: "workbook",
      },
    ]);
  });

  it("deserializes local and restoring files with workbookId null", () => {
    const [restored, restoring] = deserializeStudioSources([
      {
        backing: {
          byteSize: 10,
          kind: "local_file",
          lastModified: 123,
          originalName: "budget.xlsx",
          parseStatus: "parsed",
        },
        createdAt: "2026-06-21T00:00:00.000Z",
        name: "Budget",
        sourceId: "source_1",
        type: "workbook",
      },
      {
        backing: {
          byteSize: 11,
          kind: "restoring_local_file",
          lastModified: 456,
          originalName: "budget-restored.xlsx",
        },
        createdAt: "2026-06-22T00:00:00.000Z",
        name: "Budget Restored",
        sourceId: "source_2",
        type: "workbook",
      },
    ]);

    expect(
      restored.backing.kind === "restoring_local_file"
        ? restored.backing.workbookId
        : null,
    ).toBeNull();
    expect(
      restoring.backing.kind === "restoring_local_file"
        ? restoring.backing.workbookId
        : null,
    ).toBeNull();
  });

  it("maps server-attached draft source to persisted workbook backing", () => {
    const source = fromDraftSourceToStudioSource(
      {
        byteSize: 1024,
        checksumSha256:
          "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        fileId: "019e9315-6a87-715f-9861-8654df099006",
        name: "Budget",
        originalName: "server-budget.xlsx",
        sourceId: "source_1",
        status: "validated",
        type: "workbook",
        workbookId: "019e9315-6a87-715f-9861-8654df099005",
      },
      {
        backing: {
          byteSize: 10,
          file: restoredFile(),
          kind: "local_file",
          lastModified: 123,
          originalName: "budget.xlsx",
          parsedWorkbook: parsedWorkbook(),
          parseError: null,
          parseStatus: "parsed",
          uploadError: null,
          uploadStatus: "uploaded",
          workbookId: null,
        },
        createdAt: new Date("2026-06-21T00:00:00.000Z"),
        name: "Budget",
        sourceId: "source_1",
        type: "workbook",
      },
    );

    expect(source.backing).toMatchObject({
      byteSize: 1024,
      kind: "persisted_workbook",
      originalName: "server-budget.xlsx",
      workbookId: "019e9315-6a87-715f-9861-8654df099005",
    });
    expect(
      source.backing.kind === "persisted_workbook"
        ? source.backing.parsedWorkbook?.fileName
        : null,
    ).toBe("budget.xlsx");
  });

  it("hydrates restoring source to parsed local file when asset exists", async () => {
    const file = restoredFile();
    const workbook = parsedWorkbook();
    draftAssetMocks.readStudioDraftWorkbookFile.mockResolvedValue({
      ok: true,
      value: file,
    });
    workbookParseMocks.parseLocalWorkbookFile.mockResolvedValue({
      status: "parsed",
      workbook,
    });

    const [source] = await hydrateStudioSourcesFromDraftAssets({
      draftKey: "new:default",
      sources: [restoringSource()],
    });

    expect(source?.backing).toMatchObject({
      file,
      kind: "local_file",
      parsedWorkbook: workbook,
      parseError: null,
      parseStatus: "parsed",
    });
  });

  it("hydrates restoring source to failed local file when parsing fails", async () => {
    const file = restoredFile();
    draftAssetMocks.readStudioDraftWorkbookFile.mockResolvedValue({
      ok: true,
      value: file,
    });
    workbookParseMocks.parseLocalWorkbookFile.mockResolvedValue({
      error: { code: "parse_failed", message: "Workbook could not be parsed." },
      status: "failed",
    });

    const [source] = await hydrateStudioSourcesFromDraftAssets({
      draftKey: "new:default",
      sources: [restoringSource()],
    });

    expect(source?.backing).toMatchObject({
      file,
      kind: "local_file",
      parsedWorkbook: null,
      parseError: {
        code: "parse_failed",
        message: "Workbook could not be parsed.",
      },
      parseStatus: "failed",
    });
  });

  it("hydrates restoring source to failed local file when parser throws", async () => {
    const file = restoredFile();
    draftAssetMocks.readStudioDraftWorkbookFile.mockResolvedValue({
      ok: true,
      value: file,
    });
    workbookParseMocks.parseLocalWorkbookFile.mockRejectedValue(
      new Error("parse exploded"),
    );

    const [source] = await hydrateStudioSourcesFromDraftAssets({
      draftKey: "new:default",
      sources: [restoringSource()],
    });

    expect(source?.backing).toMatchObject({
      file,
      kind: "local_file",
      parsedWorkbook: null,
      parseError: {
        code: "parse_failed",
        message: "Workbook could not be parsed.",
      },
      parseStatus: "failed",
    });
  });

  it("hydrates restoring source to missing when asset is absent", async () => {
    draftAssetMocks.readStudioDraftWorkbookFile.mockResolvedValue({
      ok: true,
      value: null,
    });

    const [source] = await hydrateStudioSourcesFromDraftAssets({
      draftKey: "new:default",
      sources: [restoringSource()],
    });

    expect(source?.backing).toMatchObject({
      kind: "missing_local_file",
      parseError: MISSING_LOCAL_FILE_MESSAGE,
    });
  });

  it("hydrates restoring source to missing when asset read fails", async () => {
    draftAssetMocks.readStudioDraftWorkbookFile.mockResolvedValue({
      error: "read_failed",
      ok: false,
    });

    const [source] = await hydrateStudioSourcesFromDraftAssets({
      draftKey: "new:default",
      sources: [restoringSource()],
    });

    expect(source?.backing).toMatchObject({
      kind: "missing_local_file",
      parseError:
        "Saved source file could not be loaded. Reattach the file to continue.",
    });
  });

  it("never rejects when restoring hydration throws unexpectedly", async () => {
    draftAssetMocks.readStudioDraftWorkbookFile.mockRejectedValue(
      new Error("read exploded"),
    );

    await expect(
      hydrateStudioSourcesFromDraftAssets({
        draftKey: "new:default",
        sources: [restoringSource()],
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        backing: expect.objectContaining({
          kind: "missing_local_file",
          parseError:
            "Saved source file could not be restored. Reattach the file to continue.",
        }),
      }),
    ]);
  });
});

function restoredFile() {
  return new File(["xlsx-bytes"], "budget.xlsx", {
    lastModified: 123,
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function parsedWorkbook(): LocalWorkbookParseResult {
  return {
    byteSize: 10,
    cellsByKey: new Map(),
    fileName: "budget.xlsx",
    parsedAt: new Date("2026-06-21T00:00:00.000Z"),
    sheetCount: 1,
    sheets: [
      { columnCount: 1, name: "Sheet1", rowCount: 1, usedRange: "Sheet1!A1" },
    ],
  };
}

function restoringSource(): StudioWorkbookSource {
  return {
    backing: {
      byteSize: 10,
      kind: "restoring_local_file",
      lastModified: 123,
      originalName: "budget.xlsx",
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: "Budget",
    sourceId: "source_1",
    type: "workbook",
  };
}
