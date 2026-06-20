import { renderHook, waitFor } from "@testing-library/react";
import { act, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { useSourceController } from "./use-source-controller";

const mockCreateWorkbookCalculationAsync = vi.fn();
const mockOnSourcesChange = vi.fn();

vi.mock("#/domains/workbooks/hooks", () => ({
  useWorkbookQuery: vi.fn((workbookId: string, options?: { enabled?: boolean }) => ({
    data:
      options?.enabled !== false && !workbookId.startsWith("local:")
        ? {
            id: "workbook-1",
            ownerUserId: "user-1",
            createdByUserId: "user-1",
            name: "Workbook 1",
            fileId: "file-1",
            checksumSha256: "checksum-1",
            originalName: "source.xlsx",
            engine: "cached",
            engineVersion: null,
            status: "valid",
            inspection: null,
            validationError: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        : undefined,
    isLoading: false,
    isError: false,
  })),
  useCreateWorkbookCalculation: vi.fn(() => ({
    mutateAsync: mockCreateWorkbookCalculationAsync,
  })),
}));

vi.mock("../use-selected-workbook-preview", () => ({
  useSelectedWorkbookPreview: vi.fn(() => ({
    workbookPreview: null,
    workbookSnapshotId: null,
    workbookSheets: [],
    workbookPreviewError: null,
    isWorkbookPreviewPending: false,
    needsWorkbookPreviewCalculation: true,
    hasMoreWorkbookSheets: false,
    isLoadingMoreWorkbookSheets: false,
    loadMoreWorkbookSheets: vi.fn(),
    previewStatus: "loading",
  })),
}));

describe("useSourceController", () => {
  beforeEach(() => {
    mockCreateWorkbookCalculationAsync.mockReset();
    mockCreateWorkbookCalculationAsync.mockResolvedValue({
      id: "calculation-1",
    });
    mockOnSourcesChange.mockReset();
  });

  it("sends the selected source when requesting preview calculation", async () => {
    renderHook(() =>
      useSourceController({
        loadWorkbookPickerPreview: false,
        model: createModel(),
        sources: [
          {
            sourceId: "source_9",
            name: "Current Source",
            workbookId: "workbook-1",
          },
        ],
        onSourcesChange: mockOnSourcesChange,
      }),
    );

    await waitFor(() => {
      expect(mockCreateWorkbookCalculationAsync).toHaveBeenCalledWith({
        workbookId: "workbook-1",
        requestedCount: 1,
        correlationId: "studio-source-preview:source_9",
        sources: [
          {
            sourceId: "source_9",
            workbookId: "workbook-1",
            name: "Current Source",
          },
        ],
      });
    });
  });

  it("adds a local source without server calls", () => {
    const { result } = renderHook(() =>
      useSourceController({
        loadWorkbookPickerPreview: false,
        model: createModel(),
        sources: [],
        onSourcesChange: mockOnSourcesChange,
      }),
    );

    act(() => {
      result.current.actions.addSource();
    });

    expect(mockOnSourcesChange).toHaveBeenCalledWith([
      {
        sourceId: "source_1",
        name: "Source 1",
        workbookId: "local:source_1",
      },
    ]);
    expect(mockCreateWorkbookCalculationAsync).not.toHaveBeenCalled();
  });

  it("does not request preview calculation without sources", async () => {
    renderHook(() =>
      useSourceController({
        loadWorkbookPickerPreview: false,
        model: createModel(),
        sources: [],
        onSourcesChange: mockOnSourcesChange,
      }),
    );

    await waitFor(() => {
      expect(mockOnSourcesChange).not.toHaveBeenCalled();
    });

    expect(mockCreateWorkbookCalculationAsync).not.toHaveBeenCalled();
  });

  it("removes a source from the draft when it is unused", () => {
    const { result } = renderHook(() =>
      useSourceController({
        loadWorkbookPickerPreview: false,
        model: createModel(),
        sources: [
          {
            sourceId: "source_1",
            name: "Source 1",
            workbookId: "local:source_1",
          },
        ],
        onSourcesChange: mockOnSourcesChange,
      }),
    );

    act(() => {
      result.current.actions.removeSource("source_1");
    });

    expect(mockOnSourcesChange).toHaveBeenCalledWith([]);
  });
});

function createModel(): ComposedEditorModel {
  return {
    schemaVersion: 1,
    blocks: [],
    responseFields: [],
    references: [],
  };
}
