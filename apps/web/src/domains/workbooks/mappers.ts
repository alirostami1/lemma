import type {
  WorkbookCalculation as WorkbookCalculationDto,
  WorkbookCalculationResponse,
  WorkbookCalculationsResponse,
  Workbook as WorkbookDto,
  WorkbookInspection as WorkbookInspectionDto,
  WorkbookResponse,
  WorkbookSnapshot as WorkbookSnapshotDto,
  WorkbookSnapshotResponse,
  WorkbookSnapshotsResponse,
  WorkbooksResponse,
} from "#/api/generated/model";
import type {
  Workbook,
  WorkbookCalculation,
  WorkbookCalculationsPage,
  WorkbookInspection,
  WorkbookSnapshot,
  WorkbookSnapshotsPage,
  WorkbooksPage,
} from "./model";

export function mapWorkbookInspection(
  dto: WorkbookInspectionDto,
): WorkbookInspection {
  return { ...dto };
}

export function mapWorkbook(dto: WorkbookDto): Workbook {
  return {
    ...dto,
    inspection: dto.inspection ? mapWorkbookInspection(dto.inspection) : null,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

export function mapWorkbookCalculation(
  dto: WorkbookCalculationDto,
): WorkbookCalculation {
  return {
    ...dto,
    startedAt: dto.startedAt ? new Date(dto.startedAt) : null,
    finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : null,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

export function mapWorkbookSnapshot(
  dto: WorkbookSnapshotDto,
): WorkbookSnapshot {
  return {
    ...dto,
    values: {
      sheets: dto.values.sheets.map((sheet) => ({
        ...sheet,
        cells: { ...sheet.cells },
      })),
    },
    createdAt: new Date(dto.createdAt),
  };
}

export function mapWorkbooksResponse(
  response: WorkbooksResponse,
): WorkbooksPage {
  return {
    workbooks: response.workbooks.map(mapWorkbook),
    nextCursor: response.nextCursor,
  };
}

export function mapWorkbookResponse(response: WorkbookResponse): Workbook {
  return mapWorkbook(response.workbook);
}

export function mapWorkbookCalculationsResponse(
  response: WorkbookCalculationsResponse,
): WorkbookCalculationsPage {
  return {
    workbookCalculations: response.workbookCalculations.map(
      mapWorkbookCalculation,
    ),
    nextCursor: response.nextCursor,
  };
}

export function mapWorkbookCalculationResponse(
  response: WorkbookCalculationResponse,
): WorkbookCalculation {
  return mapWorkbookCalculation(response.workbookCalculation);
}

export function mapWorkbookSnapshotsResponse(
  response: WorkbookSnapshotsResponse,
): WorkbookSnapshotsPage {
  return {
    workbookSnapshots: response.workbookSnapshots.map(mapWorkbookSnapshot),
    nextCursor: response.nextCursor,
  };
}

export function mapWorkbookSnapshotResponse(
  response: WorkbookSnapshotResponse,
): WorkbookSnapshot {
  return mapWorkbookSnapshot(response.workbookSnapshot);
}
