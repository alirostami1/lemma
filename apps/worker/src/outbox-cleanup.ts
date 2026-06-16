import type { OutboxService } from "@lemma/events/application";
import { withSpan } from "@lemma/observability/node";
import { PollingLoop } from "./polling-loop.js";

export type OutboxCleanupSchedulerConfig = {
  intervalMs: number;
  batchSize: number;
  publishedRetentionMs: number;
};

export class OutboxCleanupScheduler {
  private readonly pollingLoop: PollingLoop;

  constructor(
    private readonly deps: {
      outboxService: OutboxService;
      config: OutboxCleanupSchedulerConfig;
    },
  ) {
    this.pollingLoop = new PollingLoop({
      name: "outbox-cleanup",
      intervalMs: deps.config.intervalMs,
      task: () => this.runPollingTask(),
    });
  }

  start(): void {
    this.pollingLoop.start();
  }

  stop(): void {
    this.pollingLoop.stop();
  }

  async runOnce(): Promise<number> {
    return withSpan(
      "outbox.cleanup_published_events",
      {
        "outbox.cleanup.batch_size": this.deps.config.batchSize,
        "outbox.cleanup.published_retention_ms":
          this.deps.config.publishedRetentionMs,
      },
      async (span) => {
        const deletedCount =
          await this.deps.outboxService.cleanupPublishedEvents({
            olderThanMs: this.deps.config.publishedRetentionMs,
            limit: this.deps.config.batchSize,
          });
        span.setAttribute("outbox.cleanup.deleted_count", deletedCount);
        return deletedCount;
      },
    );
  }

  private async runPollingTask() {
    const deletedCount = await this.runOnce();
    const result = {
      attributes: {
        "outbox.cleanup.deleted_count": deletedCount,
      },
    };
    if (deletedCount === 0) {
      return result;
    }
    return {
      ...result,
      log: {
        message: "outbox cleanup completed",
        fields: { "outbox.cleanup.deleted_count": deletedCount },
      },
    };
  }
}
