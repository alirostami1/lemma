import type { JsonObject, OperationLineage } from "@lemma/domain";
import {
  domainEventEnvelope,
  type DomainEventEnvelope,
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

export type QuestionGenerationRunRequestedPayload = JsonObject & {
  questionGenerationRunId: string;
  blueprintId: string;
  blueprintVersionId: string;
  targetQuestionSetId: string;
  requestedCount: number;
  source: (JsonObject & {
    type: "workbook_snapshot";
    workbookId: string;
    workbookVersionId: string | null;
    workbookCalculationId: string | null;
    workbookSnapshotId: string | null;
  }) | null;
};

export function questionGenerationRunRequestedEvent(input: {
  id: string;
  run: QuestionGenerationRun;
  lineage: OperationLineage;
  occurredAt: Date;
}): DomainEventEnvelope<QuestionGenerationRunRequestedPayload> {
  const payload = {
    questionGenerationRunId: input.run.id,
    blueprintId: input.run.blueprintId,
    blueprintVersionId: input.run.blueprintVersionId,
    targetQuestionSetId: input.run.targetQuestionSetId,
    requestedCount: input.run.requestedCount,
    source: input.run.source
      ? {
          type: input.run.source.type,
          workbookId: input.run.source.workbookId,
          workbookVersionId: input.run.source.workbookVersionId,
          workbookCalculationId: input.run.source.workbookCalculationId,
          workbookSnapshotId: input.run.source.workbookSnapshotId,
        }
      : null,
  } satisfies QuestionGenerationRunRequestedPayload;

  return domainEventEnvelope({
    id: input.id,
    type: QUESTION_GENERATION_RUN_REQUESTED_EVENT,
    schemaVersion: 1,
    aggregate: {
      type: "question_generation_run",
      id: input.run.id,
    },
    ownerUserId: input.run.ownerUserId,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    payload,
  });
}

export type QuestionGenerationRunStateChangedPayload = JsonObject & {
  questionGenerationRunId: string;
  status: QuestionGenerationRun["status"];
  workbookCalculationId: string | null;
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
    type: QUESTION_GENERATION_RUN_WAITING_FOR_WORKBOOK_CALCULATION_EVENT,
    run: input.run,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
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
    type: QUESTION_GENERATION_RUN_MATERIALIZING_EVENT,
    run: input.run,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
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
    type: QUESTION_GENERATION_RUN_SUCCEEDED_EVENT,
    run: input.run,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    payload,
  });
}

export function questionGenerationRunFailedEvent(input: {
  id: string;
  run: QuestionGenerationRun;
  lineage: OperationLineage;
  occurredAt: Date;
}): DomainEventEnvelope<QuestionGenerationRunFailedPayload> {
  const payload = {
    questionGenerationRunId: input.run.id,
    errorMessage: input.run.errorMessage ?? "Question generation failed.",
  } satisfies QuestionGenerationRunFailedPayload;

  return questionGenerationRunEventEnvelope({
    id: input.id,
    type: QUESTION_GENERATION_RUN_FAILED_EVENT,
    run: input.run,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    payload,
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
    type: QUESTION_GENERATION_RUN_CANCELLED_EVENT,
    run: input.run,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
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
    questionSetId: input.run.targetQuestionSetId,
    questionGenerationRunId: input.run.id,
    questionIds: [...input.questionIds],
  } satisfies QuestionSetQuestionsAddedPayload;

  return domainEventEnvelope({
    id: input.id,
    type: QUESTION_SET_QUESTIONS_ADDED_EVENT,
    schemaVersion: 1,
    aggregate: {
      type: "question_set",
      id: input.run.targetQuestionSetId,
    },
    ownerUserId: input.run.ownerUserId,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    payload,
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
    questionGenerationRunId: input.run.id,
    status: input.run.status,
    workbookCalculationId: input.run.source?.workbookCalculationId ?? null,
  } satisfies QuestionGenerationRunStateChangedPayload;

  return questionGenerationRunEventEnvelope({
    id: input.id,
    type: input.type,
    run: input.run,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    payload,
  });
}

function questionGenerationRunEventEnvelope<TPayload extends JsonObject>(input: {
  id: string;
  type: string;
  run: QuestionGenerationRun;
  lineage: OperationLineage;
  occurredAt: Date;
  payload: TPayload;
}): DomainEventEnvelope<TPayload> {
  return domainEventEnvelope({
    id: input.id,
    type: input.type,
    schemaVersion: 1,
    aggregate: {
      type: "question_generation_run",
      id: input.run.id,
    },
    ownerUserId: input.run.ownerUserId,
    lineage: input.lineage,
    occurredAt: input.occurredAt,
    payload: input.payload,
  });
}
