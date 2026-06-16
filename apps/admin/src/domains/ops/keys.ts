import type {
  OpsOutboxStatusFilter,
  OpsQueueStateFilter,
  OpsReviewState,
} from "./model";

export const opsKeys = {
  all: ["ops"] as const,
  overview: () => [...opsKeys.all, "overview"] as const,
  outboxEvents: (input: {
    status: OpsOutboxStatusFilter;
    reviewState: OpsReviewState;
  }) => [...opsKeys.all, "outbox-events", input] as const,
  failedQueueJobs: () => [...opsKeys.all, "queue-jobs", "failed"] as const,
  queueJobs: (input: { state: OpsQueueStateFilter }) =>
    [...opsKeys.all, "queue-jobs", input] as const,
};
