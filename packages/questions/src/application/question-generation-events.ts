import type { JsonObject, OperationLineage } from "@lemma/domain";
import {
  type DomainEventEnvelope,
  domainEventEnvelope,
} from "@lemma/events/domain";
import {
  QUESTION_GENERATION_RUN_CANCELLED_EVENT,
  QUESTION_GENERATION_RUN_FAILED_EVENT,
  QUESTION_GENERATION_RUN_MATERIALIZING_EVENT,
  QUESTION_GENERATION_RUN_REQUESTED_EVENT,
  QUESTION_GENERATION_RUN_SUCCEEDED_EVENT,
  QUESTION_GENERATION_RUN_WAITING_FOR_WORKBOOK_CALCULATION_EVENT,
  QUESTION_SET_QUESTIONS_ADDED_EVENT,
  type QuestionGenerationRun,
} from "../domain/index.js";

export {
  QUESTION_GENERATION_RUN_CANCELLED_EVENT,
  QUESTION_GENERATION_RUN_FAILED_EVENT,
  QUESTION_GENERATION_RUN_MATERIALIZING_EVENT,
  QUESTION_GENERATION_RUN_REQUESTED_EVENT,
  QUESTION_GENERATION_RUN_SUCCEEDED_EVENT,
  QUESTION_GENERATION_RUN_WAITING_FOR_WORKBOOK_CALCULATION_EVENT,
  QUESTION_SET_QUESTIONS_ADDED_EVENT,
};

function toMutableJsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

export type QuestionGenerationRunRequestedPayload = JsonObject & {
  questionGenerationRunId: string;
  blueprintId: string;
  blueprintSnapshot: JsonObject;
  targetQuestionSetId: string;
  requestedCount: number;
  workbookCalculationId: string | null;
  retryOfRunId: string | null;
  attemptNumber: number;
};

export function questionGenerationRunRequestedEvent(input: {
  id: string;
  run: QuestionGenerationRun;
  lineage: OperationLineage;
  occurredAt: Date;
}): DomainEventEnvelope<QuestionGenerationRunRequestedPayload> {
  const payload = {
    attemptNumber: input.run.attemptNumber,
    blueprintId: input.run.blueprintId,
    blueprintSnapshot: toMutableJsonObject(input.run.blueprintSnapshot),
    questionGenerationRunId: input.run.id,
    requestedCount: input.run.requestedCount,
    retryOfRunId: input.run.retryOfRunId,
    targetQuestionSetId: input.run.targetQuestionSetId,
    workbookCalculationId: input.run.workbookCalculationId,
  } satisfies QuestionGenerationRunRequestedPayload;

  return domainEventEnvelope({
    aggregate: {
      id: input.run.id,
      type: "question_generation_run",
    },
    id: input.id,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    ownerUserId: input.run.ownerUserId,
    payload,
    schemaVersion: 1,
    type: QUESTION_GENERATION_RUN_REQUESTED_EVENT,
  });
}

export type QuestionGenerationRunStateChangedPayload = JsonObject & {
  questionGenerationRunId: string;
  status: QuestionGenerationRun["status"];
  workbookCalculationId: string | null;
  retryOfRunId: string | null;
  attemptNumber: number;
};

export type QuestionGenerationRunSucceededPayload = JsonObject & {
  questionGenerationRunId: string;
  questionIds: string[];
};

export type QuestionGenerationRunFailedPayload = JsonObject & {
  questionGenerationRunId: string;
  errorMessage: string;
};

export type QuestionSetQuestionsAddedPayload = JsonObject & {
  questionSetId: string;
  questionGenerationRunId: string;
  questionIds: string[];
};

export function questionGenerationRunWaitingForWorkbookCalculationEvent(input: {
  id: string;
  run: QuestionGenerationRun;
  lineage: OperationLineage;
  occurredAt: Date;
}): DomainEventEnvelope<QuestionGenerationRunStateChangedPayload> {
  return questionGenerationRunStateChangedEvent({
    id: input.id,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    run: input.run,
    type: QUESTION_GENERATION_RUN_WAITING_FOR_WORKBOOK_CALCULATION_EVENT,
  });
}

