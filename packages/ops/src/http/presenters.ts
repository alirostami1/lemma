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
} from "../gen/types/index.js";

export function presentOpsOverview(
  overview: OpsOverviewResult,
): OpsOverviewDto {
  return toOpsOverviewDto(overview);
}

function toOpsOverviewDto(overview: OpsOverviewResult): OpsOverviewDto {
  return {
    outbox: {
      pendingCount: overview.outbox.pendingCount,
      publishingCount: overview.outbox.publishingCount,
      publishedCount: overview.outbox.publishedCount,
      failedCount: overview.outbox.failedCount,
      oldestPendingCreatedAt: presentNullableDate(
        overview.outbox.oldestPendingCreatedAt,
      ),
    },
    queue: {
      available: overview.queue.available,
      pendingCount: overview.queue.pendingCount,
      completedCount: overview.queue.completedCount,
      failedCount: overview.queue.failedCount,
      oldestPendingCreatedAt: presentNullableDate(
        overview.queue.oldestPendingCreatedAt,
      ),
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
    id: event.id,
    eventType: event.eventType,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    ownerUserId: event.ownerUserId,
    requestId: event.requestId,
    correlationId: event.correlationId,
    causationId: event.causationId,
    status: event.status,
    attempts: event.attempts,
    availableAt: presentDate(event.availableAt),
    lockedBy: event.lockedBy,
    lockedAt: presentNullableDate(event.lockedAt),
    publishedAt: presentNullableDate(event.publishedAt),
    lastError: event.lastError,
    createdAt: presentDate(event.createdAt),
    updatedAt: presentDate(event.updatedAt),
    latestReview: event.latestReview
      ? {
          action: event.latestReview.action,
          note: event.latestReview.note,
          actorUserId: event.latestReview.actorUserId,
          actorEmail: event.latestReview.actorEmail,
          createdAt: presentDate(event.latestReview.createdAt),
        }
      : null,
  };
}

function toQueueJobDto(job: OpsQueueJobResult): OpsQueueJobDto {
  return {
    id: job.id,
    name: job.name,
    state: job.state,
    retryCount: job.retryCount,
    retryLimit: job.retryLimit,
    data: job.data,
    output: job.output,
    createdOn: presentNullableDate(job.createdOn),
    startedOn: presentNullableDate(job.startedOn),
    completedOn: presentNullableDate(job.completedOn),
  };
}
