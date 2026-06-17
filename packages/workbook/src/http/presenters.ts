import type {
  WorkbookCalculationDto,
  WorkbookCalculationsResult,
  WorkbookResult,
  WorkbookSnapshotResult,
  WorkbookSnapshotsResult,
  WorkbookSnapshotValueResult,
  WorkbooksResult,
} from "../application/index.js";
import type {
  Workbook,
  WorkbookCalculation,
  WorkbookEngineHealth,
  WorkbookSnapshot,
} from "../domain/index.js";

export function presentWorkbook(result: WorkbookResult) {
  return { workbook: presentWorkbookModel(result.workbook) };
}

export function presentWorkbooks(result: WorkbooksResult) {
  return {
    workbooks: result.workbooks.map(presentWorkbookModel),
    nextCursor: result.nextCursor,
  };
}

export function presentWorkbookCalculation(result: WorkbookCalculationDto) {
  return {
    workbookCalculation: presentWorkbookCalculationModel(
      result.workbookCalculation,
    ),
  };
}

export function presentWorkbookCalculations(
  result: WorkbookCalculationsResult,
) {
  return {
    workbookCalculations: result.workbookCalculations.map(
      presentWorkbookCalculationModel,
    ),
    nextCursor: result.nextCursor,
  };
}

export function presentWorkbookSnapshot(result: WorkbookSnapshotResult) {
  return {
    workbookSnapshot: presentWorkbookSnapshotModel(result.workbookSnapshot),
  };
}

export function presentWorkbookSnapshots(result: WorkbookSnapshotsResult) {
  return {
    workbookSnapshots: result.workbookSnapshots.map(
      presentWorkbookSnapshotModel,
    ),
    nextCursor: result.nextCursor,
  };
}

export function presentWorkbookSnapshotValue(
  result: WorkbookSnapshotValueResult,
) {
  return { value: result.value };
}

export function presentWorkbookEngineHealth(result: {
  health: WorkbookEngineHealth;
}) {
  return { health: result.health };
}

function presentWorkbookModel(workbook: Workbook) {
  return {
    ...workbook,
    createdAt: workbook.createdAt.toISOString(),
    updatedAt: workbook.updatedAt.toISOString(),
  };
}

function presentWorkbookCalculationModel(calculation: WorkbookCalculation) {
  return {
    ...calculation,
    startedAt: calculation.startedAt?.toISOString() ?? null,
    finishedAt: calculation.finishedAt?.toISOString() ?? null,
    createdAt: calculation.createdAt.toISOString(),
    updatedAt: calculation.updatedAt.toISOString(),
  };
}

function presentWorkbookSnapshotModel(snapshot: WorkbookSnapshot) {
  return {
    ...snapshot,
    createdAt: snapshot.createdAt.toISOString(),
  };
}
