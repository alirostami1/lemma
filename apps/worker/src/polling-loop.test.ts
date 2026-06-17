import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PollingLoop, type PollingLoopScheduler } from "./polling-loop.js";
import type { WorkerLogFields, WorkerLogger } from "./worker-logging.js";

describe("PollingLoop", () => {
  it("schedules immediately, runs task, logs summary, and reschedules", async () => {
    const scheduler = new FakeScheduler();
    const logger = new MemoryLogger();
    let runs = 0;
    const loop = new PollingLoop({
      name: "test-loop",
      intervalMs: 25,
      scheduler,
      logger,
      task: async () => {
        runs += 1;
        return {
          attributes: { "task.count": runs },
          log: {
            message: "task completed",
            fields: { "task.count": runs },
          },
        };
      },
    });

    loop.start();
    assert.deepEqual(scheduler.delays, [0]);

    await scheduler.runNext();

    assert.equal(runs, 1);
    assert.deepEqual(scheduler.delays, [0, 25]);
    assert.deepEqual(logger.infoLogs, [
      {
        message: "task completed",
        fields: {
          "worker.polling_loop.name": "test-loop",
          "task.count": 1,
        },
      },
    ]);
  });

  it("logs task errors and keeps polling while active", async () => {
    const scheduler = new FakeScheduler();
    const logger = new MemoryLogger();
    const loop = new PollingLoop({
      name: "failing-loop",
      intervalMs: 50,
      scheduler,
      logger,
      task: async () => {
        throw new Error("boom");
      },
    });

    loop.start();
    await scheduler.runNext();

    assert.deepEqual(scheduler.delays, [0, 50]);
    assert.equal(logger.errorLogs[0]?.message, "worker polling task failed");
    assert.equal(
      logger.errorLogs[0]?.fields["worker.polling_loop.name"],
      "failing-loop",
    );
    assert.equal(logger.errorLogs[0]?.fields["error.message"], "boom");
  });

  it("does not reschedule after stop", async () => {
    const scheduler = new FakeScheduler();
    const loop = new PollingLoop({
      name: "stopping-loop",
      intervalMs: 50,
      scheduler,
      task: async () => undefined,
    });

    loop.start();
    loop.stop();

    assert.equal(scheduler.cleared.length, 1);
    assert.equal(await scheduler.runNext(), false);
    assert.deepEqual(scheduler.delays, [0]);
  });
});

class FakeScheduler implements PollingLoopScheduler {
  private nextId = 1;
  private readonly callbacks = new Map<number, () => void>();
  readonly delays: number[] = [];
  readonly cleared: unknown[] = [];

  setTimeout(callback: () => void, delayMs: number): unknown {
    const id = this.nextId;
    this.nextId += 1;
    this.delays.push(delayMs);
    this.callbacks.set(id, callback);
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.cleared.push(handle);
    this.callbacks.delete(handle as number);
  }

  async runNext(): Promise<boolean> {
    const next = this.callbacks.entries().next();
    if (next.done) {
      return false;
    }
    const [id, callback] = next.value;
    this.callbacks.delete(id);
    callback();
    await new Promise<void>((resolve) => setImmediate(resolve));
    return true;
  }
}

class MemoryLogger implements WorkerLogger {
  readonly infoLogs: { message: string; fields: WorkerLogFields }[] = [];
  readonly errorLogs: { message: string; fields: WorkerLogFields }[] = [];

  info(message: string, fields?: WorkerLogFields): void {
    this.infoLogs.push({ message, fields: fields ?? {} });
  }

  error(message: string, fields?: WorkerLogFields): void {
    this.errorLogs.push({ message, fields: fields ?? {} });
  }
}
