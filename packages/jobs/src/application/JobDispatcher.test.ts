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
    requestId: "019e9315-6a87-715f-9861-8654df070c01",
    correlationId: "019e9315-6a87-715f-9861-8654df070c01",
    causationId: null,
  };

  it("uses the event id as the deterministic question generation orchestration job id", async () => {
    const jobs: EnqueueJobInput[] = [];
    const dispatcher = new JobDispatcher({
      jobQueue: createJobQueue(jobs),
    });

    const jobId = await dispatcher.enqueueQuestionGenerationOrchestration({
      jobId: "019e9315-6a87-715f-9861-8654df070c70",
      questionGenerationRunId: "019e9315-6a87-715f-9861-8654df070c71",
      lineage,
      retryLimit: 3,
      retryDelaySeconds: 30,
    });

    assert.equal(jobId, "019e9315-6a87-715f-9861-8654df070c70");
    assert.deepEqual(jobs, [
      {
        id: "019e9315-6a87-715f-9861-8654df070c70",
        name: QUESTION_GENERATION_ORCHESTRATE_JOB,
        data: {
          questionGenerationRunId: "019e9315-6a87-715f-9861-8654df070c71",
          workbookCalculationId: null,
          workbookSnapshotIds: [],
          workbookCalculationErrorMessage: null,
          lineage,
        },
        retryLimit: 3,
        retryDelaySeconds: 30,
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
      workbookId: "019e9315-6a87-715f-9861-8654df070c73",
      lineage,
      retryLimit: 3,
      retryDelaySeconds: 30,
    });

    assert.equal(jobId, "019e9315-6a87-715f-9861-8654df070c72");
    assert.deepEqual(jobs, [
      {
        id: "019e9315-6a87-715f-9861-8654df070c72",
        name: WORKBOOK_VALIDATE_JOB,
        data: {
          workbookId: "019e9315-6a87-715f-9861-8654df070c73",
          lineage,
        },
        retryLimit: 3,
        retryDelaySeconds: 30,
      },
    ]);
  });

  it("uses the event id as the deterministic workbook calculation job id", async () => {
    const jobs: EnqueueJobInput[] = [];
    const dispatcher = new JobDispatcher({
      jobQueue: createJobQueue(jobs),
    });

    const jobId = await dispatcher.enqueueWorkbookCalculation({
      jobId: "019e9315-6a87-715f-9861-8654df070c74",
      workbookCalculationId: "019e9315-6a87-715f-9861-8654df070c75",
      sources: [
        {
          sourceId: "019e9315-6a87-715f-9861-8654df070c78",
          workbookId: "019e9315-6a87-715f-9861-8654df070c79",
        },
      ],
      lineage,
      retryLimit: 3,
      retryDelaySeconds: 30,
    });

    assert.equal(jobId, "019e9315-6a87-715f-9861-8654df070c74");
    assert.deepEqual(jobs, [
      {
        id: "019e9315-6a87-715f-9861-8654df070c74",
        name: WORKBOOK_CALCULATE_JOB,
        data: {
          workbookCalculationId: "019e9315-6a87-715f-9861-8654df070c75",
          sources: [
            {
              sourceId: "019e9315-6a87-715f-9861-8654df070c78",
              workbookId: "019e9315-6a87-715f-9861-8654df070c79",
            },
          ],
          lineage,
        },
        retryLimit: 3,
        retryDelaySeconds: 30,
      },
    ]);
  });

  it("uses the generation run id as the deterministic materialization job id", async () => {
    const jobs: EnqueueJobInput[] = [];
    const dispatcher = new JobDispatcher({
      jobQueue: createJobQueue(jobs),
    });

    const jobId = await dispatcher.enqueueQuestionGenerationMaterialization({
      questionGenerationRunId: "019e9315-6a87-715f-9861-8654df070c76",
      workbookSnapshotIds: ["019e9315-6a87-715f-9861-8654df070c77"],
      lineage,
      retryLimit: 3,
      retryDelaySeconds: 30,
    });

    assert.equal(jobId, "019e9315-6a87-715f-9861-8654df070c76");
    assert.deepEqual(jobs, [
      {
        id: "019e9315-6a87-715f-9861-8654df070c76",
        name: QUESTION_GENERATION_MATERIALIZE_JOB,
        data: {
          questionGenerationRunId: "019e9315-6a87-715f-9861-8654df070c76",
          workbookSnapshotIds: ["019e9315-6a87-715f-9861-8654df070c77"],
          lineage,
        },
        retryLimit: 3,
        retryDelaySeconds: 30,
      },
    ]);
  });
});

function createJobQueue(jobs: EnqueueJobInput[]): JobQueuePort {
  return {
    async start() {},
    async stop() {},
    async enqueueJob(input) {
      jobs.push(input);
      return input.id;
    },
    async registerHandler() {
      return { async unregister() {} };
    },
  };
}
