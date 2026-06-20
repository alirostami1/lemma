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
  workbookId: string;
  sources: WorkbookCalculationSource[];
  requestedCount: number;
  correlationId: string | null;
};

export type WorkbookCalculationFinishedPayload = JsonObject & {
  workbookCalculationId: string;
  workbookId: string;
  sources: WorkbookCalculationSource[];
  correlationId: string | null;
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
    type: WORKBOOK_VALIDATION_REQUESTED_EVENT,
    workbook: input.workbook,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    payload: {
      workbookId: input.workbook.id,
      fileId: input.workbook.fileId,
      checksumSha256: input.workbook.checksumSha256,
    },
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
    type:
      input.workbook.status === "valid"
        ? WORKBOOK_VALIDATION_SUCCEEDED_EVENT
        : WORKBOOK_VALIDATION_FAILED_EVENT,
    workbook: input.workbook,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    payload: {
      workbookId: input.workbook.id,
      status: input.workbook.status,
      engineVersion: input.workbook.engineVersion,
      validationError: input.workbook.validationError,
    },
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
    id: input.id,
    type: WORKBOOK_CALCULATION_REQUESTED_EVENT,
    calculation: input.calculation,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    payload: {
      workbookCalculationId: input.calculation.id,
      workbookId: input.calculation.workbookId,
      sources: input.sources.map((source) => ({ ...source })),
      requestedCount: input.calculation.requestedCount,
      correlationId: input.calculation.correlationId,
    },
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
    id: input.id,
    type:
      input.calculation.status === "succeeded"
        ? WORKBOOK_CALCULATION_SUCCEEDED_EVENT
        : WORKBOOK_CALCULATION_FAILED_EVENT,
    calculation: input.calculation,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    payload: {
      workbookCalculationId: input.calculation.id,
      workbookId: input.calculation.workbookId,
      sources: input.sources.map((source) => ({ ...source })),
      correlationId: input.calculation.correlationId,
      status: input.calculation.status,
      requestedCount: input.calculation.requestedCount,
      snapshotIds: input.snapshots?.map((snapshot) => snapshot.id) ?? [],
      errorMessage: input.calculation.errorMessage,
    },
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
    id: input.id,
    type: input.type,
    schemaVersion: 1,
    aggregate: {
      type: "workbook",
      id: input.workbook.id,
    },
    ownerUserId: input.workbook.ownerUserId,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    payload: input.payload,
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
    id: input.id,
    type: input.type,
    schemaVersion: 1,
    aggregate: {
      type: "workbook_calculation",
      id: input.calculation.id,
    },
    ownerUserId: input.calculation.ownerUserId,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    payload: input.payload,
  });
}
