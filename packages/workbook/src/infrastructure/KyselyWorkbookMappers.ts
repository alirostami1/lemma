import type {
  WorkbookCalculations,
  WorkbookSnapshots,
  Workbooks,
} from "@lemma/db/tables";
import type { JsonObject } from "@lemma/domain";
import type { Insertable, Selectable, Updateable } from "kysely";
import {
  assertNonNegativeInteger,
  fileId,
  reconstituteWorkbookCalculation,
  userId,
  type Workbook,
  type WorkbookCalculation,
  type WorkbookSnapshot,
  workbookCalculationId,
  workbookEngineName,
  workbookId,
  workbookInspection,
  workbookName,
  workbookSnapshotId,
  workbookSparseValues,
  workbookStatus,
} from "../domain/index.js";

export function mapWorkbookRowToDomain(row: Selectable<Workbooks>): Workbook {
  return {
    checksumSha256: row.checksumSha256,
    createdAt: row.createdAt,
    createdByUserId: userId(row.createdByUserId),
    engine: workbookEngineName(row.engine),
    engineVersion: row.engineVersion,
    fileId: fileId(row.fileId),
    id: workbookId(row.id),
    inspection:
      row.inspection === null ? null : workbookInspection(row.inspection),
    name: workbookName(row.name),
    originalName: row.originalName,
    ownerUserId: userId(row.ownerUserId),
    status: workbookStatus(row.status),
    updatedAt: row.updatedAt,
    validationError: row.validationError,
  };
}

export function mapWorkbookToInsert(workbook: Workbook): Insertable<Workbooks> {
  return {
    checksumSha256: workbook.checksumSha256,
    createdAt: workbook.createdAt,
    createdByUserId: workbook.createdByUserId,
    engine: workbook.engine,
    engineVersion: workbook.engineVersion,
    fileId: workbook.fileId,
    id: workbook.id,
    inspection: workbook.inspection as JsonObject | null,
    name: workbook.name,
    originalName: workbook.originalName,
    ownerUserId: workbook.ownerUserId,
    status: workbook.status,
    updatedAt: workbook.updatedAt,
    validationError: workbook.validationError,
  };
}

export function mapWorkbookToUpdate(workbook: Workbook): Updateable<Workbooks> {
  return {
    checksumSha256: workbook.checksumSha256,
    createdAt: workbook.createdAt,
    createdByUserId: workbook.createdByUserId,
    engine: workbook.engine,
    engineVersion: workbook.engineVersion,
    fileId: workbook.fileId,
    id: workbook.id,
    inspection: workbook.inspection as JsonObject | null,
    name: workbook.name,
    originalName: workbook.originalName,
    ownerUserId: workbook.ownerUserId,
    status: workbook.status,
    updatedAt: workbook.updatedAt,
    validationError: workbook.validationError,
  };
}

export function mapCalculationRowToDomain(
  row: Selectable<WorkbookCalculations>,
): WorkbookCalculation {
  return reconstituteWorkbookCalculation({
    attemptNumber: row.attemptNumber,
    attempts: row.attempts,
    correlationId: row.correlationId,
    createdAt: row.createdAt,
    createdByUserId: userId(row.createdByUserId),
    errorMessage: row.errorMessage,
    finishedAt: row.finishedAt,
    id: row.id,
    ownerUserId: userId(row.ownerUserId),
    requestedCount: row.requestedCount,
    retryOfCalculationId: row.retryOfCalculationId,
    startedAt: row.startedAt,
    status: row.status,
    updatedAt: row.updatedAt,
  });
}

export function mapCalculationToInsert(
  calculation: WorkbookCalculation,
): Insertable<WorkbookCalculations> {
  return {
    attemptNumber: calculation.attemptNumber,
    attempts: calculation.attempts,
    correlationId: calculation.correlationId,
    createdAt: calculation.createdAt,
    createdByUserId: calculation.createdByUserId,
    errorMessage: calculation.errorMessage,
    finishedAt: calculation.finishedAt,
    id: calculation.id,
    ownerUserId: calculation.ownerUserId,
    requestedCount: calculation.requestedCount,
    retryOfCalculationId: calculation.retryOfCalculationId,
    startedAt: calculation.startedAt,
    status: calculation.status,
    updatedAt: calculation.updatedAt,
  };
}

export function mapCalculationToUpdate(
  calculation: WorkbookCalculation,
): Updateable<WorkbookCalculations> {
  return {
    attemptNumber: calculation.attemptNumber,
    attempts: calculation.attempts,
    correlationId: calculation.correlationId,
    createdAt: calculation.createdAt,
    createdByUserId: calculation.createdByUserId,
    errorMessage: calculation.errorMessage,
    finishedAt: calculation.finishedAt,
    id: calculation.id,
    ownerUserId: calculation.ownerUserId,
    requestedCount: calculation.requestedCount,
    retryOfCalculationId: calculation.retryOfCalculationId,
    startedAt: calculation.startedAt,
    status: calculation.status,
    updatedAt: calculation.updatedAt,
  };
}

export function mapSnapshotRowToDomain(
  row: Selectable<WorkbookSnapshots> & {
    sourceId: string;
    questionIndex: number;
  },
): WorkbookSnapshot {
  return {
    calculationId: workbookCalculationId(row.calculationId),
    createdAt: row.createdAt,
    id: workbookSnapshotId(row.id),
    questionIndex: assertNonNegativeInteger(row.questionIndex, "questionIndex"),
    snapshotIndex: assertNonNegativeInteger(row.snapshotIndex, "snapshotIndex"),
    sourceId: row.sourceId,
    values: workbookSparseValues(row.values),
    workbookId: workbookId(row.workbookId),
  };
}

export function mapSnapshotToInsert(
  snapshot: WorkbookSnapshot,
): Insertable<WorkbookSnapshots> {
  return {
    calculationId: snapshot.calculationId,
    createdAt: snapshot.createdAt,
    id: snapshot.id,
    questionIndex: snapshot.questionIndex,
    snapshotIndex: snapshot.snapshotIndex,
    sourceId: snapshot.sourceId,
    values: snapshot.values as JsonObject,
    workbookId: snapshot.workbookId,
  };
}
