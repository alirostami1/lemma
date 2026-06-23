import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useSelectedWorkbookPreview } from "./use-selected-workbook-preview";

const workbookApiMocks = vi.hoisted(() => ({
  createWorkbook: vi.fn(),
  createWorkbookCalculation: vi.fn(),
  deleteWorkbook: vi.fn(),
  getWorkbook: vi.fn(),
  getWorkbookCalculation: vi.fn(),
  getWorkbookSnapshot: vi.fn(),
  getWorkbookSnapshotCells: vi.fn(),
  getWorkbookSnapshotMetadata: vi.fn(),
  getWorkbookSnapshotRange: vi.fn(),
  getWorkbookSnapshotRangeBatch: vi.fn(),
  listWorkbookCalculations: vi.fn(),
  listWorkbookSnapshotSheets: vi.fn(),
  listWorkbookSnapshots: vi.fn(),
  listWorkbooks: vi.fn(),
  updateWorkbook: vi.fn(),
  validateWorkbook: vi.fn(),
}));

vi.mock("#/api/generated/workbook/workbook", () => workbookApiMocks);

describe("useSelectedWorkbookPreview", () => {
  it("does not load sheets or cells until the picker preview is requested", async () => {
    workbookApiMocks.listWorkbookCalculations.mockResolvedValue({
      nextCursor: null,
      workbookCalculations: [
        {
          attemptNumber: 1,
          attempts: 1,
          correlationId: null,
          createdAt: "2026-06-18T00:00:00.000Z",
          createdByUserId: "user-1",
          errorMessage: null,
          finishedAt: "2026-06-18T00:00:01.000Z",
          id: "calculation-1",
          ownerUserId: "user-1",
          requestedCount: 1,
          retryOfCalculationId: null,
          startedAt: "2026-06-18T00:00:00.000Z",
          status: "succeeded",
          updatedAt: "2026-06-18T00:00:01.000Z",
        },
      ],
    });
    workbookApiMocks.listWorkbookSnapshots.mockResolvedValue({
      nextCursor: null,
      workbookSnapshots: [
        {
          calculationId: "calculation-1",
          createdAt: "2026-06-18T00:00:01.000Z",
          id: "snapshot-1",
          snapshotIndex: 0,
          workbookId: "workbook-1",
        },
      ],
    });
    workbookApiMocks.getWorkbookSnapshotMetadata.mockResolvedValue({
      workbookSnapshotMetadata: {
        cellCount: 10,
        sheetCount: 2,
        status: "ready",
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () =>
        useSelectedWorkbookPreview({
          loadPickerPreview: false,
          selectedWorkbook: {
            id: "workbook-1",
            originalName: "source.xlsx",
            status: "valid",
          },
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.previewStatus).toBe("ready");
    });

    expect(workbookApiMocks.getWorkbookSnapshotMetadata).toHaveBeenCalledWith(
      "snapshot-1",
    );
    expect(workbookApiMocks.listWorkbookSnapshotSheets).not.toHaveBeenCalled();
    expect(workbookApiMocks.getWorkbookSnapshotCells).not.toHaveBeenCalled();
  });
});