export function questionGenerationRunMaterializingEvent(input: {
  id: string;
  run: QuestionGenerationRun;
  lineage: OperationLineage;
  occurredAt: Date;
}): DomainEventEnvelope<QuestionGenerationRunStateChangedPayload> {
  return questionGenerationRunStateChangedEvent({
    id: input.id,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    run: input.run,
    type: QUESTION_GENERATION_RUN_MATERIALIZING_EVENT,
  });
}

export function questionGenerationRunSucceededEvent(input: {
  id: string;
  run: QuestionGenerationRun;
  lineage: OperationLineage;
  occurredAt: Date;
}): DomainEventEnvelope<QuestionGenerationRunSucceededPayload> {
  const payload = {
    questionGenerationRunId: input.run.id,
    questionIds: input.run.result?.questionIds ?? [],
  } satisfies QuestionGenerationRunSucceededPayload;

  return questionGenerationRunEventEnvelope({
    id: input.id,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    payload,
    run: input.run,
    type: QUESTION_GENERATION_RUN_SUCCEEDED_EVENT,
  });
}

export function questionGenerationRunFailedEvent(input: {
  id: string;
  run: QuestionGenerationRun;
  lineage: OperationLineage;
  occurredAt: Date;
}): DomainEventEnvelope<QuestionGenerationRunFailedPayload> {
  const payload = {
    errorMessage: input.run.errorMessage ?? "Question generation failed.",
    questionGenerationRunId: input.run.id,
  } satisfies QuestionGenerationRunFailedPayload;

  return questionGenerationRunEventEnvelope({
    id: input.id,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    payload,
    run: input.run,
    type: QUESTION_GENERATION_RUN_FAILED_EVENT,
  });
}

export function questionGenerationRunCancelledEvent(input: {
  id: string;
  run: QuestionGenerationRun;
  lineage: OperationLineage;
  occurredAt: Date;
}): DomainEventEnvelope<QuestionGenerationRunStateChangedPayload> {
  return questionGenerationRunStateChangedEvent({
    id: input.id,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    run: input.run,
    type: QUESTION_GENERATION_RUN_CANCELLED_EVENT,
  });
}

export function questionSetQuestionsAddedEvent(input: {
  id: string;
  run: QuestionGenerationRun;
  questionIds: readonly string[];
  lineage: OperationLineage;
  occurredAt: Date;
}): DomainEventEnvelope<QuestionSetQuestionsAddedPayload> {
  const payload = {
    questionGenerationRunId: input.run.id,
    questionIds: [...input.questionIds],
    questionSetId: input.run.targetQuestionSetId,
  } satisfies QuestionSetQuestionsAddedPayload;

  return domainEventEnvelope({
    aggregate: {
      id: input.run.targetQuestionSetId,
      type: "question_set",
    },
    id: input.id,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    ownerUserId: input.run.ownerUserId,
    payload,
    schemaVersion: 1,
    type: QUESTION_SET_QUESTIONS_ADDED_EVENT,
  });
}

function questionGenerationRunStateChangedEvent(input: {
  id: string;
  type: string;
  run: QuestionGenerationRun;
  lineage: OperationLineage;
  occurredAt: Date;
}): DomainEventEnvelope<QuestionGenerationRunStateChangedPayload> {
  const payload = {
    attemptNumber: input.run.attemptNumber,
    questionGenerationRunId: input.run.id,
    retryOfRunId: input.run.retryOfRunId,
    status: input.run.status,
    workbookCalculationId: input.run.workbookCalculationId,
  } satisfies QuestionGenerationRunStateChangedPayload;

  return questionGenerationRunEventEnvelope({
    id: input.id,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    payload,
    run: input.run,
    type: input.type,
  });
}

function questionGenerationRunEventEnvelope<
  TPayload extends JsonObject,
>(input: {
  id: string;
  type: string;
  run: QuestionGenerationRun;
  lineage: OperationLineage;
  occurredAt: Date;
  payload: TPayload;
}): DomainEventEnvelope<TPayload> {
  return domainEventEnvelope({
    aggregate: {
      id: input.run.id,
      type: "question_generation_run",
    },
    id: input.id,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    ownerUserId: input.run.ownerUserId,
    payload: input.payload,
    schemaVersion: 1,
    type: input.type,
  });
}
