import { presentDate, presentNullableDate } from "@lemma/http";
import type {
  WorkbookCalculationDto,
  WorkbookCalculationsResult,
  WorkbookEngineHealthResult,
  WorkbookResult,
  WorkbookSnapshotResult,
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
  WorkbookCalculationsResponse,
  WorkbookEngineHealthResponse,
  WorkbookResponse,
  WorkbookSnapshotResponse,
  WorkbookSnapshotsResponse,
  WorkbookSnapshotValueResponse,
  WorkbooksResponse,
} from "../gen/types/index.js";

export function presentWorkbook(result: WorkbookResult): WorkbookResponse {
  return { workbook: presentWorkbookModel(result.workbook) };
}

export function presentWorkbooks(result: WorkbooksResult): WorkbooksResponse {
  return {
    workbooks: result.workbooks.map(presentWorkbookModel),
    nextCursor: result.nextCursor,
  };
}

export function presentWorkbookCalculation(
  result: WorkbookCalculationDto,
): WorkbookCalculationResponse {
  return {
    workbookCalculation: presentWorkbookCalculationModel(
      result.workbookCalculation,
    ),
  };
}

export function presentWorkbookCalculations(
  result: WorkbookCalculationsResult,
): WorkbookCalculationsResponse {
  return {
    workbookCalculations: result.workbookCalculations.map(
      presentWorkbookCalculationModel,
    ),
    nextCursor: result.nextCursor,
  };
}

export function presentWorkbookSnapshot(
  result: WorkbookSnapshotResult,
): WorkbookSnapshotResponse {
  return {
    workbookSnapshot: presentWorkbookSnapshotModel(result.workbookSnapshot),
  };
}

export function presentWorkbookSnapshots(
  result: WorkbookSnapshotsResult,
): WorkbookSnapshotsResponse {
  return {
    workbookSnapshots: result.workbookSnapshots.map(
      presentWorkbookSnapshotModel,
    ),
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

function presentWorkbookModel(workbook: Workbook) {
  return {
    ...workbook,
    createdAt: presentDate(workbook.createdAt),
    updatedAt: presentDate(workbook.updatedAt),
  };
}

function presentWorkbookCalculationModel(calculation: WorkbookCalculation) {
  return {
    ...calculation,
    startedAt: presentNullableDate(calculation.startedAt),
    finishedAt: presentNullableDate(calculation.finishedAt),
    createdAt: presentDate(calculation.createdAt),
    updatedAt: presentDate(calculation.updatedAt),
  };
}

function presentWorkbookSnapshotModel(snapshot: WorkbookSnapshot) {
  return {
    ...snapshot,
    createdAt: presentDate(snapshot.createdAt),
  };
}
