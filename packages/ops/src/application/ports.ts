import type { CurrentUser } from "@lemma/identity/application";
import type {
  OpsOutboxEvent,
  OpsOutboxEventReviewAction,
  OpsOutboxEventReviewState,
  OpsOutboxEventStatus,
  OpsOverview,
  OpsQueueJob,
  OpsQueueJobStateFilter,
} from "./dto.js";

export type ListOutboxEventsInput = {
  status: OpsOutboxEventStatus | "all";
  reviewState: OpsOutboxEventReviewState;
  limit: number;
};

export type ListQueueJobsInput = {
  state: OpsQueueJobStateFilter;
  limit: number;
};

export type ReviewOutboxEventInput = {
  eventId: string;
  action: Exclude<OpsOutboxEventReviewAction, "replayed">;
  note?: string | null;
  actorUserId: string;
};

export type ReplayOutboxEventInput = {
  eventId: string;
  note?: string | null;
  actorUserId: string;
};

export interface OpsRepository {
  getOverview(): Promise<OpsOverview>;
  listOutboxEvents(input: ListOutboxEventsInput): Promise<OpsOutboxEvent[]>;
  listQueueJobs(input: ListQueueJobsInput): Promise<OpsQueueJob[]>;
  listFailedQueueJobs(input: { limit: number }): Promise<OpsQueueJob[]>;
  reviewOutboxEvent(
    input: ReviewOutboxEventInput,
  ): Promise<OpsOutboxEvent | null>;
  replayOutboxEvent(
    input: ReplayOutboxEventInput,
  ): Promise<OpsOutboxEvent | null>;
}

export type OpsCommand = {
  currentUser: CurrentUser;
};
