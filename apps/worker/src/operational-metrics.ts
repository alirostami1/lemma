import type { DatabasePort } from "@lemma/db";
import { sql } from "@lemma/db";
import {
  type ObservableGaugeRegistration,
  registerObservableGauge,
} from "@lemma/observability/node";

type QueueSnapshot = {
  available: boolean;
  pendingCount: number;
  completedCount: number;
  failedCount: number;
  oldestPendingCreatedAt: Date | null;
};

type OperationalSnapshot = {
  outbox: {
    pendingCount: number;
    publishingCount: number;
    publishedCount: number;
    failedCount: number;
    oldestPendingCreatedAt: Date | null;
  };
  queue: QueueSnapshot;
  questionGeneration: {
    completedCount: number;
    averageDurationSeconds: number;
  };
};

export class WorkerOperationalMetrics {
  private registrations: ObservableGaugeRegistration[] = [];
  private snapshotCache:
    | {
        loadedAtMs: number;
        promise: Promise<OperationalSnapshot>;
      }
    | undefined;

  constructor(
    private readonly deps: {
      db: DatabasePort;
      clock: { now(): Date };
    },
  ) {}

  start(): void {
    if (this.registrations.length > 0) {
      return;
    }

    this.registrations = [
      this.gauge(
        "lemma_outbox_pending_count",
        (snapshot) => snapshot.outbox.pendingCount,
      ),
      this.gauge(
        "lemma_outbox_publishing_count",
        (snapshot) => snapshot.outbox.publishingCount,
      ),
      this.gauge(
        "lemma_outbox_published_count",
        (snapshot) => snapshot.outbox.publishedCount,
      ),
      this.gauge(
        "lemma_outbox_failed_count",
        (snapshot) => snapshot.outbox.failedCount,
      ),
      this.gauge("lemma_outbox_oldest_pending_age_seconds", (snapshot) =>
        ageSeconds(
          snapshot.outbox.oldestPendingCreatedAt,
          this.deps.clock.now(),
        ),
      ),
      this.gauge("lemma_queue_available", (snapshot) =>
        snapshot.queue.available ? 1 : 0,
      ),
      this.gauge(
        "lemma_queue_pending_count",
        (snapshot) => snapshot.queue.pendingCount,
      ),
      this.gauge(
        "lemma_queue_completed_count",
        (snapshot) => snapshot.queue.completedCount,
      ),
      this.gauge(
        "lemma_queue_failed_count",
        (snapshot) => snapshot.queue.failedCount,
      ),
      this.gauge("lemma_queue_oldest_pending_age_seconds", (snapshot) =>
        ageSeconds(
          snapshot.queue.oldestPendingCreatedAt,
          this.deps.clock.now(),
        ),
      ),
      this.gauge(
        "lemma_question_generation_completed_count",
        (snapshot) => snapshot.questionGeneration.completedCount,
      ),
      this.gauge(
        "lemma_question_generation_average_duration_seconds",
        (snapshot) => snapshot.questionGeneration.averageDurationSeconds,
      ),
    ];
  }

  stop(): void {
    for (const registration of this.registrations) {
      registration.unregister();
    }
    this.registrations = [];
  }

  private gauge(
    name: string,
    value: (snapshot: OperationalSnapshot) => number,
  ): ObservableGaugeRegistration {
    return registerObservableGauge({
      name,
      callback: async (result) => {
        const snapshot = await this.loadSnapshot();
        result.observe(value(snapshot));
      },
    });
  }

  private loadSnapshot(): Promise<OperationalSnapshot> {
    const nowMs = this.deps.clock.now().getTime();
    if (this.snapshotCache && nowMs - this.snapshotCache.loadedAtMs < 1_000) {
      return this.snapshotCache.promise;
    }

    const promise = loadOperationalSnapshot(this.deps.db).catch((error) => {
      this.snapshotCache = undefined;
      throw error;
    });
    this.snapshotCache = { loadedAtMs: nowMs, promise };
    return promise;
  }
}

async function loadOperationalSnapshot(
  db: DatabasePort,
): Promise<OperationalSnapshot> {
  const [outbox, queue, questionGeneration] = await Promise.all([
    loadOutboxSnapshot(db),
    loadQueueSnapshot(db),
    loadQuestionGenerationSnapshot(db),
  ]);

  return { outbox, queue, questionGeneration };
}

async function loadOutboxSnapshot(db: DatabasePort) {
  const result = await sql<{
    status: string;
    count: number;
    oldestCreatedAt: Date | null;
  }>`
    select
      status,
      count(*)::int as "count",
      min(created_at) as "oldestCreatedAt"
    from outbox_events
    where status in ('pending', 'publishing', 'published', 'failed')
    group by status
  `.execute(db.executor);
  const rows = new Map(result.rows.map((row) => [row.status, row]));
  return {
    pendingCount: rows.get("pending")?.count ?? 0,
    publishingCount: rows.get("publishing")?.count ?? 0,
    publishedCount: rows.get("published")?.count ?? 0,
    failedCount: rows.get("failed")?.count ?? 0,
    oldestPendingCreatedAt: rows.get("pending")?.oldestCreatedAt ?? null,
  };
}

async function loadQueueSnapshot(db: DatabasePort): Promise<QueueSnapshot> {
  try {
    const pending = await sql<{
      count: number;
      oldestCreatedAt: Date | null;
    }>`
      select
        count(*)::int as "count",
        min(created_on) as "oldestCreatedAt"
      from pgboss.job
      where state in ('created', 'retry')
    `.execute(db.executor);
    const failed = await sql<{ count: number }>`
      select count(*)::int as "count"
      from pgboss.job job
      left join ops_queue_job_reconciliations reconciliation
        on reconciliation.job_id = job.id::text
      where job.state = 'failed'
        and (
          reconciliation.job_id is null
          or reconciliation.status <> 'completed'
        )
    `.execute(db.executor);
    const completed = await sql<{ count: number }>`
      select count(*)::int as "count"
      from pgboss.job job
      where job.state = 'completed'
    `.execute(db.executor);

    return {
      available: true,
      pendingCount: pending.rows[0]?.count ?? 0,
      completedCount: completed.rows[0]?.count ?? 0,
      failedCount: failed.rows[0]?.count ?? 0,
      oldestPendingCreatedAt: pending.rows[0]?.oldestCreatedAt ?? null,
    };
  } catch (error) {
    if (isMissingPgBossTable(error)) {
      return {
        available: false,
        pendingCount: 0,
        completedCount: 0,
        failedCount: 0,
        oldestPendingCreatedAt: null,
      };
    }
    throw error;
  }
}

async function loadQuestionGenerationSnapshot(db: DatabasePort) {
  const result = await sql<{
    completedCount: number;
    averageDurationSeconds: number | null;
  }>`
    select
      count(*)::int as "completedCount",
      coalesce(
        avg(extract(epoch from finished_at - created_at)),
        0
      )::float8 as "averageDurationSeconds"
    from question_generation_runs
    where status in ('succeeded', 'failed', 'cancelled')
      and finished_at is not null
      and finished_at >= now() - interval '15 minutes'
  `.execute(db.executor);
  return {
    completedCount: result.rows[0]?.completedCount ?? 0,
    averageDurationSeconds: result.rows[0]?.averageDurationSeconds ?? 0,
  };
}

function ageSeconds(date: Date | null, now: Date): number {
  if (!date) {
    return 0;
  }
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
}

function isMissingPgBossTable(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "42P01" || error.code === "3F000")
  );
}
