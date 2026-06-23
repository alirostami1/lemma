import type { JsonObject, OperationLineage } from "@lemma/domain";

export const QUESTION_GENERATION_ORCHESTRATE_JOB =
  "question-generation.orchestrate";
export const QUESTION_GENERATION_MATERIALIZE_JOB =
  "question-generation.materialize";
export const WORKBOOK_VALIDATE_JOB = "workbook.validate";
export const WORKBOOK_CALCULATE_JOB = "workbook.calculate";

/**
 * Job idempotency:
 * - outbox-dispatched jobs use the outbox event id as the queue id.
 * - workbook calculation jobs use the calculation id as the queue id.
 * - question generation materialization derives the queue id from the run id
 *   because only one materialization job may ever commit a run.
 * - handlers must tolerate retries by checking domain state before side effects.
 */

export type QuestionGenerationMaterializeJobData = JsonObject & {
  questionGenerationRunId: string;
  eventWorkbookSnapshotIds: string[];
  lineage: OperationLineage;
};

export type QuestionGenerationOrchestrateJobData = JsonObject & {
  questionGenerationRunId: string;
  workbookCalculationId: string | null;
  eventWorkbookSnapshotIds: string[];
  workbookCalculationErrorMessage: string | null;
  lineage: OperationLineage;
};

export type WorkbookValidateJobData = JsonObject & {
  workbookId: string;
  lineage: OperationLineage;
};

export type WorkbookCalculateJobData = JsonObject & {
  workbookCalculationId: string;
  lineage: OperationLineage;
};

export function questionGenerationOrchestrateJobData(input: {
  questionGenerationRunId: string;
  workbookCalculationId?: string | null;
  eventWorkbookSnapshotIds?: readonly string[];
  workbookCalculationErrorMessage?: string | null;
  lineage: OperationLineage;
}): QuestionGenerationOrchestrateJobData {
  return {
    eventWorkbookSnapshotIds: [...(input.eventWorkbookSnapshotIds ?? [])],
    lineage: input.lineage,
    questionGenerationRunId: input.questionGenerationRunId,
    workbookCalculationErrorMessage:
      input.workbookCalculationErrorMessage ?? null,
    workbookCalculationId: input.workbookCalculationId ?? null,
  };
}

export function questionGenerationMaterializeJobData(input: {
  questionGenerationRunId: string;
  eventWorkbookSnapshotIds: readonly string[];
  lineage: OperationLineage;
}): QuestionGenerationMaterializeJobData {
  return {
    eventWorkbookSnapshotIds: [...input.eventWorkbookSnapshotIds],
    lineage: input.lineage,
    questionGenerationRunId: input.questionGenerationRunId,
  };
}

export function workbookValidateJobData(input: {
  workbookId: string;
  lineage: OperationLineage;
}): WorkbookValidateJobData {
  return {
    lineage: input.lineage,
    workbookId: input.workbookId,
  };
}

export function workbookCalculateJobData(input: {
  workbookCalculationId: string;
  lineage: OperationLineage;
}): WorkbookCalculateJobData {
  return {
    lineage: input.lineage,
    workbookCalculationId: input.workbookCalculationId,
  };
}
