import { useMemo } from "react";
import type { WorkbookPreview } from "#/domains/questions/workbook-preview";
import {
  useWorkbookCalculationsQuery,
  useWorkbookSnapshotCellsQuery,
  useWorkbookSnapshotMetadataQuery,
  useWorkbookSnapshotSheetsInfiniteQuery,
  useWorkbookSnapshotsQuery,
} from "#/domains/workbooks/hooks";
import type {
  WorkbookSnapshotCells,
  WorkbookSnapshotSheet,
} from "#/domains/workbooks/model";

export type SelectedWorkbookPreviewController = {
  workbookPreview: WorkbookPreview | null;
  workbookSnapshotId: string | null;
  workbookSheets: WorkbookSnapshotSheet[];
  workbookPreviewError: string | null;
  isWorkbookPreviewPending: boolean;
  needsWorkbookPreviewCalculation: boolean;
  hasMoreWorkbookSheets: boolean;
  isLoadingMoreWorkbookSheets: boolean;
  loadMoreWorkbookSheets(): void;
  previewStatus: "idle" | "loading" | "ready" | "error";
};

const SOURCE_PREVIEW_REFETCH_INTERVAL_MS = 1_000;
const RETRIABLE_PREVIEW_CALCULATION_ERRORS = new Set([
  "values must be JSON-compatible.",
]);

export function useSelectedWorkbookPreview({
  loadPickerPreview,
  selectedWorkbook,
}: {
  loadPickerPreview: boolean;
  selectedWorkbook: {
    id: string;
    originalName: string;
    status: string;
  } | null;
}): SelectedWorkbookPreviewController {
  const shouldLoadPreview = Boolean(
    selectedWorkbook?.id && selectedWorkbook.status === "valid",
  );
  const calculationsQuery = useWorkbookCalculationsQuery(
    {
      limit: 1,
      workbookId: selectedWorkbook?.id ?? "",
    },
    {
      enabled: shouldLoadPreview,
      refetchInterval: (query) => {
        const calculation = query.state.data?.workbookCalculations[0];
        return !calculation ||
          calculation.status === "queued" ||
          calculation.status === "running"
          ? SOURCE_PREVIEW_REFETCH_INTERVAL_MS
          : false;
      },
    },
  );
  const calculation = calculationsQuery.data?.workbookCalculations[0] ?? null;
  const calculationId =
    calculation?.status === "succeeded" ? calculation.id : "";
  const isCalculationPending =
    !calculation ||
    calculation.status === "queued" ||
    calculation.status === "running";
  const didCalculationFail =
    calculation?.status === "failed" || calculation?.status === "cancelled";
  const isRetriableCalculationFailure =
    calculation?.status === "failed" &&
    calculation.errorMessage !== null &&
    RETRIABLE_PREVIEW_CALCULATION_ERRORS.has(calculation.errorMessage);
  const needsWorkbookPreviewCalculation = Boolean(
    shouldLoadPreview &&
      calculationsQuery.isSuccess &&
      (!calculation || isRetriableCalculationFailure),
  );
  const shouldLoadSnapshots = shouldLoadPreview && Boolean(calculationId);
  const snapshotsQuery = useWorkbookSnapshotsQuery(
    {
      limit: 1,
      workbookCalculationId: calculationId,
    },
    {
      enabled: shouldLoadSnapshots,
      refetchInterval: (query) => {
        return query.state.data?.workbookSnapshots[0]
          ? false
          : SOURCE_PREVIEW_REFETCH_INTERVAL_MS;
      },
    },
  );
  const snapshotId = snapshotsQuery.data?.workbookSnapshots[0]?.id ?? "";
  const shouldLoadSnapshotDetails = shouldLoadSnapshots && Boolean(snapshotId);
  const metadataQuery = useWorkbookSnapshotMetadataQuery(snapshotId, {
    enabled: shouldLoadSnapshotDetails,
  });
  const sheetsQuery = useWorkbookSnapshotSheetsInfiniteQuery(
    { limit: 25, workbookSnapshotId: snapshotId },
    { enabled: shouldLoadSnapshotDetails && loadPickerPreview },
  );
  const workbookSheets = useMemo(
    () =>
      sheetsQuery.data?.pages.flatMap((page) => page.workbookSnapshotSheets) ??
      [],
    [sheetsQuery.data],
  );
  const firstSheet = workbookSheets[0] ?? null;
  const firstSheetCellsQuery = useWorkbookSnapshotCellsQuery(
    {
      columnCount: 20,
      rowCount: 50,
      sheetIndex: firstSheet?.sheetIndex ?? 0,
      startColumn: 1,
      startRow: 1,
      workbookSnapshotId: snapshotId,
    },
    {
      enabled:
        shouldLoadSnapshotDetails && loadPickerPreview && Boolean(firstSheet),
    },
  );
  const workbookPreview = useMemo(() => {
    if (!selectedWorkbook || !firstSheetCellsQuery.data) {
      return null;
    }
    return mapSnapshotCellsToWorkbookPreview(
      firstSheetCellsQuery.data,
      workbookSheets,
      selectedWorkbook.originalName,
    );
  }, [firstSheetCellsQuery.data, selectedWorkbook, workbookSheets]);
  const loadMoreWorkbookSheets = () => {
    void sheetsQuery.fetchNextPage();
  };
  const workbookSheetPagination = {
    hasMoreWorkbookSheets: Boolean(sheetsQuery.hasNextPage),
    isLoadingMoreWorkbookSheets: sheetsQuery.isFetchingNextPage,
    loadMoreWorkbookSheets,
  };
  const isSnapshotPreviewPending =
    (shouldLoadPreview && calculationsQuery.isPending) ||
    (shouldLoadSnapshots && snapshotsQuery.isPending) ||
    (shouldLoadSnapshotDetails && metadataQuery.isPending);
  const isPickerPreviewPending =
    (loadPickerPreview && shouldLoadSnapshotDetails && sheetsQuery.isPending) ||
    (loadPickerPreview &&
      Boolean(firstSheet) &&
      firstSheetCellsQuery.isPending);
  const hasPreviewError =
    calculationsQuery.isError ||
    snapshotsQuery.isError ||
    metadataQuery.isError ||
    (loadPickerPreview && sheetsQuery.isError) ||
    (loadPickerPreview && firstSheetCellsQuery.isError);

  if (!selectedWorkbook) {
    return idleController;
  }

  if (selectedWorkbook.status !== "valid") {
    return errorController("Source is not ready.");
  }

  if (hasPreviewError) {
    return errorController("Source preview could not be loaded.");
  }

  if (didCalculationFail) {
    return {
      ...errorController("Source preview could not be generated."),
      needsWorkbookPreviewCalculation,
    };
  }

  if (isSnapshotPreviewPending || isCalculationPending) {
    return {
      ...loadingController,
      needsWorkbookPreviewCalculation,
    };
  }

  if (!calculationId || !snapshotId || !metadataQuery.data) {
    return loadingController;
  }

  if (isPickerPreviewPending || (loadPickerPreview && !sheetsQuery.data)) {
    return {
      ...loadingController,
      workbookSheets,
      workbookSnapshotId: snapshotId,
      ...workbookSheetPagination,
    };
  }

  return {
    isWorkbookPreviewPending: false,
    needsWorkbookPreviewCalculation: false,
    workbookPreview,
    workbookPreviewError: null,
    workbookSheets,
    workbookSnapshotId: snapshotId,
    ...workbookSheetPagination,
    previewStatus: "ready",
  };
}

