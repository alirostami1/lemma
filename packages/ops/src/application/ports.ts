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
  listFailedQueueJobs(input: { limit: number }): Promise<OpsQueueJob[]>;
  listOutboxEvents(input: ListOutboxEventsInput): Promise<OpsOutboxEvent[]>;
  listQueueJobs(input: ListQueueJobsInput): Promise<OpsQueueJob[]>;
  replayOutboxEvent(
    input: ReplayOutboxEventInput,
  ): Promise<OpsOutboxEvent | null>;
  reviewOutboxEvent(
    input: ReviewOutboxEventInput,
  ): Promise<OpsOutboxEvent | null>;
}

export type OpsCommand = {
  currentUser: CurrentUser;
};
