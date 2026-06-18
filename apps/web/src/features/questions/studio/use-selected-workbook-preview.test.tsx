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
  listWorkbookSnapshots: vi.fn(),
  listWorkbookSnapshotSheets: vi.fn(),
  listWorkbooks: vi.fn(),
  updateWorkbook: vi.fn(),
  validateWorkbook: vi.fn(),
}));

vi.mock("#/api/generated/workbook/workbook", () => workbookApiMocks);

describe("useSelectedWorkbookPreview", () => {
  it("does not load sheets or cells until the picker preview is requested", async () => {
    workbookApiMocks.listWorkbookCalculations.mockResolvedValue({
      workbookCalculations: [
        {
          id: "calculation-1",
          ownerUserId: "user-1",
          createdByUserId: "user-1",
          workbookId: "workbook-1",
          requestedCount: 1,
          status: "succeeded",
          correlationId: null,
          errorMessage: null,
          attempts: 1,
          startedAt: "2026-06-18T00:00:00.000Z",
          finishedAt: "2026-06-18T00:00:01.000Z",
          createdAt: "2026-06-18T00:00:00.000Z",
          updatedAt: "2026-06-18T00:00:01.000Z",
        },
      ],
      nextCursor: null,
    });
    workbookApiMocks.listWorkbookSnapshots.mockResolvedValue({
      workbookSnapshots: [
        {
          id: "snapshot-1",
          workbookId: "workbook-1",
          calculationId: "calculation-1",
          snapshotIndex: 0,
          createdAt: "2026-06-18T00:00:01.000Z",
        },
      ],
      nextCursor: null,
    });
    workbookApiMocks.getWorkbookSnapshotMetadata.mockResolvedValue({
      workbookSnapshotMetadata: {
        status: "ready",
        sheetCount: 2,
        cellCount: 10,
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
