// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { StudioWorkbookSource } from "./studio-source-model";
import { useSourceController } from "./use-source-controller";

const sourceControllerMocks = vi.hoisted(() => ({
  createWorkbookCalculationAsync: vi.fn(),
  parseLocalWorkbookFile: vi.fn(),
  saveStudioDraftWorkbookFile: vi.fn(),
}));
const mockOnSourcesChange = vi.fn();

vi.mock("#/domains/workbooks/hooks", () => ({
  useCreateWorkbookCalculation: vi.fn(() => ({
    mutateAsync: sourceControllerMocks.createWorkbookCalculationAsync,
  })),
  useWorkbookQuery: vi.fn(
    (workbookId: string, options?: { enabled?: boolean }) => ({
      data:
        options?.enabled !== false && workbookId.length > 0
          ? {
              checksumSha256: "checksum-1",
              createdAt: new Date(),
              createdByUserId: "user-1",
              engine: "cached",
              engineVersion: null,
              fileId: "file-1",
              id: workbookId,
              inspection: null,
              name: "Workbook 1",
              originalName: "source.xlsx",
              ownerUserId: "user-1",
              status: "valid",
              updatedAt: new Date(),
              validationError: null,
            }
          : undefined,
      isError: false,
      isLoading: false,
    }),
  ),
}));

vi.mock("../use-selected-workbook-preview", () => ({
  useSelectedWorkbookPreview: vi.fn(() => ({
    hasMoreWorkbookSheets: false,
    isLoadingMoreWorkbookSheets: false,
    isWorkbookPreviewPending: false,
    loadMoreWorkbookSheets: vi.fn(),
    needsWorkbookPreviewCalculation: true,
    previewStatus: "loading",
    workbookPreview: null,
    workbookPreviewError: null,
    workbookSheets: [],
    workbookSnapshotId: null,
  })),
}));

vi.mock("#/domains/workbooks/local-xlsx", () => ({
  parseLocalWorkbookFile: sourceControllerMocks.parseLocalWorkbookFile,
}));

