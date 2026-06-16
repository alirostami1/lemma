import type { DatabaseExecutor } from "@lemma/db";
import { sql } from "kysely";
import type {
  ListQueueJobsInput,
  OpsQueueJob,
  OpsQueueJobStateFilter,
} from "../application/index.js";
import {
  isMissingPgBossTable,
  mapQueueJobRow,
  type OpsQueueJobRow,
} from "./KyselyOpsMappers.js";

export class KyselyOpsQueueRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async listQueueJobs(input: ListQueueJobsInput): Promise<OpsQueueJob[]> {
    const stateFilter = getQueueStateFilter(input.state);
    try {
      const result = await sql<OpsQueueJobRow>`
        select
          job.id::text as "id",
          job.name,
          job.state::text as "state",
          job.retry_count as "retryCount",
          job.retry_limit as "retryLimit",
          job.data,
          job.output,
          job.created_on as "createdOn",
          job.started_on as "startedOn",
          job.completed_on as "completedOn"
        from pgboss.job job
        where true
          ${stateFilter}
        order by
          job.completed_on desc nulls last,
          job.started_on desc nulls last,
          job.created_on desc nulls last
        limit ${input.limit}
      `.execute(this.db);
      return result.rows.map(mapQueueJobRow);
    } catch (error) {
      if (isMissingPgBossTable(error)) {
        return [];
      }
      throw error;
    }
  }

  async listFailedQueueJobs(input: { limit: number }): Promise<OpsQueueJob[]> {
    try {
      const result = await sql<OpsQueueJobRow>`
        select
          job.id::text as "id",
          job.name,
          job.state::text as "state",
          job.retry_count as "retryCount",
          job.retry_limit as "retryLimit",
          job.data,
          job.output,
          job.created_on as "createdOn",
          job.started_on as "startedOn",
          job.completed_on as "completedOn"
        from pgboss.job job
        left join ops_queue_job_reconciliations reconciliation
          on reconciliation.job_id = job.id::text
        where job.state = 'failed'
          and (
            reconciliation.job_id is null
            or reconciliation.status <> 'completed'
          )
        order by job.completed_on desc nulls last, job.created_on desc
        limit ${input.limit}
      `.execute(this.db);
      return result.rows.map(mapQueueJobRow);
    } catch (error) {
      if (isMissingPgBossTable(error)) {
        return [];
      }
      throw error;
    }
  }
}

function getQueueStateFilter(state: OpsQueueJobStateFilter) {
  switch (state) {
    case "all":
      return sql``;
    case "pending":
      return sql`and job.state in ('created', 'retry')`;
    case "successful":
      return sql`and job.state = 'completed'`;
    default:
      return sql`and job.state = ${state}`;
  }
}