const noop = () => {};

const idleController: SelectedWorkbookPreviewController = {
  hasMoreWorkbookSheets: false,
  isLoadingMoreWorkbookSheets: false,
  isWorkbookPreviewPending: false,
  loadMoreWorkbookSheets: noop,
  needsWorkbookPreviewCalculation: false,
  previewStatus: "idle",
  workbookPreview: null,
  workbookPreviewError: null,
  workbookSheets: [],
  workbookSnapshotId: null,
};

const loadingController: SelectedWorkbookPreviewController = {
  hasMoreWorkbookSheets: false,
  isLoadingMoreWorkbookSheets: false,
  isWorkbookPreviewPending: true,
  loadMoreWorkbookSheets: noop,
  needsWorkbookPreviewCalculation: false,
  previewStatus: "loading",
  workbookPreview: null,
  workbookPreviewError: null,
  workbookSheets: [],
  workbookSnapshotId: null,
};

function errorController(message: string): SelectedWorkbookPreviewController {
  return {
    hasMoreWorkbookSheets: false,
    isLoadingMoreWorkbookSheets: false,
    isWorkbookPreviewPending: false,
    loadMoreWorkbookSheets: noop,
    needsWorkbookPreviewCalculation: false,
    previewStatus: "error",
    workbookPreview: null,
    workbookPreviewError: message,
    workbookSheets: [],
    workbookSnapshotId: null,
  };
}

function mapSnapshotCellsToWorkbookPreview(
  cells: WorkbookSnapshotCells,
  sheets: WorkbookSnapshotSheet[],
  fileName: string,
): WorkbookPreview {
  return {
    fileName,
    sheets: sheets.map((sheet) => ({
      columnCount: sheet.columnCount,
      name: sheet.name,
      rows: sheet.sheetIndex === cells.sheetIndex ? cells.rows : [],
    })),
  };
}
