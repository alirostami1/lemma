import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { JsonObject } from "@lemma/domain";
import {
  type JobQueuePort,
  type QueueJob,
  WORKBOOK_CALCULATE_JOB,
} from "@lemma/jobs/application";
import type { WorkbookCalculationService } from "@lemma/workbook/application";
import { registerWorkbookCalculationWorker } from "./workbook-worker.js";

describe("registerWorkbookCalculationWorker", () => {
  it("rejects workbook calculation jobs missing sources", async () => {
    const service = new FakeWorkbookCalculationService();
    const queue = new FakeJobQueue();
    await registerWorkbookCalculationWorker({
      concurrency: 1,
      jobQueue: queue,
      workbookCalculationService:
        service as unknown as WorkbookCalculationService,
    });

    await assert.rejects(
      () =>
        queue.runCalculationJobs([
          {
            data: {
              workbookCalculationId: "019e9315-6a87-715f-9861-8654df080002",
            },
            id: "019e9315-6a87-715f-9861-8654df080001",
            name: WORKBOOK_CALCULATE_JOB,
          },
        ]),
      (error: unknown) =>
        error instanceof Error && error.message === "sources must be an array.",
    );
    assert.equal(service.calls, 0);
  });
});

class FakeWorkbookCalculationService {
  calls = 0;

  async processWorkbookCalculation() {
    this.calls += 1;
  }
}

class FakeJobQueue implements JobQueuePort {
  private runCalculationJobsHandler:
    | ((jobs: readonly QueueJob[]) => Promise<void>)
    | null = null;

  async start() {}

  async stop() {}

  async enqueueJob<TData extends JsonObject>(_: {
    id: string;
    name: string;
    data: TData;
    retryLimit?: number;
    retryDelaySeconds?: number;
  }) {
    return "not-implemented";
  }

  async registerHandler<TData extends JsonObject>(input: {
    name: string;
    handler(jobs: readonly QueueJob<TData>[]): Promise<void>;
  }) {
    if (input.name === WORKBOOK_CALCULATE_JOB) {
      this.runCalculationJobsHandler = input.handler as (
        jobs: readonly QueueJob[],
      ) => Promise<void>;
    }
    return {
      async unregister() {},
    };
  }

  async runCalculationJobs(jobs: readonly QueueJob[]) {
    if (!this.runCalculationJobsHandler) {
      throw new Error("Calculation handler not registered.");
    }
    await this.runCalculationJobsHandler(jobs);
  }
}
