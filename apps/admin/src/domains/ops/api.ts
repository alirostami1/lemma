import { authedFetch } from "#/lib/custom-fetch";
import type {
  OpsOutboxEvent,
  OpsOutboxStatusFilter,
  OpsOverview,
  OpsQueueJob,
  OpsQueueStateFilter,
  OpsReviewState,
} from "./model";

type ListOpsOutboxEventsResponse = {
  events: OpsOutboxEvent[];
};

type OpsOutboxEventResponse = {
  event: OpsOutboxEvent;
};

type ListOpsFailedQueueJobsResponse = {
  jobs: OpsQueueJob[];
};

type ListOpsQueueJobsResponse = {
  jobs: OpsQueueJob[];
};

export function getOpsOverview(): Promise<OpsOverview> {
  return authedFetch<OpsOverview>("/api/v1/ops/overview");
}

export function listOpsOutboxEvents(input: {
  status?: OpsOutboxStatusFilter;
  reviewState: OpsReviewState;
  limit?: number;
}): Promise<ListOpsOutboxEventsResponse> {
  const params = new URLSearchParams({
    status: input.status ?? "failed",
    reviewState: input.reviewState,
    limit: String(input.limit ?? 50),
  });
  return authedFetch<ListOpsOutboxEventsResponse>(
    `/api/v1/ops/outbox-events?${params.toString()}`,
  );
}

export function listOpsFailedQueueJobs(input?: {
  limit?: number;
}): Promise<ListOpsFailedQueueJobsResponse> {
  const params = new URLSearchParams({
    limit: String(input?.limit ?? 50),
  });
  return authedFetch<ListOpsFailedQueueJobsResponse>(
    `/api/v1/ops/queue-jobs/failed?${params.toString()}`,
  );
}

export function listOpsQueueJobs(input: {
  state?: OpsQueueStateFilter;
  limit?: number;
}): Promise<ListOpsQueueJobsResponse> {
  const params = new URLSearchParams({
    state: input.state ?? "all",
    limit: String(input.limit ?? 50),
  });
  return authedFetch<ListOpsQueueJobsResponse>(
    `/api/v1/ops/queue-jobs?${params.toString()}`,
  );
}

export function reviewOpsOutboxEvent(input: {
  eventId: string;
  action: "reviewed" | "ignored";
  note?: string | null;
}): Promise<OpsOutboxEvent> {
  return authedFetch<OpsOutboxEventResponse>(
    `/api/v1/ops/outbox-events/${input.eventId}/review`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: input.action,
        note: input.note ?? null,
      }),
    },
  ).then((response) => response.event);
}

export function replayOpsOutboxEvent(input: {
  eventId: string;
  note?: string | null;
}): Promise<OpsOutboxEvent> {
  return authedFetch<OpsOutboxEventResponse>(
    `/api/v1/ops/outbox-events/${input.eventId}/replay`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note: input.note ?? null,
      }),
    },
  ).then((response) => response.event);
}
