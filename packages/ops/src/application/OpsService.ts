import type { CurrentUser } from "@lemma/identity/application";
import { instrumentService } from "@lemma/observability";
import type {
  OpsOutboxEventReviewState,
  OpsOutboxEventStatus,
  OpsQueueJobStateFilter,
} from "./dto.js";
import {
  ForbiddenOpsActionError,
  InvalidOpsRequestError,
  OpsOutboxEventNotFoundError,
} from "./errors.js";
import type { OpsRepository } from "./ports.js";

const MAX_LIMIT = 100;

const instrumentation = instrumentService("ops", "service");

export class OpsService {
  constructor(private readonly deps: { opsRepository: OpsRepository }) {}

  async getOverview(command: { currentUser: CurrentUser }) {
    return this.operation("get_overview", async () => {
      this.requireOpsAccess(command.currentUser);
      return this.deps.opsRepository.getOverview();
    });
  }

  async listOutboxEvents(command: {
    currentUser: CurrentUser;
    status?: string | null;
    reviewState?: string | null;
    limit?: number | null;
  }) {
    return this.operation("list_outbox_events", async () => {
      this.requireOpsAccess(command.currentUser);
      return this.deps.opsRepository.listOutboxEvents({
        status: parseStatus(command.status),
        reviewState: parseReviewState(command.reviewState),
        limit: normalizeLimit(command.limit),
      });
    });
  }

  async listFailedOutboxEvents(command: {
    currentUser: CurrentUser;
    status?: string | null;
    reviewState?: string | null;
    limit?: number | null;
  }) {
    return this.listOutboxEvents(command);
  }

  async listQueueJobs(command: {
    currentUser: CurrentUser;
    state?: string | null;
    limit?: number | null;
  }) {
    return this.operation("list_queue_jobs", async () => {
      this.requireOpsAccess(command.currentUser);
      return this.deps.opsRepository.listQueueJobs({
        state: parseQueueState(command.state),
        limit: normalizeLimit(command.limit),
      });
    });
  }

  async listFailedQueueJobs(command: {
    currentUser: CurrentUser;
    limit?: number | null;
  }) {
    return this.operation("list_failed_queue_jobs", async () => {
      this.requireOpsAccess(command.currentUser);
      return this.deps.opsRepository.listFailedQueueJobs({
        limit: normalizeLimit(command.limit),
      });
    });
  }

  async reviewOutboxEvent(command: {
    currentUser: CurrentUser;
    eventId: string;
    action: "reviewed" | "ignored";
    note?: string | null;
  }) {
    return this.operation("review_outbox_event", async () => {
      this.requireOpsAccess(command.currentUser);
      assertUuid(command.eventId);
      const event = await this.deps.opsRepository.reviewOutboxEvent({
        eventId: command.eventId,
        action: command.action,
        note: normalizeNote(command.note),
        actorUserId: command.currentUser.user.id,
      });
      if (!event) {
        throw new OpsOutboxEventNotFoundError();
      }
      return event;
    });
  }

  async replayOutboxEvent(command: {
    currentUser: CurrentUser;
    eventId: string;
    note?: string | null;
  }) {
    return this.operation("replay_outbox_event", async () => {
      this.requireOpsAccess(command.currentUser);
      assertUuid(command.eventId);
      const event = await this.deps.opsRepository.replayOutboxEvent({
        eventId: command.eventId,
        note: normalizeNote(command.note),
        actorUserId: command.currentUser.user.id,
      });
      if (!event) {
        throw new OpsOutboxEventNotFoundError();
      }
      return event;
    });
  }

  private requireOpsAccess(currentUser: CurrentUser): void {
    if (!currentUser.isAdmin) {
      throw new ForbiddenOpsActionError();
    }
  }

  private async operation<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return instrumentation.run(operation, fn);
  }
}

function normalizeLimit(limit: number | null | undefined): number {
  if (!Number.isFinite(limit)) {
    return 50;
  }
  const value = Math.trunc(limit ?? 50);
  if (value < 1) {
    return 1;
  }
  return Math.min(value, MAX_LIMIT);
}

function parseStatus(
  value: string | null | undefined,
): OpsOutboxEventStatus | "all" {
  if (
    value === "all" ||
    value === "pending" ||
    value === "publishing" ||
    value === "published" ||
    value === "failed"
  ) {
    return value;
  }
  return "failed";
}

function parseReviewState(
  value: string | null | undefined,
): OpsOutboxEventReviewState {
  if (
    value === "all" ||
    value === "unreviewed" ||
    value === "reviewed" ||
    value === "ignored"
  ) {
    return value;
  }
  return "all";
}

function parseQueueState(
  value: string | null | undefined,
): OpsQueueJobStateFilter {
  if (
    value === "all" ||
    value === "pending" ||
    value === "active" ||
    value === "successful" ||
    value === "created" ||
    value === "retry" ||
    value === "completed" ||
    value === "failed" ||
    value === "expired" ||
    value === "cancelled"
  ) {
    return value;
  }
  return "all";
}

function normalizeNote(note: string | null | undefined): string | null {
  const normalized = note?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function assertUuid(value: string): void {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
      value,
    )
  ) {
    throw new InvalidOpsRequestError("eventId must be a UUID.");
  }
}
