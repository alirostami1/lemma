import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type FailedQueueJob,
  FailedQueueJobReconciler,
  type FailedQueueJobReconciliationRepository,
} from "./failed-queue-job-reconciler.js";

const at = new Date("2026-06-14T00:00:00.000Z");
const lineage = {
  causationId: null,
  correlationId: "019e9315-6a87-715f-9861-8654df070d10",
  requestId: "019e9315-6a87-715f-9861-8654df070d10",
};

describe("FailedQueueJobReconciler", () => {
  it("reconciles failed question generation jobs and completes the audit row", async () => {
    const repository = new InMemoryFailedQueueJobRepository([
      createFailedJob({
        data: {
          lineage,
          questionGenerationRunId: "019e9315-6a87-715f-9861-8654df070d02",
        },
      }),
    ]);
    const calls: string[] = [];
    const reconciler = new FailedQueueJobReconciler({
      clock: { now: () => at },
      config: createConfig(),
      questionGenerationWorkerService: {
        async reconcileFailedGenerationJob(input) {
          calls.push(input.questionGenerationRunId);
          return {
            questionGenerationRun: null,
            reason: "not_found",
            status: "skipped",
          };
        },
      },
      repository,
    });

    assert.equal(await reconciler.runOnce(), 1);
    assert.deepEqual(calls, ["019e9315-6a87-715f-9861-8654df070d02"]);
    assert.equal(repository.completed[0]?.result, "run_not_found");
    assert.equal(
      repository.completed[0]?.questionGenerationRunId,
      "019e9315-6a87-715f-9861-8654df070d02",
    );
  });

  it("completes invalid payload jobs without calling the question service", async () => {
    const repository = new InMemoryFailedQueueJobRepository([
      createFailedJob({ data: {} }),
    ]);
    let serviceCalls = 0;
    const reconciler = new FailedQueueJobReconciler({
      clock: { now: () => at },
      config: createConfig(),
      questionGenerationWorkerService: {
        async reconcileFailedGenerationJob() {
          serviceCalls += 1;
          return {
            questionGenerationRun: null,
            reason: "not_found",
            status: "skipped",
          };
        },
      },
      repository,
    });

    assert.equal(await reconciler.runOnce(), 1);
    assert.equal(serviceCalls, 0);
    assert.equal(repository.completed[0]?.result, "invalid_payload");
  });

  it("records reconciliation failures for stale retry", async () => {
    const repository = new InMemoryFailedQueueJobRepository([
      createFailedJob({
        data: {
          lineage,
          questionGenerationRunId: "019e9315-6a87-715f-9861-8654df070d02",
        },
      }),
    ]);
    const reconciler = new FailedQueueJobReconciler({
      clock: { now: () => at },
      config: createConfig(),
      questionGenerationWorkerService: {
        async reconcileFailedGenerationJob() {
          throw new Error("database unavailable");
        },
      },
      repository,
    });

    assert.equal(await reconciler.runOnce(), 1);
    assert.equal(repository.completed.length, 0);
    assert.deepEqual(repository.failures, [
      {
        errorMessage: "database unavailable",
        failedAt: at,
        jobId: "job-1",
      },
    ]);
  });
});

class InMemoryFailedQueueJobRepository
  implements FailedQueueJobReconciliationRepository
{
  readonly completed: {
    jobId: string;
    result: string;
    questionGenerationRunId: string | null;
    errorMessage: string | null;
    completedAt: Date;
  }[] = [];
  readonly failures: {
    jobId: string;
    errorMessage: string;
    failedAt: Date;
  }[] = [];

  constructor(private readonly jobs: FailedQueueJob[]) {}

  async claimFailedJobs(input: { name: string }): Promise<FailedQueueJob[]> {
    return this.jobs.filter((job) => job.name === input.name);
  }

  async completeReconciliation(input: {
    jobId: string;
    result: "invalid_payload" | "run_failed" | "run_not_found" | "run_terminal";
    questionGenerationRunId: string | null;
    errorMessage: string | null;
    completedAt: Date;
  }): Promise<void> {
    this.completed.push(input);
  }

  async recordReconciliationFailure(input: {
    jobId: string;
    errorMessage: string;
    failedAt: Date;
  }): Promise<void> {
    this.failures.push(input);
  }
}

function createConfig() {
  return {
    batchSize: 25,
    intervalMs: 10_000,
    lockTimeoutMs: 60_000,
    workerId: "worker-1",
  };
}

function createFailedJob(input: { data: unknown }): FailedQueueJob {
  return {
    completedOn: at,
    createdOn: at,
    data: input.data,
    id: "job-1",
    name: "question-generation.materialize",
    output: { message: "engine failed" },
    retryCount: 3,
    retryLimit: 3,
    startedOn: at,
  };
}
