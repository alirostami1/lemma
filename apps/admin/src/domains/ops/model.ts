export type OpsReviewAction = "reviewed" | "ignored" | "replayed";
export type OpsReviewState = "all" | "unreviewed" | "reviewed" | "ignored";
export type OpsOutboxStatusFilter =
  | "all"
  | "pending"
  | "publishing"
  | "published"
  | "failed";
export type OpsOutboxEventStatus =
  | "pending"
  | "publishing"
  | "published"
  | "failed";
export type OpsQueueStateFilter =
  | "all"
  | "pending"
  | "active"
  | "successful"
  | "failed";

export type OpsOverview = {
  outbox: {
    pendingCount: number;
    publishingCount: number;
    publishedCount: number;
    failedCount: number;
    oldestPendingCreatedAt: string | null;
  };
  queue: {
    available: boolean;
    pendingCount: number;
    completedCount: number;
    failedCount: number;
    oldestPendingCreatedAt: string | null;
  };
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
  availableAt: string;
  lockedBy: string | null;
  lockedAt: string | null;
  publishedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  latestReview: {
    action: OpsReviewAction;
    note: string | null;
    actorUserId: string | null;
    actorEmail: string | null;
    createdAt: string;
  } | null;
};

export type OpsQueueJob = {
  id: string;
  name: string;
  state: string;
  retryCount: number;
  retryLimit: number;
  data: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  createdOn: string | null;
  startedOn: string | null;
  completedOn: string | null;
};
