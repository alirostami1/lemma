import { parseOperationLineage, type OperationLineage } from "@lemma/domain";
import type { DatabasePort } from "@lemma/db";
import { sql } from "@lemma/db";
import {
  QUESTION_GENERATION_MATERIALIZE_JOB,
  QUESTION_GENERATION_ORCHESTRATE_JOB,
} from "@lemma/jobs/application";
import { withSpan } from "@lemma/observability/node";
import type { QuestionGenerationWorkerService } from "@lemma/questions/application";
import {
  errorMessageFromUnknown,
  jobDataLineageSpanAttributes,
  type ReconciliationOutcome,
  type ReconciliationPolicy,
} from "./pipeline.js";
import { PollingLoop } from "./polling-loop.js";
import { logWorkerError } from "./worker-logging.js";

export type FailedQueueJob = {
  id: string;
  name: string;
  data: unknown;
  output: unknown;
  retryCount: number;
  retryLimit: number;
  createdOn: Date | null;
  startedOn: Date | null;
  completedOn: Date | null;
};

type ReconciliationResult =
  | "invalid_payload"
  | "run_failed"
  | "run_not_found"
  | "run_terminal";
type FailedGenerationJobResult = Awaited<
  ReturnType<
    QuestionGenerationWorkerService["reconcileFailedGenerationJob"]
  >
>;

export type FailedQueueJobReconciliationRepository = {
  claimFailedJobs(input: {
    name: string;
    limit: number;
    lockedBy: string;
    lockedAt: Date;
    staleBefore: Date;
  }): Promise<FailedQueueJob[]>;
  completeReconciliation(input: {
    jobId: string;
    result: ReconciliationResult;
    questionGenerationRunId: string | null;
    errorMessage: string | null;
    completedAt: Date;
  }): Promise<void>;
  recordReconciliationFailure(input: {
    jobId: string;
    errorMessage: string;
    failedAt: Date;
  }): Promise<void>;
};

export type FailedQueueJobReconcilerConfig = {
  workerId: string;
  batchSize: number;
  intervalMs: number;
  lockTimeoutMs: number;
};

export class FailedQueueJobReconciler {
  private readonly policy: ReconciliationPolicy<
    FailedQueueJob,
    ReconciliationResult
  >;
  private readonly pollingLoop: PollingLoop;

  constructor(
    private readonly deps: {
      repository: FailedQueueJobReconciliationRepository;
      questionGenerationWorkerService: Pick<
        QuestionGenerationWorkerService,
        "reconcileFailedGenerationJob"
      >;
      clock: { now(): Date };
      config: FailedQueueJobReconcilerConfig;
    },
  ) {
    this.pollingLoop = new PollingLoop({
      name: "failed-queue-job-reconciler",
      intervalMs: deps.config.intervalMs,
      task: () => this.runPollingTask(),
    });
    this.policy = {
      jobNames: QUESTION_GENERATION_JOB_NAMES,
      reconcile: (job) => this.reconcileQuestionGenerationJob(job),
      recordFailure: (job, error) =>
        this.recordReconciliationFailure(job, error),
    };
  }

  start(): void {
    this.pollingLoop.start();
  }

  stop(): void {
    this.pollingLoop.stop();
  }

  async runOnce(): Promise<number> {
    const now = this.deps.clock.now();
    const jobs: FailedQueueJob[] = [];
    for (const name of this.policy.jobNames) {
      jobs.push(
        ...(await this.deps.repository.claimFailedJobs({
          name,
          limit: this.deps.config.batchSize,
          lockedBy: this.deps.config.workerId,
          lockedAt: now,
          staleBefore: new Date(now.getTime() - this.deps.config.lockTimeoutMs),
        })),
      );
    }

    for (const job of jobs) {
      try {
        await withSpan(
          "queue.reconcile_failed_job",
          {
            "job.id": job.id,
            "job.name": job.name,
            "job.retry_count": job.retryCount,
            "job.retry_limit": job.retryLimit,
            ...jobDataLineageSpanAttributes(job.data),
          },
          () => this.reconcileJob(job),
        );
      } catch (error) {
        logWorkerError(
          "failed queue job reconciliation failed",
          {
            "job.id": job.id,
            "job.name": job.name,
          },
          error,
        );
      }
    }

    return jobs.length;
  }

