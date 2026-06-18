import { presentDate, presentNullableDate } from "@lemma/http";
import type {
  WorkbookCalculationDto,
  WorkbookCalculationsResult,
  WorkbookEngineHealthResult,
  WorkbookResult,
  WorkbookSnapshotCellsResult,
  WorkbookSnapshotMetadataResult,
  WorkbookSnapshotRangeBatchResult,
  WorkbookSnapshotRangeResult,
  WorkbookSnapshotResult,
  WorkbookSnapshotSheetsResult,
  WorkbookSnapshotsResult,
  WorkbookSnapshotValueResult,
  WorkbooksResult,
} from "../application/index.js";
import type {
  Workbook,
  WorkbookCalculation,
  WorkbookSnapshot,
} from "../domain/index.js";
import type {
  WorkbookCalculationResponse,
  WorkbookCalculation as WorkbookCalculationResponseDto,
  WorkbookCalculationsResponse,
  Workbook as WorkbookDto,
  WorkbookEngineHealthResponse,
  WorkbookResponse,
  WorkbookSnapshotCellsResponse,
  WorkbookSnapshot as WorkbookSnapshotDto,
  WorkbookSnapshotMetadataResponse,
  WorkbookSnapshotRangeBatchResponse,
  WorkbookSnapshotRangeResponse,
  WorkbookSnapshotResponse,
  WorkbookSnapshotSheetsResponse,
  WorkbookSnapshotsResponse,
  WorkbookSnapshotValueResponse,
  WorkbooksResponse,
} from "../gen/types/index.js";

export function presentWorkbook(result: WorkbookResult): WorkbookResponse {
  return { workbook: toWorkbookDto(result.workbook) };
}

export function presentWorkbooks(result: WorkbooksResult): WorkbooksResponse {
  return {
    workbooks: result.workbooks.map(toWorkbookDto),
    nextCursor: result.nextCursor,
  };
}

export function presentWorkbookCalculation(
  result: WorkbookCalculationDto,
): WorkbookCalculationResponse {
  return {
    workbookCalculation: toWorkbookCalculationDto(result.workbookCalculation),
  };
}

export function presentWorkbookCalculations(
  result: WorkbookCalculationsResult,
): WorkbookCalculationsResponse {
  return {
    workbookCalculations: result.workbookCalculations.map(
      toWorkbookCalculationDto,
    ),
    nextCursor: result.nextCursor,
  };
}

export function presentWorkbookSnapshot(
  result: WorkbookSnapshotResult,
): WorkbookSnapshotResponse {
  return {
    workbookSnapshot: toWorkbookSnapshotDto(result.workbookSnapshot),
  };
}

export function presentWorkbookSnapshotMetadata(
  result: WorkbookSnapshotMetadataResult,
): WorkbookSnapshotMetadataResponse {
  return { workbookSnapshotMetadata: result.workbookSnapshotMetadata };
}

export function presentWorkbookSnapshotSheets(
  result: WorkbookSnapshotSheetsResult,
): WorkbookSnapshotSheetsResponse {
  return result;
}

export function presentWorkbookSnapshotCells(
  result: WorkbookSnapshotCellsResult,
): WorkbookSnapshotCellsResponse {
  return { workbookSnapshotCells: result.workbookSnapshotCells };
}

export function presentWorkbookSnapshotRange(
  result: WorkbookSnapshotRangeResult,
): WorkbookSnapshotRangeResponse {
  return { workbookSnapshotRange: result.workbookSnapshotRange };
}

export function presentWorkbookSnapshotRangeBatch(
  result: WorkbookSnapshotRangeBatchResult,
): WorkbookSnapshotRangeBatchResponse {
  return { workbookSnapshotRangeBatch: result.workbookSnapshotRangeBatch };
}

export function presentWorkbookSnapshots(
  result: WorkbookSnapshotsResult,
): WorkbookSnapshotsResponse {
  return {
    workbookSnapshots: result.workbookSnapshots.map(toWorkbookSnapshotDto),
    nextCursor: result.nextCursor,
  };
}

export function presentWorkbookSnapshotValue(
  result: WorkbookSnapshotValueResult,
): WorkbookSnapshotValueResponse {
  return { value: result.value };
}

export function presentWorkbookEngineHealth(
  result: WorkbookEngineHealthResult,
): WorkbookEngineHealthResponse {
  return { health: result.health };
}

function toWorkbookDto(workbook: Workbook): WorkbookDto {
  return {
    ...workbook,
    createdAt: presentDate(workbook.createdAt),
    updatedAt: presentDate(workbook.updatedAt),
  };
}

function toWorkbookCalculationDto(
  calculation: WorkbookCalculation,
): WorkbookCalculationResponseDto {
  return {
    ...calculation,
    startedAt: presentNullableDate(calculation.startedAt),
    finishedAt: presentNullableDate(calculation.finishedAt),
    createdAt: presentDate(calculation.createdAt),
    updatedAt: presentDate(calculation.updatedAt),
  };
}

function toWorkbookSnapshotDto(
  snapshot: WorkbookSnapshot,
): WorkbookSnapshotDto {
  return {
    id: snapshot.id,
    workbookId: snapshot.workbookId,
    calculationId: snapshot.calculationId,
    snapshotIndex: snapshot.snapshotIndex,
    createdAt: presentDate(snapshot.createdAt),
  };
}
