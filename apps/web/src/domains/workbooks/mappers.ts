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
    createdAt: new Date(dto.createdAt),
    inspection: dto.inspection ? mapWorkbookInspection(dto.inspection) : null,
    updatedAt: new Date(dto.updatedAt),
  };
}

export function mapWorkbookCalculation(
  dto: WorkbookCalculationDto,
): WorkbookCalculation {
  return {
    ...dto,
    createdAt: new Date(dto.createdAt),
    finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : null,
    startedAt: dto.startedAt ? new Date(dto.startedAt) : null,
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
    cellTypes: dto.cellTypes.map((row) =>
      row.map((cellType) => cellType as WorkbookCellType),
    ),
    rows: dto.rows.map((row) => [...row]),
  };
}

export function mapWorkbookSnapshotRange(
  dto: WorkbookSnapshotRangeDto,
): WorkbookSnapshotRange {
  return {
    ...mapWorkbookSnapshotCells(dto),
    endCellAddress: dto.endCellAddress,
    ref: dto.ref,
    startCellAddress: dto.startCellAddress,
  };
}

export function mapWorkbookSnapshotRangeBatchItem(
  dto: WorkbookSnapshotRangeBatchItemDto,
): WorkbookSnapshotRangeBatchItem {
  if (dto.status === "ok" && dto.range) {
    return {
      errorMessage: null,
      range: mapWorkbookSnapshotRange(dto.range),
      ref: dto.ref,
      status: "ok",
    };
  }

  return {
    errorMessage: dto.errorMessage ?? "Range could not be loaded.",
    range: null,
    ref: dto.ref,
    status: "error",
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
    nextCursor: response.nextCursor,
    workbooks: response.workbooks.map(mapWorkbook),
  };
}

export function mapWorkbookResponse(response: WorkbookResponse): Workbook {
  return mapWorkbook(response.workbook);
}

export function mapWorkbookCalculationsResponse(
  response: WorkbookCalculationsResponse,
): WorkbookCalculationsPage {
  return {
    nextCursor: response.nextCursor,
    workbookCalculations: response.workbookCalculations.map(
      mapWorkbookCalculation,
    ),
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
    nextCursor: response.nextCursor,
    workbookSnapshots: response.workbookSnapshots.map(mapWorkbookSnapshot),
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
    nextCursor: response.nextCursor,
    workbookSnapshotSheets: response.workbookSnapshotSheets.map(
      mapWorkbookSnapshotSheet,
    ),
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
