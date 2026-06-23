import { presentDate, presentNullableDate } from "@lemma/http";
import type {
  OpsOutboxEvent as OpsOutboxEventResult,
  OpsOverview as OpsOverviewResult,
  OpsQueueJob as OpsQueueJobResult,
} from "../application/index.js";
import type {
  ListOpsFailedQueueJobsResponse as ListOpsFailedQueueJobsResponseDto,
  ListOpsOutboxEventsResponse as ListOpsOutboxEventsResponseDto,
  OpsOutboxEvent as OpsOutboxEventDto,
  OpsOutboxEventResponse as OpsOutboxEventResponseDto,
  OpsOverview as OpsOverviewDto,
  OpsQueueJob as OpsQueueJobDto,
} from "../generated/types/index.js";

export function presentOpsOverview(
  overview: OpsOverviewResult,
): OpsOverviewDto {
  return toOpsOverviewDto(overview);
}

function toOpsOverviewDto(overview: OpsOverviewResult): OpsOverviewDto {
  return {
    outbox: {
      failedCount: overview.outbox.failedCount,
      oldestPendingCreatedAt: presentNullableDate(
        overview.outbox.oldestPendingCreatedAt,
      ),
      pendingCount: overview.outbox.pendingCount,
      publishedCount: overview.outbox.publishedCount,
      publishingCount: overview.outbox.publishingCount,
    },
    queue: {
      available: overview.queue.available,
      completedCount: overview.queue.completedCount,
      failedCount: overview.queue.failedCount,
      oldestPendingCreatedAt: presentNullableDate(
        overview.queue.oldestPendingCreatedAt,
      ),
      pendingCount: overview.queue.pendingCount,
    },
  };
}

export function presentOpsOutboxEvents(
  events: OpsOutboxEventResult[],
): ListOpsOutboxEventsResponseDto {
  return {
    events: events.map(toOutboxEventDto),
  };
}

export function presentOpsOutboxEvent(
  event: OpsOutboxEventResult,
): OpsOutboxEventResponseDto {
  return {
    event: toOutboxEventDto(event),
  };
}

export function presentOpsFailedQueueJobs(
  jobs: OpsQueueJobResult[],
): ListOpsFailedQueueJobsResponseDto {
  return presentOpsQueueJobs(jobs);
}

export function presentOpsQueueJobs(
  jobs: OpsQueueJobResult[],
): ListOpsFailedQueueJobsResponseDto {
  return {
    jobs: jobs.map(toQueueJobDto),
  };
}

function toOutboxEventDto(event: OpsOutboxEventResult): OpsOutboxEventDto {
  return {
    aggregateId: event.aggregateId,
    aggregateType: event.aggregateType,
    attempts: event.attempts,
    availableAt: presentDate(event.availableAt),
    causationId: event.causationId,
    correlationId: event.correlationId,
    createdAt: presentDate(event.createdAt),
    eventType: event.eventType,
    id: event.id,
    lastError: event.lastError,
    latestReview: event.latestReview
      ? {
          action: event.latestReview.action,
          actorEmail: event.latestReview.actorEmail,
          actorUserId: event.latestReview.actorUserId,
          createdAt: presentDate(event.latestReview.createdAt),
          note: event.latestReview.note,
        }
      : null,
    lockedAt: presentNullableDate(event.lockedAt),
    lockedBy: event.lockedBy,
    ownerUserId: event.ownerUserId,
    publishedAt: presentNullableDate(event.publishedAt),
    requestId: event.requestId,
    status: event.status,
    updatedAt: presentDate(event.updatedAt),
  };
}

function toQueueJobDto(job: OpsQueueJobResult): OpsQueueJobDto {
  return {
    completedOn: presentNullableDate(job.completedOn),
    createdOn: presentNullableDate(job.createdOn),
    data: job.data,
    id: job.id,
    name: job.name,
    output: job.output,
    retryCount: job.retryCount,
    retryLimit: job.retryLimit,
    startedOn: presentNullableDate(job.startedOn),
    state: job.state,
  };
}
