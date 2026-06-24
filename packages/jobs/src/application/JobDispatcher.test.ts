import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JobDispatcher } from "./JobDispatcher.js";
import {
  QUESTION_GENERATION_MATERIALIZE_JOB,
  QUESTION_GENERATION_ORCHESTRATE_JOB,
  WORKBOOK_CALCULATE_JOB,
  WORKBOOK_VALIDATE_JOB,
} from "./job-contracts.js";
import type { EnqueueJobInput, JobQueuePort } from "./ports.js";

describe("JobDispatcher", () => {
  const lineage = {
    causationId: null,
    correlationId: "019e9315-6a87-715f-9861-8654df070c01",
    requestId: "019e9315-6a87-715f-9861-8654df070c01",
  };

  it("uses the event id as the deterministic question generation orchestration job id", async () => {
    const jobs: EnqueueJobInput[] = [];
    const dispatcher = new JobDispatcher({
      jobQueue: createJobQueue(jobs),
    });

    const jobId = await dispatcher.enqueueQuestionGenerationOrchestration({
      jobId: "019e9315-6a87-715f-9861-8654df070c70",
      lineage,
      questionGenerationRunId: "019e9315-6a87-715f-9861-8654df070c71",
      retryDelaySeconds: 30,
      retryLimit: 3,
    });

    assert.equal(jobId, "019e9315-6a87-715f-9861-8654df070c70");
    assert.deepEqual(jobs, [
      {
        data: {
          eventWorkbookSnapshotIds: [],
          lineage,
          questionGenerationRunId: "019e9315-6a87-715f-9861-8654df070c71",
          workbookCalculationErrorMessage: null,
          workbookCalculationId: null,
        },
        id: "019e9315-6a87-715f-9861-8654df070c70",
        name: QUESTION_GENERATION_ORCHESTRATE_JOB,
        retryDelaySeconds: 30,
        retryLimit: 3,
      },
    ]);
  });

  it("uses the event id as the deterministic workbook validation job id", async () => {
    const jobs: EnqueueJobInput[] = [];
    const dispatcher = new JobDispatcher({
      jobQueue: createJobQueue(jobs),
    });

    const jobId = await dispatcher.enqueueWorkbookValidation({
      jobId: "019e9315-6a87-715f-9861-8654df070c72",
      lineage,
      retryDelaySeconds: 30,
      retryLimit: 3,
      workbookId: "019e9315-6a87-715f-9861-8654df070c73",
    });

    assert.equal(jobId, "019e9315-6a87-715f-9861-8654df070c72");
    assert.deepEqual(jobs, [
      {
        data: {
          lineage,
          workbookId: "019e9315-6a87-715f-9861-8654df070c73",
        },
        id: "019e9315-6a87-715f-9861-8654df070c72",
        name: WORKBOOK_VALIDATE_JOB,
        retryDelaySeconds: 30,
        retryLimit: 3,
      },
    ]);
  });

  it("uses the calculation id as the deterministic workbook calculation job id", async () => {
    const jobs: EnqueueJobInput[] = [];
    const dispatcher = new JobDispatcher({
      jobQueue: createJobQueue(jobs),
    });

    const jobId = await dispatcher.enqueueWorkbookCalculation({
      lineage,
      retryDelaySeconds: 30,
      retryLimit: 3,
      workbookCalculationId: "019e9315-6a87-715f-9861-8654df070c75",
    });

    assert.equal(jobId, "019e9315-6a87-715f-9861-8654df070c75");
    assert.deepEqual(jobs, [
      {
        data: {
          lineage,
          workbookCalculationId: "019e9315-6a87-715f-9861-8654df070c75",
        },
        id: "019e9315-6a87-715f-9861-8654df070c75",
        name: WORKBOOK_CALCULATE_JOB,
        retryDelaySeconds: 30,
        retryLimit: 3,
      },
    ]);
  });

  it("uses the generation run id as the deterministic materialization job id", async () => {
    const jobs: EnqueueJobInput[] = [];
    const dispatcher = new JobDispatcher({
      jobQueue: createJobQueue(jobs),
    });

    const jobId = await dispatcher.enqueueQuestionGenerationMaterialization({
      eventWorkbookSnapshotIds: ["019e9315-6a87-715f-9861-8654df070c77"],
      lineage,
      questionGenerationRunId: "019e9315-6a87-715f-9861-8654df070c76",
      retryDelaySeconds: 30,
      retryLimit: 3,
    });

    assert.equal(jobId, "019e9315-6a87-715f-9861-8654df070c76");
    assert.deepEqual(jobs, [
      {
        data: {
          eventWorkbookSnapshotIds: ["019e9315-6a87-715f-9861-8654df070c77"],
          lineage,
          questionGenerationRunId: "019e9315-6a87-715f-9861-8654df070c76",
        },
        id: "019e9315-6a87-715f-9861-8654df070c76",
        name: QUESTION_GENERATION_MATERIALIZE_JOB,
        retryDelaySeconds: 30,
        retryLimit: 3,
      },
    ]);
  });
});

function createJobQueue(jobs: EnqueueJobInput[]): JobQueuePort {
  return {
    async enqueueJob(input) {
      jobs.push(input);
      return input.id;
    },
    async registerHandler() {
      return { async unregister() {} };
    },
    async start() {},
    async stop() {},
  };
}
