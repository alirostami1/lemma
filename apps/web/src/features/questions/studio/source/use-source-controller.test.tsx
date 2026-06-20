import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSourceController } from "./use-source-controller";

const mockCreateWorkbookCalculationAsync = vi.fn();
const mockUseSourceSessionRegistry = vi.fn();

vi.mock("#/domains/questions/source-requirements", () => ({
  getBlueprintSourceRequirement: vi.fn(() => ({
    status: "required",
    workbookRefs: ["Sheet1!A1"],
  })),
}));

vi.mock("#/domains/workbooks/hooks", () => ({
  useWorkbookQuery: vi.fn(() => ({
    data: {
      id: "workbook-1",
      name: "Workbook 1",
      originalName: "source.xlsx",
      status: "valid",
    },
    isLoading: false,
  })),
  useValidateWorkbook: vi.fn(() => ({
    mutateAsync: vi.fn(),
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

vi.mock("./source-session-registry", () => ({
  useSourceSessionRegistry: () => mockUseSourceSessionRegistry(),
}));

describe("useSourceController", () => {
  beforeEach(() => {
    mockCreateWorkbookCalculationAsync.mockReset();
    mockCreateWorkbookCalculationAsync.mockResolvedValue({
      id: "calculation-1",
    });
    mockUseSourceSessionRegistry.mockReset();
  });

  it("sends active workbook source when requesting preview calculation", async () => {
    mockUseSourceSessionRegistry.mockReturnValue({
      sources: [
        {
          sourceId: "source_9",
          sourceName: "Current Source",
          workbookId: "workbook-1",
          workbookName: "Workbook 1",
        },
      ],
      activeSource: {
        sourceId: "source_9",
        sourceName: "Current Source",
        workbookId: "workbook-1",
        workbookName: "Workbook 1",
      },
      attachWorkbook: vi.fn(),
      activateSourceById: vi.fn(),
      removeActiveSource: vi.fn(),
      getSourceById: vi.fn(),
      getSourceByName: vi.fn(),
      getWorkbookName: vi.fn(),
    });

    renderHook(() =>
      useSourceController({
        loadWorkbookPickerPreview: false,
        model: {} as never,
        selectedWorkbookId: "workbook-1",
        isVersionBoundSource: false,
        onSelectedWorkbookIdChange: vi.fn(),
      }),
    );

    await waitFor(() => {
      expect(mockCreateWorkbookCalculationAsync).toHaveBeenCalledWith({
        workbookId: "workbook-1",
        requestedCount: 1,
        correlationId: "studio-source-preview:workbook-1",
        workbookSources: [
          {
            sourceId: "source_9",
            workbookId: "workbook-1",
          },
        ],
      });
    });
  });

  it("does not request preview calculation without active source", async () => {
    mockUseSourceSessionRegistry.mockReturnValue({
      sources: [],
      activeSource: null,
      attachWorkbook: vi.fn(),
      activateSourceById: vi.fn(),
      removeActiveSource: vi.fn(),
      getSourceById: vi.fn(),
      getSourceByName: vi.fn(),
      getWorkbookName: vi.fn(),
    });

    renderHook(() =>
      useSourceController({
        loadWorkbookPickerPreview: false,
        model: {} as never,
        selectedWorkbookId: "workbook-1",
        isVersionBoundSource: false,
        onSelectedWorkbookIdChange: vi.fn(),
      }),
    );

    await waitFor(() => {
      expect(mockUseSourceSessionRegistry).toHaveBeenCalled();
    });

    expect(mockCreateWorkbookCalculationAsync).not.toHaveBeenCalled();
  });
});
