import type { OperationLineage } from "@lemma/domain";
import { instrumentService } from "@lemma/observability";
import {
  QUESTION_GENERATION_MATERIALIZE_JOB,
  QUESTION_GENERATION_ORCHESTRATE_JOB,
  questionGenerationMaterializeJobData,
  questionGenerationOrchestrateJobData,
  WORKBOOK_CALCULATE_JOB,
  WORKBOOK_VALIDATE_JOB,
  workbookCalculateJobData,
  workbookValidateJobData,
} from "./job-contracts.js";
import type { JobQueuePort } from "./ports.js";

const instrumentation = instrumentService("jobs", "dispatcher");

export class JobDispatcher {
  constructor(private readonly deps: { jobQueue: JobQueuePort }) {}

  async enqueueQuestionGenerationOrchestration(input: {
    jobId: string;
    questionGenerationRunId: string;
    workbookCalculationId?: string | null;
    eventWorkbookSnapshotIds?: readonly string[];
    workbookCalculationErrorMessage?: string | null;
    lineage: OperationLineage;
    retryLimit?: number;
    retryDelaySeconds?: number;
  }): Promise<string> {
    return this.operation(
      "enqueue_question_generation_orchestration",
      input.lineage,
      () =>
        this.deps.jobQueue.enqueueJob({
          data: questionGenerationOrchestrateJobData({
            eventWorkbookSnapshotIds: input.eventWorkbookSnapshotIds,
            lineage: input.lineage,
            questionGenerationRunId: input.questionGenerationRunId,
            workbookCalculationErrorMessage:
              input.workbookCalculationErrorMessage,
            workbookCalculationId: input.workbookCalculationId,
          }),
          id: input.jobId,
          name: QUESTION_GENERATION_ORCHESTRATE_JOB,
          retryDelaySeconds: input.retryDelaySeconds,
          retryLimit: input.retryLimit,
        }),
    );
  }

  async enqueueQuestionGenerationMaterialization(input: {
    questionGenerationRunId: string;
    eventWorkbookSnapshotIds: readonly string[];
    lineage: OperationLineage;
    retryLimit?: number;
    retryDelaySeconds?: number;
  }): Promise<string> {
    return this.operation(
      "enqueue_question_generation_materialization",
      input.lineage,
      () =>
        this.deps.jobQueue.enqueueJob({
          data: questionGenerationMaterializeJobData({
            eventWorkbookSnapshotIds: input.eventWorkbookSnapshotIds,
            lineage: input.lineage,
            questionGenerationRunId: input.questionGenerationRunId,
          }),
          id: input.questionGenerationRunId,
          name: QUESTION_GENERATION_MATERIALIZE_JOB,
          retryDelaySeconds: input.retryDelaySeconds,
          retryLimit: input.retryLimit,
        }),
    );
  }

  async enqueueWorkbookValidation(input: {
    jobId: string;
    workbookId: string;
    lineage: OperationLineage;
    retryLimit?: number;
    retryDelaySeconds?: number;
  }): Promise<string> {
    return this.operation("enqueue_workbook_validation", input.lineage, () =>
      this.deps.jobQueue.enqueueJob({
        data: workbookValidateJobData({
          lineage: input.lineage,
          workbookId: input.workbookId,
        }),
        id: input.jobId,
        name: WORKBOOK_VALIDATE_JOB,
        retryDelaySeconds: input.retryDelaySeconds,
        retryLimit: input.retryLimit,
      }),
    );
  }

  async enqueueWorkbookCalculation(input: {
    workbookCalculationId: string;
    lineage: OperationLineage;
    retryLimit?: number;
    retryDelaySeconds?: number;
  }): Promise<string> {
    return this.operation("enqueue_workbook_calculation", input.lineage, () =>
      this.deps.jobQueue.enqueueJob({
        data: workbookCalculateJobData({
          lineage: input.lineage,
          workbookCalculationId: input.workbookCalculationId,
        }),
        id: input.workbookCalculationId,
        name: WORKBOOK_CALCULATE_JOB,
        retryDelaySeconds: input.retryDelaySeconds,
        retryLimit: input.retryLimit,
      }),
    );
  }

  private async operation<T>(
    operation: string,
    lineage: OperationLineage,
    fn: () => Promise<T>,
  ): Promise<T> {
    return instrumentation.run(operation, { lineage }, fn);
  }
}
