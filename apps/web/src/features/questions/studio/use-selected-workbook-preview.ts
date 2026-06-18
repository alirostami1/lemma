import { useMemo } from "react";
import type { WorkbookPreview } from "#/domains/questions/workbook-preview";
import {
  useWorkbookCalculationsQuery,
  useWorkbookSnapshotCellsQuery,
  useWorkbookSnapshotMetadataQuery,
  useWorkbookSnapshotSheetsQuery,
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
  previewStatus: "idle" | "loading" | "ready" | "error";
};

const SOURCE_PREVIEW_REFETCH_INTERVAL_MS = 1_000;
const RETRIABLE_PREVIEW_CALCULATION_ERRORS = new Set([
  "values must be JSON-compatible.",
]);

export function useSelectedWorkbookPreview({
  selectedWorkbook,
}: {
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
      workbookId: selectedWorkbook?.id ?? "",
      limit: 1,
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
      workbookCalculationId: calculationId,
      limit: 1,
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
  const sheetsQuery = useWorkbookSnapshotSheetsQuery(
    { workbookSnapshotId: snapshotId, limit: 25 },
    { enabled: shouldLoadSnapshotDetails },
  );
  const firstSheet = sheetsQuery.data?.workbookSnapshotSheets[0] ?? null;
  const firstSheetCellsQuery = useWorkbookSnapshotCellsQuery(
    {
      workbookSnapshotId: snapshotId,
      sheetIndex: firstSheet?.sheetIndex ?? 0,
      startRow: 1,
      startColumn: 1,
      rowCount: 50,
      columnCount: 20,
    },
    { enabled: shouldLoadSnapshotDetails && Boolean(firstSheet) },
  );
  const workbookPreview = useMemo(() => {
    if (!selectedWorkbook || !sheetsQuery.data || !firstSheetCellsQuery.data) {
      return null;
    }
    return mapSnapshotCellsToWorkbookPreview(
      firstSheetCellsQuery.data,
      sheetsQuery.data.workbookSnapshotSheets,
      selectedWorkbook.originalName,
    );
  }, [firstSheetCellsQuery.data, selectedWorkbook, sheetsQuery.data]);
  const isWorkbookPreviewPending =
    (shouldLoadPreview && calculationsQuery.isPending) ||
    (shouldLoadSnapshots && snapshotsQuery.isPending) ||
    (shouldLoadSnapshotDetails && metadataQuery.isPending) ||
    (shouldLoadSnapshotDetails && sheetsQuery.isPending) ||
    (Boolean(firstSheet) && firstSheetCellsQuery.isPending);
  const hasPreviewError =
    calculationsQuery.isError ||
    snapshotsQuery.isError ||
    metadataQuery.isError ||
    sheetsQuery.isError ||
    firstSheetCellsQuery.isError;

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

  if (isWorkbookPreviewPending || isCalculationPending) {
    return {
      ...loadingController,
      needsWorkbookPreviewCalculation,
    };
  }

  if (
    !calculationId ||
    !snapshotId ||
    !metadataQuery.data ||
    !sheetsQuery.data
  ) {
    return loadingController;
  }

  return {
    workbookPreview,
    workbookSnapshotId: snapshotId,
    workbookSheets: sheetsQuery.data.workbookSnapshotSheets,
    workbookPreviewError: null,
    isWorkbookPreviewPending: false,
    needsWorkbookPreviewCalculation: false,
    previewStatus: "ready",
  };
}

const idleController: SelectedWorkbookPreviewController = {
  workbookPreview: null,
  workbookSnapshotId: null,
  workbookSheets: [],
  workbookPreviewError: null,
  isWorkbookPreviewPending: false,
  needsWorkbookPreviewCalculation: false,
  previewStatus: "idle",
};

const loadingController: SelectedWorkbookPreviewController = {
  workbookPreview: null,
  workbookSnapshotId: null,
  workbookSheets: [],
  workbookPreviewError: null,
  isWorkbookPreviewPending: true,
  needsWorkbookPreviewCalculation: false,
  previewStatus: "loading",
};

function errorController(message: string): SelectedWorkbookPreviewController {
  return {
    workbookPreview: null,
    workbookSnapshotId: null,
    workbookSheets: [],
    workbookPreviewError: message,
    isWorkbookPreviewPending: false,
    needsWorkbookPreviewCalculation: false,
    previewStatus: "error",
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
      name: sheet.name,
      rows: sheet.sheetIndex === cells.sheetIndex ? cells.rows : [],
      columnCount: sheet.columnCount,
    })),
  };
}
