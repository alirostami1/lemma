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
    workbookSnapshotIds?: readonly string[];
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
          id: input.jobId,
          name: QUESTION_GENERATION_ORCHESTRATE_JOB,
          data: questionGenerationOrchestrateJobData({
            questionGenerationRunId: input.questionGenerationRunId,
            workbookCalculationId: input.workbookCalculationId,
            workbookSnapshotIds: input.workbookSnapshotIds,
            workbookCalculationErrorMessage:
              input.workbookCalculationErrorMessage,
            lineage: input.lineage,
          }),
          retryLimit: input.retryLimit,
          retryDelaySeconds: input.retryDelaySeconds,
        }),
    );
  }

  async enqueueQuestionGenerationMaterialization(input: {
    questionGenerationRunId: string;
    workbookSnapshotIds: readonly string[];
    lineage: OperationLineage;
    retryLimit?: number;
    retryDelaySeconds?: number;
  }): Promise<string> {
    return this.operation(
      "enqueue_question_generation_materialization",
      input.lineage,
      () =>
        this.deps.jobQueue.enqueueJob({
          id: input.questionGenerationRunId,
          name: QUESTION_GENERATION_MATERIALIZE_JOB,
          data: questionGenerationMaterializeJobData({
            questionGenerationRunId: input.questionGenerationRunId,
            workbookSnapshotIds: input.workbookSnapshotIds,
            lineage: input.lineage,
          }),
          retryLimit: input.retryLimit,
          retryDelaySeconds: input.retryDelaySeconds,
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
        id: input.jobId,
        name: WORKBOOK_VALIDATE_JOB,
        data: workbookValidateJobData({
          workbookId: input.workbookId,
          lineage: input.lineage,
        }),
        retryLimit: input.retryLimit,
        retryDelaySeconds: input.retryDelaySeconds,
      }),
    );
  }

  async enqueueWorkbookCalculation(input: {
    jobId: string;
    workbookCalculationId: string;
    lineage: OperationLineage;
    retryLimit?: number;
    retryDelaySeconds?: number;
  }): Promise<string> {
    return this.operation("enqueue_workbook_calculation", input.lineage, () =>
      this.deps.jobQueue.enqueueJob({
        id: input.jobId,
        name: WORKBOOK_CALCULATE_JOB,
        data: workbookCalculateJobData({
          workbookCalculationId: input.workbookCalculationId,
          lineage: input.lineage,
        }),
        retryLimit: input.retryLimit,
        retryDelaySeconds: input.retryDelaySeconds,
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
