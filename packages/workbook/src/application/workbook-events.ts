import type { JsonObject, OperationLineage } from "@lemma/domain";
import {
  type DomainEventEnvelope,
  domainEventEnvelope,
} from "@lemma/events/domain";
import {
  WORKBOOK_CALCULATION_FAILED_EVENT,
  WORKBOOK_CALCULATION_REQUESTED_EVENT,
  WORKBOOK_CALCULATION_SUCCEEDED_EVENT,
  WORKBOOK_VALIDATION_FAILED_EVENT,
  WORKBOOK_VALIDATION_REQUESTED_EVENT,
  WORKBOOK_VALIDATION_SUCCEEDED_EVENT,
  type Workbook,
  type WorkbookCalculation,
  type WorkbookSnapshot,
} from "../domain/index.js";
import type { WorkbookCalculationSource } from "./workbook-calculation-sources.js";

export {
  WORKBOOK_CALCULATION_FAILED_EVENT,
  WORKBOOK_CALCULATION_REQUESTED_EVENT,
  WORKBOOK_CALCULATION_SUCCEEDED_EVENT,
  WORKBOOK_VALIDATION_FAILED_EVENT,
  WORKBOOK_VALIDATION_REQUESTED_EVENT,
  WORKBOOK_VALIDATION_SUCCEEDED_EVENT,
};

export type WorkbookValidationRequestedPayload = JsonObject & {
  workbookId: string;
  fileId: string;
  checksumSha256: string;
};

export type WorkbookValidationFinishedPayload = JsonObject & {
  workbookId: string;
  status: Workbook["status"];
  engineVersion: string | null;
  validationError: string | null;
};

export type WorkbookCalculationRequestedPayload = JsonObject & {
  workbookCalculationId: string;
  sources: WorkbookCalculationSource[];
  requestedCount: number;
  correlationId: string | null;
  retryOfCalculationId: string | null;
  attemptNumber: number;
};

export type WorkbookCalculationFinishedPayload = JsonObject & {
  workbookCalculationId: string;
  sources?: WorkbookCalculationSource[];
  correlationId: string | null;
  retryOfCalculationId: string | null;
  attemptNumber: number;
  status: WorkbookCalculation["status"];
  requestedCount: number;
  snapshotIds: string[];
  errorMessage: string | null;
};

export function workbookValidationRequestedEvent(input: {
  id: string;
  workbook: Workbook;
  lineage: OperationLineage;
  occurredAt: Date;
}): DomainEventEnvelope<WorkbookValidationRequestedPayload> {
  return workbookEventEnvelope({
    id: input.id,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    payload: {
      checksumSha256: input.workbook.checksumSha256,
      fileId: input.workbook.fileId,
      workbookId: input.workbook.id,
    },
    type: WORKBOOK_VALIDATION_REQUESTED_EVENT,
    workbook: input.workbook,
  });
}

export function workbookValidationFinishedEvent(input: {
  id: string;
  workbook: Workbook;
  lineage: OperationLineage;
  occurredAt: Date;
}): DomainEventEnvelope<WorkbookValidationFinishedPayload> {
  return workbookEventEnvelope({
    id: input.id,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    payload: {
      engineVersion: input.workbook.engineVersion,
      status: input.workbook.status,
      validationError: input.workbook.validationError,
      workbookId: input.workbook.id,
    },
    type:
      input.workbook.status === "valid"
        ? WORKBOOK_VALIDATION_SUCCEEDED_EVENT
        : WORKBOOK_VALIDATION_FAILED_EVENT,
    workbook: input.workbook,
  });
}

export function workbookCalculationRequestedEvent(input: {
  id: string;
  calculation: WorkbookCalculation;
  sources: readonly WorkbookCalculationSource[];
  lineage: OperationLineage;
  occurredAt: Date;
}): DomainEventEnvelope<WorkbookCalculationRequestedPayload> {
  return workbookCalculationEventEnvelope({
    calculation: input.calculation,
    id: input.id,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    payload: {
      attemptNumber: input.calculation.attemptNumber,
      correlationId: input.calculation.correlationId,
      requestedCount: input.calculation.requestedCount,
      retryOfCalculationId: input.calculation.retryOfCalculationId,
      sources: input.sources.map((source) => ({ ...source })),
      workbookCalculationId: input.calculation.id,
    },
    type: WORKBOOK_CALCULATION_REQUESTED_EVENT,
  });
}

export function workbookCalculationFinishedEvent(input: {
  id: string;
  calculation: WorkbookCalculation;
  sources: readonly WorkbookCalculationSource[];
  snapshots?: readonly WorkbookSnapshot[];
  lineage: OperationLineage;
  occurredAt: Date;
}): DomainEventEnvelope<WorkbookCalculationFinishedPayload> {
  return workbookCalculationEventEnvelope({
    calculation: input.calculation,
    id: input.id,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    payload: {
      attemptNumber: input.calculation.attemptNumber,
      correlationId: input.calculation.correlationId,
      errorMessage: input.calculation.errorMessage,
      requestedCount: input.calculation.requestedCount,
      retryOfCalculationId: input.calculation.retryOfCalculationId,
      snapshotIds: input.snapshots?.map((snapshot) => snapshot.id) ?? [],
      sources: input.sources.map((source) => ({ ...source })),
      status: input.calculation.status,
      workbookCalculationId: input.calculation.id,
    },
    type:
      input.calculation.status === "succeeded"
        ? WORKBOOK_CALCULATION_SUCCEEDED_EVENT
        : WORKBOOK_CALCULATION_FAILED_EVENT,
  });
}

function workbookEventEnvelope<TPayload extends JsonObject>(input: {
  id: string;
  type: string;
  workbook: Workbook;
  lineage: OperationLineage;
  occurredAt: Date;
  payload: TPayload;
}): DomainEventEnvelope<TPayload> {
  return domainEventEnvelope({
    aggregate: {
      id: input.workbook.id,
      type: "workbook",
    },
    id: input.id,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    ownerUserId: input.workbook.ownerUserId,
    payload: input.payload,
    schemaVersion: 1,
    type: input.type,
  });
}

function workbookCalculationEventEnvelope<TPayload extends JsonObject>(input: {
  id: string;
  type: string;
  calculation: WorkbookCalculation;
  lineage: OperationLineage;
  occurredAt: Date;
  payload: TPayload;
}): DomainEventEnvelope<TPayload> {
  return domainEventEnvelope({
    aggregate: {
      id: input.calculation.id,
      type: "workbook_calculation",
    },
    id: input.id,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    ownerUserId: input.calculation.ownerUserId,
    payload: input.payload,
    schemaVersion: 1,
    type: input.type,
  });
}
