import type { DatabasePort } from "@lemma/db";
import { instrumentExternal } from "@lemma/observability";
import type {
  ListOutboxEventsInput,
  ListQueueJobsInput,
  OpsOutboxEvent,
  OpsOverview,
  OpsQueueJob,
  OpsRepository,
  ReplayOutboxEventInput,
  ReviewOutboxEventInput,
} from "../application/index.js";
import { KyselyOpsOutboxEventsRepository } from "./KyselyOpsOutboxEventsRepository.js";
import { KyselyOpsOverviewRepository } from "./KyselyOpsOverviewRepository.js";
import { KyselyOpsQueueRepository } from "./KyselyOpsQueueRepository.js";

const instrumentation = instrumentExternal("ops", "repository");

export class KyselyOpsRepository implements OpsRepository {
  private readonly outbox: KyselyOpsOutboxEventsRepository;
  private readonly overview: KyselyOpsOverviewRepository;
  private readonly queue: KyselyOpsQueueRepository;

  constructor(db: DatabasePort) {
    this.outbox = new KyselyOpsOutboxEventsRepository(db);
    this.overview = new KyselyOpsOverviewRepository(db.executor);
    this.queue = new KyselyOpsQueueRepository(db.executor);
  }

  getOverview(): Promise<OpsOverview> {
    return this.dbOperation("get_overview", () => this.overview.getOverview());
  }

  listOutboxEvents(
    input: ListOutboxEventsInput,
  ): Promise<OpsOutboxEvent[]> {
    return this.dbOperation("list_outbox_events", () =>
      this.outbox.listOutboxEvents(input),
    );
  }

  listQueueJobs(input: ListQueueJobsInput): Promise<OpsQueueJob[]> {
    return this.dbOperation("list_queue_jobs", () =>
      this.queue.listQueueJobs(input),
    );
  }

  listFailedQueueJobs(input: { limit: number }): Promise<OpsQueueJob[]> {
    return this.dbOperation("list_failed_queue_jobs", () =>
      this.queue.listFailedQueueJobs(input),
    );
  }

  reviewOutboxEvent(
    input: ReviewOutboxEventInput,
  ): Promise<OpsOutboxEvent | null> {
    return this.dbOperation("review_outbox_event", () =>
      this.outbox.reviewOutboxEvent(input),
    );
  }

  replayOutboxEvent(
    input: ReplayOutboxEventInput,
  ): Promise<OpsOutboxEvent | null> {
    return this.dbOperation("replay_outbox_event", () =>
      this.outbox.replayOutboxEvent(input),
    );
  }

  private async dbOperation<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return instrumentation.run(
      operation,
      {
        attributes: { "db.system": "postgresql" },
      },
      fn,
    );
  }
}
