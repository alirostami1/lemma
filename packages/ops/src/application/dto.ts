import type { JsonObject } from "@lemma/domain";

export type OpsOutboxEventReviewAction = "reviewed" | "ignored" | "replayed";
export type OpsOutboxEventReviewState =
  | "all"
  | "unreviewed"
  | "reviewed"
  | "ignored";
export type OpsOutboxEventStatus =
  | "pending"
  | "publishing"
  | "published"
  | "failed";
export type OpsQueueJobStateFilter =
  | "all"
  | "pending"
  | "active"
  | "successful"
  | "created"
  | "retry"
  | "completed"
  | "failed"
  | "expired"
  | "cancelled";

export type OpsOutboxEventReview = {
  action: OpsOutboxEventReviewAction;
  note: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  createdAt: Date;
};

export type OpsOutboxEvent = {
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
  latestReview: OpsOutboxEventReview | null;
};

export type OpsQueueJob = {
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

export type OpsOverview = {
  outbox: {
    pendingCount: number;
    publishingCount: number;
    publishedCount: number;
    failedCount: number;
    oldestPendingCreatedAt: Date | null;
  };
  queue: {
    available: boolean;
    pendingCount: number;
    completedCount: number;
    failedCount: number;
    oldestPendingCreatedAt: Date | null;
  };
};
