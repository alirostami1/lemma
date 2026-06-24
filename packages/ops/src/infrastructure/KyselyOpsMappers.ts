import type { JsonObject } from "@lemma/domain";
import type {
  OpsOutboxEvent,
  OpsOutboxEventReview,
  OpsOutboxEventReviewAction,
  OpsOutboxEventStatus,
  OpsQueueJob,
} from "../application/index.js";

export type OpsOutboxEventRow = {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  ownerUserId: string | null;
  requestId: string;
  correlationId: string;
  causationId: string | null;
  status: OpsOutboxEventStatus;
  attempts: number;
  availableAt: Date;
  lockedBy: string | null;
  lockedAt: Date | null;
  publishedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  reviewAction: OpsOutboxEventReviewAction | null;
  reviewNote: string | null;
  reviewActorUserId: string | null;
  reviewActorEmail: string | null;
  reviewCreatedAt: Date | null;
};

export type OpsQueueJobRow = {
  id: string;
  name: string;
  state: string;
  retryCount: number;
  retryLimit: number;
  data: JsonObject | null;
  output: JsonObject | null;
  createdOn: Date | null;
  startedOn: Date | null;
  completedOn: Date | null;
};

export function mapOutboxEventRow(row: OpsOutboxEventRow): OpsOutboxEvent {
  return {
    aggregateId: row.aggregateId,
    aggregateType: row.aggregateType,
    attempts: row.attempts,
    availableAt: row.availableAt,
    causationId: row.causationId,
    correlationId: row.correlationId,
    createdAt: row.createdAt,
    eventType: row.eventType,
    id: row.id,
    lastError: row.lastError,
    latestReview: mapReview(row),
    lockedAt: row.lockedAt,
    lockedBy: row.lockedBy,
    ownerUserId: row.ownerUserId,
    publishedAt: row.publishedAt,
    requestId: row.requestId,
    status: row.status,
    updatedAt: row.updatedAt,
  };
}

export function mapQueueJobRow(row: OpsQueueJobRow): OpsQueueJob {
  return {
    completedOn: row.completedOn,
    createdOn: row.createdOn,
    data: row.data,
    id: row.id,
    name: row.name,
    output: row.output,
    retryCount: row.retryCount,
    retryLimit: row.retryLimit,
    startedOn: row.startedOn,
    state: row.state,
  };
}

export function isMissingPgBossTable(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "42P01" || error.code === "3F000")
  );
}

function mapReview(row: OpsOutboxEventRow): OpsOutboxEventReview | null {
  if (!row.reviewAction || !row.reviewCreatedAt) {
    return null;
  }
  return {
    action: row.reviewAction,
    actorEmail: row.reviewActorEmail,
    actorUserId: row.reviewActorUserId,
    createdAt: row.reviewCreatedAt,
    note: row.reviewNote,
  };
}
