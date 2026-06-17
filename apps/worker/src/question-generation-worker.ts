import { childOperationLineage, parseOperationLineage } from "@lemma/domain";
import {
  type JobDispatcher,
  type JobQueuePort,
  QUESTION_GENERATION_MATERIALIZE_JOB,
  QUESTION_GENERATION_ORCHESTRATE_JOB,
  type QuestionGenerationMaterializeJobData,
  type QuestionGenerationOrchestrateJobData,
  type QueueWorkerRegistration,
} from "@lemma/jobs/application";
import type { QuestionGenerationWorkerService } from "@lemma/questions/application";
import { registerJobConsumer, workflowJobConsumer } from "./pipeline.js";

export async function registerQuestionGenerationWorker(input: {
  jobQueue: JobQueuePort;
  jobDispatcher: JobDispatcher;
  questionGenerationWorkerService: QuestionGenerationWorkerService;
  concurrency: number;
  retryLimit: number;
  retryDelaySeconds: number;
}): Promise<QueueWorkerRegistration> {
  const orchestrator = await registerJobConsumer({
    jobQueue: input.jobQueue,
    concurrency: input.concurrency,
    consumer: workflowJobConsumer({
      workflowName: "question_generation",
      stepName: "orchestrate",
      jobName: QUESTION_GENERATION_ORCHESTRATE_JOB,
      batchSize: 1,
      parsePayload: parseQuestionGenerationOrchestrateJob,
      lineage: (data) => data.lineage,
      attributes: (job) => ({
        "question_generation.run_id": job.data.questionGenerationRunId,
      }),
      run: async (job) => {
        const result =
          await input.questionGenerationWorkerService.orchestrateQuestionGenerationRun(
            {
              questionGenerationRunId: job.data.questionGenerationRunId,
              workbookCalculationId: job.data.workbookCalculationId,
              workbookSnapshotIds: job.data.workbookSnapshotIds,
              workbookCalculationErrorMessage:
                job.data.workbookCalculationErrorMessage,
              lineage: job.data.lineage,
            },
          );
        if (result.status !== "materialization_ready") {
          return;
        }
        await input.jobDispatcher.enqueueQuestionGenerationMaterialization({
          questionGenerationRunId: result.questionGenerationRun.id,
          workbookSnapshotIds: result.workbookSnapshotIds,
          lineage: childOperationLineage(result.lineage, job.id),
          retryLimit: input.retryLimit,
          retryDelaySeconds: input.retryDelaySeconds,
        });
      },
    }),
  });
  const materializer = await registerJobConsumer({
    jobQueue: input.jobQueue,
    concurrency: input.concurrency,
    consumer: workflowJobConsumer({
      workflowName: "question_generation",
      stepName: "materialize",
      jobName: QUESTION_GENERATION_MATERIALIZE_JOB,
      batchSize: 1,
      parsePayload: parseQuestionGenerationMaterializeJob,
      lineage: (data) => data.lineage,
      attributes: (job) => ({
        "question_generation.run_id": job.data.questionGenerationRunId,
      }),
      run: (job) =>
        input.questionGenerationWorkerService.materializeQuestionGenerationRun({
          questionGenerationRunId: job.data.questionGenerationRunId,
          workbookSnapshotIds: job.data.workbookSnapshotIds,
          lineage: job.data.lineage,
        }),
    }),
  });
  return {
    async unregister() {
      await materializer.unregister();
      await orchestrator.unregister();
    },
  };
}

function parseQuestionGenerationOrchestrateJob(
  data: QuestionGenerationOrchestrateJobData,
): QuestionGenerationOrchestrateJobData {
  if (
    typeof data.questionGenerationRunId !== "string" ||
    data.questionGenerationRunId.length === 0 ||
    !Array.isArray(data.workbookSnapshotIds) ||
    !data.workbookSnapshotIds.every((id) => typeof id === "string") ||
    (data.workbookCalculationId !== null &&
      typeof data.workbookCalculationId !== "string") ||
    (data.workbookCalculationErrorMessage !== null &&
      typeof data.workbookCalculationErrorMessage !== "string")
  ) {
    throw new Error("Question generation orchestrate job payload is invalid.");
  }
  return { ...data, lineage: parseOperationLineage(data.lineage) };
}

function parseQuestionGenerationMaterializeJob(
  data: QuestionGenerationMaterializeJobData,
): QuestionGenerationMaterializeJobData {
  if (
    typeof data.questionGenerationRunId !== "string" ||
    data.questionGenerationRunId.length === 0 ||
    !Array.isArray(data.workbookSnapshotIds) ||
    !data.workbookSnapshotIds.every((id) => typeof id === "string")
  ) {
    throw new Error("Question generation materialize job payload is invalid.");
  }
  return { ...data, lineage: parseOperationLineage(data.lineage) };
}
