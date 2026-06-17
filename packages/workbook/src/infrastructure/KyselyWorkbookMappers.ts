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
  requestedCalculationCount,
  userId,
  type Workbook,
  type WorkbookCalculation,
  type WorkbookSnapshot,
  workbookCalculationId,
  workbookCalculationStatus,
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
    id: workbookId(row.id),
    ownerUserId: userId(row.ownerUserId),
    createdByUserId: userId(row.createdByUserId),
    name: workbookName(row.name),
    fileId: fileId(row.fileId),
    checksumSha256: row.checksumSha256,
    originalName: row.originalName,
    engine: workbookEngineName(row.engine),
    engineVersion: row.engineVersion,
    status: workbookStatus(row.status),
    inspection:
      row.inspection === null ? null : workbookInspection(row.inspection),
    validationError: row.validationError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapWorkbookToInsert(workbook: Workbook): Insertable<Workbooks> {
  return {
    id: workbook.id,
    ownerUserId: workbook.ownerUserId,
    createdByUserId: workbook.createdByUserId,
    name: workbook.name,
    fileId: workbook.fileId,
    checksumSha256: workbook.checksumSha256,
    originalName: workbook.originalName,
    engine: workbook.engine,
    engineVersion: workbook.engineVersion,
    status: workbook.status,
    inspection: workbook.inspection as JsonObject | null,
    validationError: workbook.validationError,
    createdAt: workbook.createdAt,
    updatedAt: workbook.updatedAt,
  };
}

export function mapWorkbookToUpdate(workbook: Workbook): Updateable<Workbooks> {
  return {
    id: workbook.id,
    ownerUserId: workbook.ownerUserId,
    createdByUserId: workbook.createdByUserId,
    name: workbook.name,
    fileId: workbook.fileId,
    checksumSha256: workbook.checksumSha256,
    originalName: workbook.originalName,
    engine: workbook.engine,
    engineVersion: workbook.engineVersion,
    status: workbook.status,
    inspection: workbook.inspection as JsonObject | null,
    validationError: workbook.validationError,
    createdAt: workbook.createdAt,
    updatedAt: workbook.updatedAt,
  };
}

export function mapCalculationRowToDomain(
  row: Selectable<WorkbookCalculations>,
): WorkbookCalculation {
  return {
    id: workbookCalculationId(row.id),
    ownerUserId: userId(row.ownerUserId),
    createdByUserId: userId(row.createdByUserId),
    workbookId: workbookId(row.workbookId),
    requestedCount: requestedCalculationCount(row.requestedCount),
    status: workbookCalculationStatus(row.status),
    correlationId: row.correlationId,
    errorMessage: row.errorMessage,
    attempts: assertNonNegativeInteger(row.attempts, "attempts"),
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapCalculationToInsert(
  calculation: WorkbookCalculation,
): Insertable<WorkbookCalculations> {
  return {
    id: calculation.id,
    ownerUserId: calculation.ownerUserId,
    createdByUserId: calculation.createdByUserId,
    workbookId: calculation.workbookId,
    requestedCount: calculation.requestedCount,
    status: calculation.status,
    correlationId: calculation.correlationId,
    errorMessage: calculation.errorMessage,
    attempts: calculation.attempts,
    startedAt: calculation.startedAt,
    finishedAt: calculation.finishedAt,
    createdAt: calculation.createdAt,
    updatedAt: calculation.updatedAt,
  };
}

export function mapCalculationToUpdate(
  calculation: WorkbookCalculation,
): Updateable<WorkbookCalculations> {
  return {
    id: calculation.id,
    ownerUserId: calculation.ownerUserId,
    createdByUserId: calculation.createdByUserId,
    workbookId: calculation.workbookId,
    requestedCount: calculation.requestedCount,
    status: calculation.status,
    correlationId: calculation.correlationId,
    errorMessage: calculation.errorMessage,
    attempts: calculation.attempts,
    startedAt: calculation.startedAt,
    finishedAt: calculation.finishedAt,
    createdAt: calculation.createdAt,
    updatedAt: calculation.updatedAt,
  };
}

export function mapSnapshotRowToDomain(
  row: Selectable<WorkbookSnapshots>,
): WorkbookSnapshot {
  return {
    id: workbookSnapshotId(row.id),
    workbookId: workbookId(row.workbookId),
    calculationId: workbookCalculationId(row.calculationId),
    snapshotIndex: assertNonNegativeInteger(row.snapshotIndex, "snapshotIndex"),
    values: workbookSparseValues(row.values),
    createdAt: row.createdAt,
  };
}

export function mapSnapshotToInsert(
  snapshot: WorkbookSnapshot,
): Insertable<WorkbookSnapshots> {
  return {
    id: snapshot.id,
    workbookId: snapshot.workbookId,
    calculationId: snapshot.calculationId,
    snapshotIndex: snapshot.snapshotIndex,
    values: snapshot.values as unknown as JsonObject,
    createdAt: snapshot.createdAt,
  };
}
