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
 * - question generation materialization uses the run id as the queue id because
 *   only one materialization job may ever commit a run.
 * - handlers must tolerate retries by checking domain state before side effects.
 */

export type QuestionGenerationMaterializeJobData = JsonObject & {
  questionGenerationRunId: string;
  workbookSnapshotIds: string[];
  lineage: OperationLineage;
};

export type QuestionGenerationOrchestrateJobData = JsonObject & {
  questionGenerationRunId: string;
  workbookCalculationId: string | null;
  workbookSnapshotIds: string[];
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
  workbookSnapshotIds?: readonly string[];
  workbookCalculationErrorMessage?: string | null;
  lineage: OperationLineage;
}): QuestionGenerationOrchestrateJobData {
  return {
    questionGenerationRunId: input.questionGenerationRunId,
    workbookCalculationId: input.workbookCalculationId ?? null,
    workbookSnapshotIds: [...(input.workbookSnapshotIds ?? [])],
    workbookCalculationErrorMessage:
      input.workbookCalculationErrorMessage ?? null,
    lineage: input.lineage,
  };
}

export function questionGenerationMaterializeJobData(input: {
  questionGenerationRunId: string;
  workbookSnapshotIds: readonly string[];
  lineage: OperationLineage;
}): QuestionGenerationMaterializeJobData {
  return {
    questionGenerationRunId: input.questionGenerationRunId,
    workbookSnapshotIds: [...input.workbookSnapshotIds],
    lineage: input.lineage,
  };
}

export function workbookValidateJobData(input: {
  workbookId: string;
  lineage: OperationLineage;
}): WorkbookValidateJobData {
  return {
    workbookId: input.workbookId,
    lineage: input.lineage,
  };
}

export function workbookCalculateJobData(input: {
  workbookCalculationId: string;
  lineage: OperationLineage;
}): WorkbookCalculateJobData {
  return {
    workbookCalculationId: input.workbookCalculationId,
    lineage: input.lineage,
  };
}