  private async runPollingTask() {
    const reconciledCount = await this.runOnce();
    const result = {
      attributes: {
        "queue.failed_jobs.reconciled_count": reconciledCount,
      },
    };
    if (reconciledCount === 0) {
      return result;
    }
    return {
      ...result,
      log: {
        message: "failed queue jobs reconciled",
        fields: {
          "queue.failed_jobs.reconciled_count": reconciledCount,
        },
      },
    };
  }

  private async reconcileJob(job: FailedQueueJob): Promise<void> {
    try {
      const outcome = await this.policy.reconcile(job);
      await this.deps.repository.completeReconciliation({
        jobId: job.id,
        result: outcome.result,
        questionGenerationRunId: outcome.resourceId,
        errorMessage: outcome.errorMessage,
        completedAt: this.deps.clock.now(),
      });
    } catch (error) {
      await this.policy.recordFailure(job, error);
      throw error;
    }
  }

  private async reconcileQuestionGenerationJob(
    job: FailedQueueJob,
  ): Promise<ReconciliationOutcome<ReconciliationResult>> {
    const questionGenerationRunId = getQuestionGenerationRunId(job.data);
    const lineage = getLineage(job.data);
    const auditErrorMessage = failedQueueJobMessage(job);

    if (!questionGenerationRunId || !lineage) {
      return {
        result: "invalid_payload",
        resourceId: null,
        errorMessage: auditErrorMessage,
      };
    }

    const result =
      await this.deps.questionGenerationWorkerService.reconcileFailedGenerationJob(
        {
          questionGenerationRunId,
          lineage,
          errorMessage: failedQuestionGenerationMessage(job),
        },
      );
    return {
      result: mapReconciliationResult(result),
      resourceId:
        result.status === "skipped" && result.reason === "invalid_payload"
          ? null
          : questionGenerationRunId,
      errorMessage: auditErrorMessage,
    };
  }

  private recordReconciliationFailure(
    job: FailedQueueJob,
    error: unknown,
  ): Promise<void> {
    return this.deps.repository.recordReconciliationFailure({
      jobId: job.id,
      errorMessage: errorMessageFromUnknown(
        error,
        "Queue reconciliation failed.",
      ),
      failedAt: this.deps.clock.now(),
    });
  }
}

const QUESTION_GENERATION_JOB_NAMES = [
  QUESTION_GENERATION_ORCHESTRATE_JOB,
  QUESTION_GENERATION_MATERIALIZE_JOB,
] as const;

