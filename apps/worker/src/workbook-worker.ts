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
    jobQueue: input.jobQueue,
    concurrency: input.concurrency,
    consumer: workflowJobConsumer({
      workflowName: "workbook",
      stepName: "validate",
      jobName: WORKBOOK_VALIDATE_JOB,
      batchSize: 1,
      parsePayload: parseWorkbookValidateJob,
      lineage: (data) => data.lineage,
      attributes: (job) => ({ "workbook.id": job.data.workbookId }),
      run: (job) =>
        input.workbookService.processWorkbookValidation({
          workbookId: job.data.workbookId,
          lineage: job.data.lineage,
        }),
    }),
  });
}

export async function registerWorkbookCalculationWorker(input: {
  jobQueue: JobQueuePort;
  workbookCalculationService: WorkbookCalculationService;
  concurrency: number;
}): Promise<QueueWorkerRegistration> {
  return registerJobConsumer({
    jobQueue: input.jobQueue,
    concurrency: input.concurrency,
    consumer: workflowJobConsumer({
      workflowName: "workbook",
      stepName: "calculate",
      jobName: WORKBOOK_CALCULATE_JOB,
      batchSize: 1,
      parsePayload: parseWorkbookCalculateJob,
      lineage: (data) => data.lineage,
      attributes: (job) => ({
        "workbook.calculation_id": job.data.workbookCalculationId,
      }),
      run: (job) =>
        input.workbookCalculationService.processWorkbookCalculation({
          workbookCalculationId: job.data.workbookCalculationId,
          lineage: job.data.lineage,
        }),
    }),
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
  return { ...data, lineage: parseOperationLineage(data.lineage) };
}
