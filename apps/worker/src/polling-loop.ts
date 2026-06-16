import { withSpan } from "@lemma/observability/node";
import {
  logWorkerError,
  logWorkerInfo,
  type WorkerLogger,
  type WorkerLogFields,
} from "./worker-logging.js";

export type PollingLoopAttributes = Record<string, string | number | boolean>;

export type PollingLoopResult = {
  attributes?: PollingLoopAttributes;
  log?: {
    message: string;
    fields?: WorkerLogFields;
  };
} | undefined;

export type PollingLoopScheduler = {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
};

export type PollingLoopConfig = {
  name: string;
  intervalMs: number;
  task(): Promise<PollingLoopResult>;
  logger?: WorkerLogger;
  scheduler?: PollingLoopScheduler;
};

const defaultScheduler: PollingLoopScheduler = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

export class PollingLoop {
  private active = false;
  private generation = 0;
  private timeout: unknown | undefined;

  constructor(private readonly config: PollingLoopConfig) {}

  start(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    this.generation += 1;
    this.schedule(0, this.generation);
  }

  stop(): void {
    this.active = false;
    this.generation += 1;
    if (this.timeout !== undefined) {
      this.scheduler.clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  }

  private schedule(delayMs: number, generation: number): void {
    const timeout = this.scheduler.setTimeout(() => {
      if (this.timeout === timeout) {
        this.timeout = undefined;
      }
      void this.tick(generation);
    }, delayMs);
    this.timeout = timeout;
  }

  private async tick(generation: number): Promise<void> {
    try {
      await withSpan(
        "worker.polling_loop.tick",
        { "worker.polling_loop.name": this.config.name },
        async (span) => {
          const result = await this.config.task();
          if (!result) {
            return;
          }
          if (result.attributes) {
            for (const [key, value] of Object.entries(result.attributes)) {
              span.setAttribute(key, value);
            }
          }
          if (result.log) {
            logWorkerInfo(
              result.log.message,
              {
                "worker.polling_loop.name": this.config.name,
                ...result.log.fields,
              },
              this.config.logger,
            );
          }
        },
      );
    } catch (error) {
      logWorkerError(
        "worker polling task failed",
        { "worker.polling_loop.name": this.config.name },
        error,
        this.config.logger,
      );
    } finally {
      if (this.active && generation === this.generation) {
        this.schedule(this.config.intervalMs, generation);
      }
    }
  }

  private get scheduler(): PollingLoopScheduler {
    return this.config.scheduler ?? defaultScheduler;
  }
}
