import { parseOperationLineage } from "@lemma/domain";
import {
  type JobQueuePort,
  type QueueWorkerRegistration,
  WORKBOOK_CALCULATE_JOB,
  WORKBOOK_VALIDATE_JOB,
  type WorkbookCalculateJobData,
  type WorkbookValidateJobData,
} from "@lemma/jobs/application";
import type {
  WorkbookCalculationService,
  WorkbookService,
} from "@lemma/workbook/application";
import { registerJobConsumer, workflowJobConsumer } from "./pipeline.js";

export async function registerWorkbookValidationWorker(input: {
  jobQueue: JobQueuePort;
  workbookService: WorkbookService;
  concurrency: number;
}): Promise<QueueWorkerRegistration> {
  return registerJobConsumer({
    concurrency: input.concurrency,
    consumer: workflowJobConsumer({
      attributes: (job) => ({ "workbook.id": job.data.workbookId }),
      batchSize: 1,
      jobName: WORKBOOK_VALIDATE_JOB,
      lineage: (data) => data.lineage,
      parsePayload: parseWorkbookValidateJob,
      run: (job) =>
        input.workbookService.processWorkbookValidation({
          lineage: job.data.lineage,
          workbookId: job.data.workbookId,
        }),
      stepName: "validate",
      workflowName: "workbook",
    }),
    jobQueue: input.jobQueue,
  });
}

export async function registerWorkbookCalculationWorker(input: {
  jobQueue: JobQueuePort;
  workbookCalculationService: WorkbookCalculationService;
  concurrency: number;
}): Promise<QueueWorkerRegistration> {
  return registerJobConsumer({
    concurrency: input.concurrency,
    consumer: workflowJobConsumer({
      attributes: (job) => ({
        "workbook.calculation_id": job.data.workbookCalculationId,
      }),
      batchSize: 1,
      jobName: WORKBOOK_CALCULATE_JOB,
      lineage: (data) => data.lineage,
      parsePayload: parseWorkbookCalculateJob,
      run: (job) =>
        input.workbookCalculationService.processWorkbookCalculation({
          lineage: job.data.lineage,
          workbookCalculationId: job.data.workbookCalculationId,
        }),
      stepName: "calculate",
      workflowName: "workbook",
    }),
    jobQueue: input.jobQueue,
  });
}

function parseWorkbookValidateJob(
  data: WorkbookValidateJobData,
): WorkbookValidateJobData {
  if (typeof data.workbookId !== "string" || data.workbookId.length === 0) {
    throw new Error("Workbook validate job payload is invalid.");
  }
  return { ...data, lineage: parseOperationLineage(data.lineage) };
}

function parseWorkbookCalculateJob(
  data: WorkbookCalculateJobData,
): WorkbookCalculateJobData {
  if (
    typeof data.workbookCalculationId !== "string" ||
    data.workbookCalculationId.length === 0
  ) {
    throw new Error("Workbook calculate job payload is invalid.");
  }
  if (!("sources" in (data as Record<string, unknown>))) {
    throw new Error("sources must be an array.");
  }
  if (!Array.isArray((data as Record<string, unknown>).sources)) {
    throw new Error("sources must be an array.");
  }
  return {
    lineage: parseOperationLineage(data.lineage),
    workbookCalculationId: data.workbookCalculationId,
  };
}
