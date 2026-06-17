import { useMemo } from "react";
import type { WorkbookPreview } from "#/domains/questions/workbook-preview";
import {
  useWorkbookCalculationsQuery,
  useWorkbookSnapshotPreviewQuery,
  useWorkbookSnapshotsQuery,
} from "#/domains/workbooks/hooks";
import type { WorkbookSnapshotPreview } from "#/domains/workbooks/model";

export type SelectedWorkbookPreviewController = {
  workbookFile: File | null;
  workbookPreview: WorkbookPreview | null;
  workbookPreviewError: string | null;
  isWorkbookPreviewPending: boolean;
  previewStatus: "idle" | "loading" | "ready" | "error";
};

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
      status: "succeeded",
      limit: 1,
    },
    { enabled: shouldLoadPreview },
  );
  const calculationId =
    calculationsQuery.data?.workbookCalculations[0]?.id ?? "";
  const shouldLoadSnapshots = shouldLoadPreview && Boolean(calculationId);
  const snapshotsQuery = useWorkbookSnapshotsQuery(
    {
      workbookCalculationId: calculationId,
      limit: 1,
    },
    { enabled: shouldLoadSnapshots },
  );
  const snapshotId = snapshotsQuery.data?.workbookSnapshots[0]?.id ?? "";
  const shouldLoadSnapshotPreview = shouldLoadSnapshots && Boolean(snapshotId);
  const snapshotPreviewQuery = useWorkbookSnapshotPreviewQuery(
    {
      workbookSnapshotId: snapshotId,
      rowLimit: 50,
      columnLimit: 20,
    },
    { enabled: shouldLoadSnapshotPreview },
  );
  const workbookPreview = useMemo(() => {
    if (!snapshotPreviewQuery.data || !selectedWorkbook) {
      return null;
    }
    return mapSnapshotPreviewToWorkbookPreview(
      snapshotPreviewQuery.data,
      selectedWorkbook.originalName,
    );
  }, [selectedWorkbook, snapshotPreviewQuery.data]);
  const isWorkbookPreviewPending =
    (shouldLoadPreview && calculationsQuery.isPending) ||
    (shouldLoadSnapshots && snapshotsQuery.isPending) ||
    (shouldLoadSnapshotPreview && snapshotPreviewQuery.isPending);
  const hasPreviewError =
    calculationsQuery.isError ||
    snapshotsQuery.isError ||
    snapshotPreviewQuery.isError;

  if (!selectedWorkbook) {
    return idleController;
  }

  if (selectedWorkbook.status !== "valid") {
    return errorController("Source is not ready.");
  }

  if (isWorkbookPreviewPending) {
    return {
      workbookFile: null,
      workbookPreview: null,
      workbookPreviewError: null,
      isWorkbookPreviewPending: true,
      previewStatus: "loading",
    };
  }

  if (hasPreviewError) {
    return errorController("Source preview could not be loaded.");
  }

  if (!calculationId || !snapshotId || !workbookPreview) {
    return errorController("Source preview is not available yet.");
  }

  return {
    workbookFile: null,
    workbookPreview,
    workbookPreviewError: null,
    isWorkbookPreviewPending: false,
    previewStatus: "ready",
  };
}

const idleController: SelectedWorkbookPreviewController = {
  workbookFile: null,
  workbookPreview: null,
  workbookPreviewError: null,
  isWorkbookPreviewPending: false,
  previewStatus: "idle",
};

function errorController(message: string): SelectedWorkbookPreviewController {
  return {
    workbookFile: null,
    workbookPreview: null,
    workbookPreviewError: message,
    isWorkbookPreviewPending: false,
    previewStatus: "error",
  };
}

function mapSnapshotPreviewToWorkbookPreview(
  preview: WorkbookSnapshotPreview,
  fileName: string,
): WorkbookPreview {
  return {
    fileName,
    sheets: preview.sheets.map((sheet) => ({
      name: sheet.name,
      rows: sheet.rows,
      columnCount: sheet.columnCount,
    })),
  };
}
