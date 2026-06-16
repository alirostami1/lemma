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
    id: row.id,
    eventType: row.eventType,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    ownerUserId: row.ownerUserId,
    requestId: row.requestId,
    correlationId: row.correlationId,
    causationId: row.causationId,
    status: row.status,
    attempts: row.attempts,
    availableAt: row.availableAt,
    lockedBy: row.lockedBy,
    lockedAt: row.lockedAt,
    publishedAt: row.publishedAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    latestReview: mapReview(row),
  };
}

export function mapQueueJobRow(row: OpsQueueJobRow): OpsQueueJob {
  return {
    id: row.id,
    name: row.name,
    state: row.state,
    retryCount: row.retryCount,
    retryLimit: row.retryLimit,
    data: row.data,
    output: row.output,
    createdOn: row.createdOn,
    startedOn: row.startedOn,
    completedOn: row.completedOn,
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
    note: row.reviewNote,
    actorUserId: row.reviewActorUserId,
    actorEmail: row.reviewActorEmail,
    createdAt: row.reviewCreatedAt,
  };
}
