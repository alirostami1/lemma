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
    concurrency: input.concurrency,
    consumer: workflowJobConsumer({
      attributes: (job) => ({
        "question_generation.run_id": job.data.questionGenerationRunId,
      }),
      batchSize: 1,
      jobName: QUESTION_GENERATION_ORCHESTRATE_JOB,
      lineage: (data) => data.lineage,
      parsePayload: parseQuestionGenerationOrchestrateJob,
      run: async (job) => {
        const result =
          await input.questionGenerationWorkerService.orchestrateQuestionGenerationRun(
            {
              eventWorkbookSnapshotIds: job.data.eventWorkbookSnapshotIds,
              lineage: job.data.lineage,
              questionGenerationRunId: job.data.questionGenerationRunId,
              workbookCalculationErrorMessage:
                job.data.workbookCalculationErrorMessage,
              workbookCalculationId: job.data.workbookCalculationId,
            },
          );
        if (result.status !== "materialization_ready") {
          return;
        }
        await input.jobDispatcher.enqueueQuestionGenerationMaterialization({
          eventWorkbookSnapshotIds: result.eventWorkbookSnapshotIds,
          lineage: childOperationLineage(result.lineage, job.id),
          questionGenerationRunId: result.questionGenerationRun.id,
          retryDelaySeconds: input.retryDelaySeconds,
          retryLimit: input.retryLimit,
        });
      },
      stepName: "orchestrate",
      workflowName: "question_generation",
    }),
    jobQueue: input.jobQueue,
  });
  const materializer = await registerJobConsumer({
    concurrency: input.concurrency,
    consumer: workflowJobConsumer({
      attributes: (job) => ({
        "question_generation.run_id": job.data.questionGenerationRunId,
      }),
      batchSize: 1,
      jobName: QUESTION_GENERATION_MATERIALIZE_JOB,
      lineage: (data) => data.lineage,
      parsePayload: parseQuestionGenerationMaterializeJob,
      run: (job) =>
        input.questionGenerationWorkerService.materializeQuestionGenerationRun({
          eventWorkbookSnapshotIds: job.data.eventWorkbookSnapshotIds,
          lineage: job.data.lineage,
          questionGenerationRunId: job.data.questionGenerationRunId,
        }),
      stepName: "materialize",
      workflowName: "question_generation",
    }),
    jobQueue: input.jobQueue,
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
    !Array.isArray(data.eventWorkbookSnapshotIds) ||
    !data.eventWorkbookSnapshotIds.every((id) => typeof id === "string") ||
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
    !Array.isArray(data.eventWorkbookSnapshotIds) ||
    !data.eventWorkbookSnapshotIds.every((id) => typeof id === "string")
  ) {
    throw new Error("Question generation materialize job payload is invalid.");
  }
  return { ...data, lineage: parseOperationLineage(data.lineage) };
}
