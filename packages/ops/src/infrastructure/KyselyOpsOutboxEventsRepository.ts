import type { DatabaseExecutor, DatabasePort } from "@lemma/db";
import { sql } from "kysely";
import type {
  ListOutboxEventsInput,
  OpsOutboxEvent,
  OpsOutboxEventReviewAction,
  OpsOutboxEventStatus,
  ReplayOutboxEventInput,
  ReviewOutboxEventInput,
} from "../application/index.js";
import {
  mapOutboxEventRow,
  type OpsOutboxEventRow,
} from "./KyselyOpsMappers.js";

export class KyselyOpsOutboxEventsRepository {
  constructor(private readonly db: DatabasePort) {}

  async listOutboxEvents(
    input: ListOutboxEventsInput,
  ): Promise<OpsOutboxEvent[]> {
    const reviewFilter = getReviewFilter(input.reviewState);
    const statusFilter = getStatusFilter(input.status);
    const result = await sql<OpsOutboxEventRow>`
      select
        e.id::text as "id",
        e.event_type as "eventType",
        e.aggregate_type as "aggregateType",
        e.aggregate_id as "aggregateId",
        e.owner_user_id::text as "ownerUserId",
        e.request_id::text as "requestId",
        e.correlation_id::text as "correlationId",
        e.causation_id::text as "causationId",
        e.status,
        e.attempts,
        e.available_at as "availableAt",
        e.locked_by as "lockedBy",
        e.locked_at as "lockedAt",
        e.published_at as "publishedAt",
        e.last_error as "lastError",
        e.created_at as "createdAt",
        e.updated_at as "updatedAt",
        latest_review.action as "reviewAction",
        latest_review.note as "reviewNote",
        latest_review.actor_user_id::text as "reviewActorUserId",
        actor.email as "reviewActorEmail",
        latest_review.created_at as "reviewCreatedAt"
      from outbox_events e
      left join lateral (
        select action, note, actor_user_id, created_at
        from ops_outbox_event_reviews
        where outbox_event_id = e.id
        order by created_at desc
        limit 1
      ) latest_review on true
      left join users actor on actor.id = latest_review.actor_user_id
      where true
        ${statusFilter}
        ${reviewFilter}
      order by e.updated_at desc, e.created_at desc
      limit ${input.limit}
    `.execute(this.db.executor);
    return result.rows.map(mapOutboxEventRow);
  }

  async reviewOutboxEvent(
    input: ReviewOutboxEventInput,
  ): Promise<OpsOutboxEvent | null> {
    return this.db.transaction(async (tx) => {
      const event = await this.findFailedOutboxEvent(tx, input.eventId);
      if (!event) {
        return null;
      }
      await this.insertReview(tx, {
        eventId: input.eventId,
        action: input.action,
        note: input.note ?? null,
        actorUserId: input.actorUserId,
      });
      return this.findOutboxEvent(tx, input.eventId);
    });
  }

  async replayOutboxEvent(
    input: ReplayOutboxEventInput,
  ): Promise<OpsOutboxEvent | null> {
    return this.db.transaction(async (tx) => {
      const updated = await sql<{ id: string }>`
        update outbox_events
        set
          status = 'pending',
          available_at = now(),
          locked_by = null,
          locked_at = null,
          last_error = null,
          updated_at = now()
        where id = ${input.eventId}::uuid
          and status = 'failed'
        returning id::text as "id"
      `.execute(tx);
      if (updated.rows.length === 0) {
        return null;
      }
      await this.insertReview(tx, {
        eventId: input.eventId,
        action: "replayed",
        note: input.note ?? null,
        actorUserId: input.actorUserId,
      });
      return this.findOutboxEvent(tx, input.eventId);
    });
  }

  private async findFailedOutboxEvent(
    db: DatabaseExecutor,
    eventId: string,
  ): Promise<OpsOutboxEvent | null> {
    const event = await this.findOutboxEvent(db, eventId);
    return event?.status === "failed" ? event : null;
  }

  private async findOutboxEvent(
    db: DatabaseExecutor,
    eventId: string,
  ): Promise<OpsOutboxEvent | null> {
    const result = await sql<OpsOutboxEventRow>`
      select
        e.id::text as "id",
        e.event_type as "eventType",
        e.aggregate_type as "aggregateType",
        e.aggregate_id as "aggregateId",
        e.owner_user_id::text as "ownerUserId",
        e.request_id::text as "requestId",
        e.correlation_id::text as "correlationId",
        e.causation_id::text as "causationId",
        e.status,
        e.attempts,
        e.available_at as "availableAt",
        e.locked_by as "lockedBy",
        e.locked_at as "lockedAt",
        e.published_at as "publishedAt",
        e.last_error as "lastError",
        e.created_at as "createdAt",
        e.updated_at as "updatedAt",
        latest_review.action as "reviewAction",
        latest_review.note as "reviewNote",
        latest_review.actor_user_id::text as "reviewActorUserId",
        actor.email as "reviewActorEmail",
        latest_review.created_at as "reviewCreatedAt"
      from outbox_events e
      left join lateral (
        select action, note, actor_user_id, created_at
        from ops_outbox_event_reviews
        where outbox_event_id = e.id
        order by created_at desc
        limit 1
      ) latest_review on true
      left join users actor on actor.id = latest_review.actor_user_id
      where e.id = ${eventId}::uuid
      limit 1
    `.execute(db);
    return result.rows[0] ? mapOutboxEventRow(result.rows[0]) : null;
  }

  private async insertReview(
    db: DatabaseExecutor,
    input: {
      eventId: string;
      action: OpsOutboxEventReviewAction;
      note: string | null;
      actorUserId: string;
    },
  ): Promise<void> {
    await sql`
      insert into ops_outbox_event_reviews (
        outbox_event_id,
        action,
        actor_user_id,
        note
      )
      values (
        ${input.eventId}::uuid,
        ${input.action},
        ${input.actorUserId}::uuid,
        ${input.note}
      )
    `.execute(db);
  }
}

function getStatusFilter(status: OpsOutboxEventStatus | "all") {
  if (status === "all") {
    return sql``;
  }
  return sql`and e.status = ${status}`;
}

function getReviewFilter(reviewState: string) {
  switch (reviewState) {
    case "unreviewed":
      return sql`and latest_review.action is null`;
    case "reviewed":
      return sql`and latest_review.action = 'reviewed'`;
    case "ignored":
      return sql`and latest_review.action = 'ignored'`;
    default:
      return sql``;
  }
}