vi.mock("#/domains/files/hooks", () => ({
  useCreateFileDownloadUrl: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("../studio-draft-assets-store", () => ({
  saveStudioDraftWorkbookFile:
    sourceControllerMocks.saveStudioDraftWorkbookFile,
}));

describe("useSourceController", () => {
  beforeEach(() => {
    sourceControllerMocks.createWorkbookCalculationAsync.mockReset();
    sourceControllerMocks.createWorkbookCalculationAsync.mockResolvedValue({
      id: "calculation-1",
    });
    mockOnSourcesChange.mockReset();
    sourceControllerMocks.parseLocalWorkbookFile.mockReset();
    sourceControllerMocks.parseLocalWorkbookFile.mockResolvedValue({
      status: "parsed",
      workbook: parsedWorkbook("source_1"),
    });
    sourceControllerMocks.saveStudioDraftWorkbookFile.mockReset();
    sourceControllerMocks.saveStudioDraftWorkbookFile.mockResolvedValue({
      ok: true,
      value: undefined,
    });
  });

  it("requests lookup calculation for persisted picker source", async () => {
    renderHook(() =>
      useSourceController({
        draftKey: "new:default",
        loadWorkbookPickerPreview: false,
        lookupSourceId: "source_9",
        model: createModel(),
        onSourcesChange: mockOnSourcesChange,
        sources: [persistedSource("source_9", "workbook-1")],
      }),
    );

    await waitFor(() => {
      expect(
        sourceControllerMocks.createWorkbookCalculationAsync,
      ).toHaveBeenCalledWith({
        correlationId: "studio-workbook-lookup:source_9",
        requestedCount: 1,
        workbookId: "workbook-1",
      });
    });
  });

  it("creates local source", () => {
    const { result } = renderHook(() =>
      useSourceController({
        draftKey: "new:default",
        loadWorkbookPickerPreview: false,
        lookupSourceId: null,
        model: createModel(),
        onSourcesChange: mockOnSourcesChange,
        sources: [],
      }),
    );

    act(() => {
      result.current.actions.createSource(localSource("budget-q1"));
    });

    expect(mockOnSourcesChange).toHaveBeenCalledWith([
      expect.objectContaining({
        backing: expect.objectContaining({
          kind: "local_file",
          parseStatus: "parsed",
        }),
        name: "budget-q1",
        sourceId: "budget-q1",
      }),
    ]);
  });

  it("removes unused source", () => {
    const { result } = renderHook(() =>
      useSourceController({
        draftKey: "new:default",
        loadWorkbookPickerPreview: false,
        lookupSourceId: "source_1",
        model: createModel({
          blocks: [
            {
              content: [{ referenceId: "ref_1", type: "reference" }],
              id: "block_1",
              type: "text",
            },
          ],
          references: [
            {
              id: "ref_1",
              source: {
                ref: "Sheet1!A1",
                sourceId: "source_1",
                type: "workbook_cell",
              },
            },
          ],
        }),
        onSourcesChange: mockOnSourcesChange,
        sources: [
          persistedSource("source_1", "workbook-1"),
          localSource("source_2"),
        ],
      }),
    );

    act(() => {
      result.current.actions.removeSource("source_2");
    });

    expect(mockOnSourcesChange).toHaveBeenLastCalledWith([
      persistedSource("source_1", "workbook-1"),
    ]);
  });

  it("removes unused source without returning lookup state", () => {
    const { result } = renderHook(() =>
      useSourceController({
        draftKey: "new:default",
        loadWorkbookPickerPreview: false,
        lookupSourceId: "source_1",
        model: createModel({
          blocks: [
            {
              content: [{ referenceId: "ref_1", type: "reference" }],
              id: "block_1",
              type: "text",
            },
          ],
          references: [
            {
              id: "ref_1",
              source: {
                ref: "Sheet1!A1",
                sourceId: "source_2",
                type: "workbook_cell",
              },
            },
          ],
        }),
        onSourcesChange: mockOnSourcesChange,
        sources: [
          localSource("source_1"),
          persistedSource("source_2", "workbook-2"),
        ],
      }),
    );

    const outcome = actResult(() =>
      result.current.actions.removeSource("source_1"),
    );

    expect(outcome).toEqual({
      sources: [persistedSource("source_2", "workbook-2")],
      status: "changed",
    });
  });

  it("blocks removing used source", () => {
    const { result } = renderHook(() =>
      useSourceController({
        draftKey: "new:default",
        loadWorkbookPickerPreview: false,
        lookupSourceId: null,
        model: createModel({
          blocks: [
            {
              content: [{ referenceId: "ref_1", type: "reference" }],
              id: "block_1",
              type: "text",
            },
          ],
          references: [
            {
              id: "ref_1",
              source: {
                ref: "Sheet1!A1",
                sourceId: "source_1",
                type: "workbook_cell",
              },
            },
          ],
        }),
        onSourcesChange: mockOnSourcesChange,
        sources: [localSource("source_1")],
      }),
    );

    const outcome = actResult(() =>
      result.current.actions.removeSource("source_1"),
    );

    expect(outcome).toEqual({
      reason:
        "This source is used by the blueprint. Remove its references before detaching it.",
      status: "blocked",
    });
    expect(mockOnSourcesChange).not.toHaveBeenCalled();
  });

  it("reattaches matching missing local source file", async () => {
    const { result } = renderHook(() =>
      useSourceController({
        draftKey: "new:default",
        loadWorkbookPickerPreview: false,
        lookupSourceId: null,
        model: createModel(),
        onSourcesChange: mockOnSourcesChange,
        sources: [missingSource("source_1")],
      }),
    );
    const file = new File(["test"], "source_1.xlsx", {
      lastModified: 1,
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const outcome = await result.current.actions.reattachSource(
      "source_1",
      file,
    );

    expect(outcome.status).toBe("changed");
    expect(
      sourceControllerMocks.saveStudioDraftWorkbookFile,
    ).not.toHaveBeenCalled();
    expect(mockOnSourcesChange).toHaveBeenCalledWith([
      expect.objectContaining({
        backing: expect.objectContaining({
          kind: "local_file",
          parseStatus: "parsed",
        }),
        sourceId: "source_1",
      }),
    ]);
  });

  it("rejects wrong reattach file", async () => {
    const { result } = renderHook(() =>
      useSourceController({
        draftKey: "new:default",
        loadWorkbookPickerPreview: false,
        lookupSourceId: null,
        model: createModel(),
        onSourcesChange: mockOnSourcesChange,
        sources: [missingSource("source_1")],
      }),
    );

    const outcome = await result.current.actions.reattachSource(
      "source_1",
      new File(["wrong"], "other.xlsx"),
    );

    expect(outcome).toEqual({
      reason: "Choose the original workbook file for this source.",
      status: "blocked",
    });
    expect(mockOnSourcesChange).not.toHaveBeenCalled();
  });
});

function actResult<T>(fn: () => T): T {
  let value!: T;
  act(() => {
    value = fn();
  });
  return value;
}

function persistedSource(
  sourceId: string,
  workbookId: string,
): StudioWorkbookSource {
  return {
    backing: {
      byteSize: null,
      kind: "persisted_workbook",
      originalName: `${sourceId}.xlsx`,
      parsedWorkbook: null,
      workbookId,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: `Source ${sourceId}`,
    sourceId,
    type: "workbook",
  };
}

function localSource(sourceId: string): StudioWorkbookSource {
  return {
    backing: {
      byteSize: 4,
      file: new File(["test"], `${sourceId}.xlsx`, {
        lastModified: 1,
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      kind: "local_file",
      lastModified: 1,
      originalName: `${sourceId}.xlsx`,
      parsedWorkbook: parsedWorkbook(sourceId),
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

function parsedWorkbook(sourceId: string) {
  return {
    byteSize: 4,
    cellsByKey: new Map(),
    fileName: `${sourceId}.xlsx`,
    parsedAt: new Date("2026-06-21T00:00:00.000Z"),
    sheetCount: 1,
    sheets: [
      { columnCount: 1, name: "Sheet1", rowCount: 1, usedRange: "Sheet1!A1" },
    ],
  };
}

function createModel(
  input?: Partial<ComposedEditorModel>,
): ComposedEditorModel {
  return {
    blocks: input?.blocks ?? [],
    references: input?.references ?? [],
    responseFields: input?.responseFields ?? [],
    schemaVersion: 1,
  };
}
