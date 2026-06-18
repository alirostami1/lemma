import type {
  WorkbookCalculation as WorkbookCalculationDto,
  WorkbookCalculationResponse,
  WorkbookCalculationsResponse,
  Workbook as WorkbookDto,
  WorkbookInspection as WorkbookInspectionDto,
  WorkbookResponse,
  WorkbookSnapshotCells as WorkbookSnapshotCellsDto,
  WorkbookSnapshotCellsResponse,
  WorkbookSnapshot as WorkbookSnapshotDto,
  WorkbookSnapshotMetadata as WorkbookSnapshotMetadataDto,
  WorkbookSnapshotMetadataResponse,
  WorkbookSnapshotRangeBatchItem as WorkbookSnapshotRangeBatchItemDto,
  WorkbookSnapshotRangeBatchResponse,
  WorkbookSnapshotRange as WorkbookSnapshotRangeDto,
  WorkbookSnapshotRangeResponse,
  WorkbookSnapshotResponse,
  WorkbookSnapshotSheet as WorkbookSnapshotSheetDto,
  WorkbookSnapshotSheetsResponse,
  WorkbookSnapshotsResponse,
  WorkbooksResponse,
} from "#/api/generated/model";
import type {
  Workbook,
  WorkbookCalculation,
  WorkbookCalculationsPage,
  WorkbookCellType,
  WorkbookInspection,
  WorkbookSnapshot,
  WorkbookSnapshotCells,
  WorkbookSnapshotMetadata,
  WorkbookSnapshotRange,
  WorkbookSnapshotRangeBatch,
  WorkbookSnapshotRangeBatchItem,
  WorkbookSnapshotSheet,
  WorkbookSnapshotSheetsPage,
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
    createdAt: new Date(dto.createdAt),
  };
}

export function mapWorkbookSnapshotMetadata(
  dto: WorkbookSnapshotMetadataDto,
): WorkbookSnapshotMetadata {
  return {
    ...dto,
    status: "ready",
  };
}

export function mapWorkbookSnapshotSheet(
  dto: WorkbookSnapshotSheetDto,
): WorkbookSnapshotSheet {
  return { ...dto };
}

export function mapWorkbookSnapshotCells(
  dto: WorkbookSnapshotCellsDto,
): WorkbookSnapshotCells {
  return {
    ...dto,
    rows: dto.rows.map((row) => [...row]),
    cellTypes: dto.cellTypes.map((row) =>
      row.map((cellType) => cellType as WorkbookCellType),
    ),
  };
}

export function mapWorkbookSnapshotRange(
  dto: WorkbookSnapshotRangeDto,
): WorkbookSnapshotRange {
  return {
    ...mapWorkbookSnapshotCells(dto),
    ref: dto.ref,
    startCellAddress: dto.startCellAddress,
    endCellAddress: dto.endCellAddress,
  };
}

export function mapWorkbookSnapshotRangeBatchItem(
  dto: WorkbookSnapshotRangeBatchItemDto,
): WorkbookSnapshotRangeBatchItem {
  if (dto.status === "ok" && dto.range) {
    return {
      ref: dto.ref,
      status: "ok",
      range: mapWorkbookSnapshotRange(dto.range),
      errorMessage: null,
    };
  }

  return {
    ref: dto.ref,
    status: "error",
    range: null,
    errorMessage: dto.errorMessage ?? "Range could not be loaded.",
  };
}

export function mapWorkbookSnapshotRangeBatchResponse(
  response: WorkbookSnapshotRangeBatchResponse,
): WorkbookSnapshotRangeBatch {
  return {
    ranges: response.workbookSnapshotRangeBatch.ranges.map(
      mapWorkbookSnapshotRangeBatchItem,
    ),
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

export function mapWorkbookSnapshotMetadataResponse(
  response: WorkbookSnapshotMetadataResponse,
): WorkbookSnapshotMetadata {
  return mapWorkbookSnapshotMetadata(response.workbookSnapshotMetadata);
}

export function mapWorkbookSnapshotSheetsResponse(
  response: WorkbookSnapshotSheetsResponse,
): WorkbookSnapshotSheetsPage {
  return {
    workbookSnapshotSheets: response.workbookSnapshotSheets.map(
      mapWorkbookSnapshotSheet,
    ),
    nextCursor: response.nextCursor,
  };
}

export function mapWorkbookSnapshotCellsResponse(
  response: WorkbookSnapshotCellsResponse,
): WorkbookSnapshotCells {
  return mapWorkbookSnapshotCells(response.workbookSnapshotCells);
}

export function mapWorkbookSnapshotRangeResponse(
  response: WorkbookSnapshotRangeResponse,
): WorkbookSnapshotRange {
  return mapWorkbookSnapshotRange(response.workbookSnapshotRange);
}
