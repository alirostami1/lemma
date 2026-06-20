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
  it("rejects workbook calculation jobs missing workbookSources", async () => {
    const service = new FakeWorkbookCalculationService();
    const queue = new FakeJobQueue();
    await registerWorkbookCalculationWorker({
      jobQueue: queue,
      workbookCalculationService:
        service as unknown as WorkbookCalculationService,
      concurrency: 1,
    });

    await assert.rejects(
      () =>
        queue.runCalculationJobs([
          {
            id: "019e9315-6a87-715f-9861-8654df080001",
            name: WORKBOOK_CALCULATE_JOB,
            data: {
              workbookCalculationId: "019e9315-6a87-715f-9861-8654df080002",
            },
          },
        ]),
      (error: unknown) =>
        error instanceof Error &&
        error.message === "Workbook calculate job payload is invalid.",
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
