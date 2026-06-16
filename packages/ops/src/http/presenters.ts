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
  return {
    outbox: {
      pendingCount: overview.outbox.pendingCount,
      publishingCount: overview.outbox.publishingCount,
      publishedCount: overview.outbox.publishedCount,
      failedCount: overview.outbox.failedCount,
      oldestPendingCreatedAt:
        overview.outbox.oldestPendingCreatedAt?.toISOString() ?? null,
    },
    queue: {
      available: overview.queue.available,
      pendingCount: overview.queue.pendingCount,
      completedCount: overview.queue.completedCount,
      failedCount: overview.queue.failedCount,
      oldestPendingCreatedAt:
        overview.queue.oldestPendingCreatedAt?.toISOString() ?? null,
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
    availableAt: event.availableAt.toISOString(),
    lockedBy: event.lockedBy,
    lockedAt: event.lockedAt?.toISOString() ?? null,
    publishedAt: event.publishedAt?.toISOString() ?? null,
    lastError: event.lastError,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    latestReview: event.latestReview
      ? {
          action: event.latestReview.action,
          note: event.latestReview.note,
          actorUserId: event.latestReview.actorUserId,
          actorEmail: event.latestReview.actorEmail,
          createdAt: event.latestReview.createdAt.toISOString(),
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
    createdOn: job.createdOn?.toISOString() ?? null,
    startedOn: job.startedOn?.toISOString() ?? null,
    completedOn: job.completedOn?.toISOString() ?? null,
  };
}
