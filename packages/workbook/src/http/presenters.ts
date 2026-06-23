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
} from "../generated/types/index.js";

export function presentWorkbook(result: WorkbookResult): WorkbookResponse {
  return { workbook: toWorkbookDto(result.workbook) };
}

export function presentWorkbooks(result: WorkbooksResult): WorkbooksResponse {
  return {
    nextCursor: result.nextCursor,
    workbooks: result.workbooks.map(toWorkbookDto),
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
    nextCursor: result.nextCursor,
    workbookCalculations: result.workbookCalculations.map(
      toWorkbookCalculationDto,
    ),
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
    nextCursor: result.nextCursor,
    workbookSnapshots: result.workbookSnapshots.map(toWorkbookSnapshotDto),
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
    createdAt: presentDate(calculation.createdAt),
    finishedAt: presentNullableDate(calculation.finishedAt),
    startedAt: presentNullableDate(calculation.startedAt),
    updatedAt: presentDate(calculation.updatedAt),
  };
}

function toWorkbookSnapshotDto(
  snapshot: WorkbookSnapshot,
): WorkbookSnapshotDto {
  return {
    calculationId: snapshot.calculationId,
    createdAt: presentDate(snapshot.createdAt),
    id: snapshot.id,
    questionIndex: snapshot.questionIndex,
    snapshotIndex: snapshot.snapshotIndex,
    sourceId: snapshot.sourceId,
    workbookId: snapshot.workbookId,
  };
}
