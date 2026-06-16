import type { DatabaseExecutor } from "@lemma/db";
import { sql } from "kysely";
import type { OpsOverview } from "../application/index.js";
import { isMissingPgBossTable } from "./KyselyOpsMappers.js";

export class KyselyOpsOverviewRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async getOverview(): Promise<OpsOverview> {
    const outbox = await this.getOutboxOverview();
    const queue = await this.getQueueOverview();
    return { outbox, queue };
  }

  private async getOutboxOverview() {
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
    `.execute(this.db);
    const rows = new Map(result.rows.map((row) => [row.status, row]));
    return {
      pendingCount: rows.get("pending")?.count ?? 0,
      publishingCount: rows.get("publishing")?.count ?? 0,
      publishedCount: rows.get("published")?.count ?? 0,
      failedCount: rows.get("failed")?.count ?? 0,
      oldestPendingCreatedAt: rows.get("pending")?.oldestCreatedAt ?? null,
    };
  }

  private async getQueueOverview() {
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
      `.execute(this.db);
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
      `.execute(this.db);
      const completed = await sql<{ count: number }>`
        select count(*)::int as "count"
        from pgboss.job job
        where job.state = 'completed'
      `.execute(this.db);
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
}