export class KyselyFailedQueueJobReconciliationRepository
  implements FailedQueueJobReconciliationRepository
{
  constructor(private readonly db: DatabasePort) {}

  async claimFailedJobs(input: {
    name: string;
    limit: number;
    lockedBy: string;
    lockedAt: Date;
    staleBefore: Date;
  }): Promise<FailedQueueJob[]> {
    if (input.limit <= 0) {
      return [];
    }

    try {
      const result = await sql<FailedQueueJob>`
        with failed_jobs as (
          select
            job.id::text as "id",
            job.name::text as "name",
            job.data as "data",
            job.output as "output",
            job.retry_count::int as "retryCount",
            job.retry_limit::int as "retryLimit",
            job.created_on as "createdOn",
            job.started_on as "startedOn",
            job.completed_on as "completedOn"
          from pgboss.job job
          left join ops_queue_job_reconciliations reconciliation
            on reconciliation.job_id = job.id::text
          where job.name = ${input.name}
            and job.state = 'failed'
            and (
              reconciliation.job_id is null
              or (
                reconciliation.status = 'processing'
                and reconciliation.locked_at <= ${input.staleBefore}
              )
            )
          order by job.completed_on asc nulls first, job.created_on asc
          limit ${input.limit}
        ),
        claimed_jobs as (
          insert into ops_queue_job_reconciliations (
            job_id,
            job_name,
            status,
            locked_by,
            locked_at,
            last_error,
            created_at,
            updated_at
          )
          select
            id,
            name,
            'processing',
            ${input.lockedBy},
            ${input.lockedAt},
            null,
            ${input.lockedAt},
            ${input.lockedAt}
          from failed_jobs
          on conflict (job_id) do update
          set
            status = 'processing',
            locked_by = excluded.locked_by,
            locked_at = excluded.locked_at,
            last_error = null,
            updated_at = excluded.updated_at
          where ops_queue_job_reconciliations.status = 'processing'
            and ops_queue_job_reconciliations.locked_at <= ${input.staleBefore}
          returning job_id
        )
        select failed_jobs.*
        from failed_jobs
        inner join claimed_jobs on claimed_jobs.job_id = failed_jobs.id
      `.execute(this.db.executor);
      return result.rows;
    } catch (error) {
      if (isMissingPgBossTable(error)) {
        return [];
      }
      throw error;
    }
  }

  async completeReconciliation(input: {
    jobId: string;
    result: ReconciliationResult;
    questionGenerationRunId: string | null;
    errorMessage: string | null;
    completedAt: Date;
  }): Promise<void> {
    await sql`
      update ops_queue_job_reconciliations
      set
        status = 'completed',
        result = ${input.result},
        question_generation_run_id = ${input.questionGenerationRunId}::uuid,
        error_message = ${input.errorMessage},
        last_error = null,
        completed_at = ${input.completedAt},
        updated_at = ${input.completedAt}
      where job_id = ${input.jobId}
    `.execute(this.db.executor);
  }

  async recordReconciliationFailure(input: {
    jobId: string;
    errorMessage: string;
    failedAt: Date;
  }): Promise<void> {
    await sql`
      update ops_queue_job_reconciliations
      set
        last_error = ${input.errorMessage},
        updated_at = ${input.failedAt}
      where job_id = ${input.jobId}
    `.execute(this.db.executor);
  }
}

function mapReconciliationResult(
  result: FailedGenerationJobResult,
): ReconciliationResult {
  if (!isSkippedGenerationResult(result)) {
    return result.status === "failed" ? "run_failed" : "run_terminal";
  }
  switch (result.reason) {
    case "invalid_payload":
      return "invalid_payload";
    case "not_found":
      return "run_not_found";
    case "terminal":
      return "run_terminal";
  }
}

function isSkippedGenerationResult(
  result: FailedGenerationJobResult,
): result is Extract<FailedGenerationJobResult, { status: "skipped" }> {
  return result.status === "skipped";
}

function getQuestionGenerationRunId(data: unknown): string | null {
  if (!isRecord(data)) {
    return null;
  }
  const value = data.questionGenerationRunId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getLineage(data: unknown): OperationLineage | null {
  if (typeof data !== "object" || data === null || !("lineage" in data)) {
    return null;
  }
  try {
    return parseOperationLineage(data.lineage);
  } catch {
    return null;
  }
}

function failedQueueJobMessage(job: FailedQueueJob): string {
  const detail = getFailureDetail(job.output);
  const base =
    `Queue job ${job.id} failed after ` +
    `${job.retryCount}/${job.retryLimit} retries`;
  return detail ? `${base}: ${detail}` : `${base}.`;
}

function failedQuestionGenerationMessage(job: FailedQueueJob): string {
  const detail = getFailureDetail(job.output);
  if (detail) {
    return detail;
  }
  return `Queue job ${job.id} exhausted retries.`;
}

function getFailureDetail(output: unknown): string | null {
  if (!isRecord(output)) {
    return null;
  }
  const direct =
    stringProperty(output, "message") ??
    stringProperty(output, "errorMessage") ??
    stringProperty(output, "error");
  if (direct) {
    return direct;
  }
  const error = output.error;
  if (isRecord(error)) {
    return stringProperty(error, "message") ?? stringProperty(error, "code");
  }
  return null;
}

function stringProperty(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingPgBossTable(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "42P01" || error.code === "3F000")
  );
}
