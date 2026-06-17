import type { JsonObject } from "@lemma/domain";
import { instrumentExternal } from "@lemma/observability";
import { type Selectable, sql } from "kysely";
import type {
  ClaimPendingEventsInput,
  DeletePublishedEventsBeforeInput,
  ListFailedEventsInput,
  MarkEventFailedInput,
  MarkEventPublishedInput,
  OutboxRepository,
  RecordProcessedEventInput,
} from "../application/index.js";
import {
  aggregateId,
  aggregateType,
  assertOutboxEventAttempts,
  assertOutboxEventDate,
  type DomainEventEnvelope,
  type EventId,
  eventId,
  eventType,
  type OutboxConsumerName,
  type OutboxEvent,
  outboxConsumerName,
  outboxEventStatus,
} from "../domain/index.js";
import type {
  OutboxDatabaseExecutor,
  OutboxEventsTable,
} from "./outbox-database.js";

const instrumentation = instrumentExternal("events", "outbox_repository");

export class KyselyOutboxRepository implements OutboxRepository {
  constructor(private readonly db: OutboxDatabaseExecutor) {}

  async appendEvents(events: readonly DomainEventEnvelope[]): Promise<void> {
    return this.dbOperation("append_events", async () => {
      if (events.length === 0) {
        return;
      }
      await this.db
        .insertInto("outboxEvents")
        .values(events.map(mapEventEnvelopeToInsert))
        .execute();
    });
  }

  async claimPendingEvents(
    input: ClaimPendingEventsInput,
  ): Promise<OutboxEvent[]> {
    return this.dbOperation("claim_pending_events", async () => {
      if (input.limit <= 0 || input.eventTypes.length === 0) {
        return [];
      }

      const staleFilter = input.staleBefore
        ? sql`
          or (
            status = 'publishing'
            and locked_at is not null
            and locked_at <= ${input.staleBefore}
          )
        `
        : sql``;

      const result = await sql<Selectable<OutboxEventsTable>>`
        with next_events as (
          select id
          from outbox_events
          where (
            (
              status = 'pending'
              and available_at <= ${input.lockedAt}
            )
            ${staleFilter}
          )
            and event_type in (${sql.join(input.eventTypes)})
          order by available_at asc, created_at asc
          limit ${input.limit}
          for update skip locked
        )
        update outbox_events
        set status = 'publishing',
          attempts = attempts + 1,
          locked_by = ${input.lockedBy},
          locked_at = ${input.lockedAt},
          last_error = null,
          updated_at = ${input.lockedAt}
        from next_events
        where outbox_events.id = next_events.id
        returning
          outbox_events.id,
          outbox_events.event_type as "eventType",
          outbox_events.schema_version as "schemaVersion",
          outbox_events.aggregate_type as "aggregateType",
          outbox_events.aggregate_id as "aggregateId",
          outbox_events.owner_user_id as "ownerUserId",
          outbox_events.request_id as "requestId",
          outbox_events.correlation_id as "correlationId",
          outbox_events.causation_id as "causationId",
          outbox_events.payload,
          outbox_events.status,
          outbox_events.available_at as "availableAt",
          outbox_events.attempts,
          outbox_events.locked_by as "lockedBy",
          outbox_events.locked_at as "lockedAt",
          outbox_events.published_at as "publishedAt",
          outbox_events.last_error as "lastError",
          outbox_events.created_at as "createdAt",
          outbox_events.updated_at as "updatedAt"
      `.execute(this.db);

      return result.rows.map(mapOutboxEventRowToDomain);
    });
  }

  async markEventPublished(input: MarkEventPublishedInput): Promise<void> {
    await this.dbOperation("mark_event_published", () =>
      this.db
        .updateTable("outboxEvents")
        .set({
          status: "published",
          publishedAt: input.publishedAt,
          lockedBy: null,
          lockedAt: null,
          lastError: null,
          updatedAt: input.publishedAt,
        })
        .where("id", "=", input.eventId)
        .execute()
        .then(() => undefined),
    );
  }

  async markEventFailed(input: MarkEventFailedInput): Promise<void> {
    await this.dbOperation("mark_event_failed", async () => {
      const nextAvailableAt = input.retryAt ?? input.failedAt;
      await this.db
        .updateTable("outboxEvents")
        .set({
          status: input.retryAt ? "pending" : "failed",
          availableAt: nextAvailableAt,
          lockedBy: null,
          lockedAt: null,
          lastError: input.errorMessage,
          updatedAt: input.failedAt,
        })
        .where("id", "=", input.eventId)
        .execute();
    });
  }

  async findEventById(id: EventId): Promise<OutboxEvent | null> {
    return this.dbOperation("find_event_by_id", async () => {
      const row = await this.db
        .selectFrom("outboxEvents")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ? mapOutboxEventRowToDomain(row) : null;
    });
  }

  async listFailedEvents(input: ListFailedEventsInput): Promise<OutboxEvent[]> {
    return this.dbOperation("list_failed_events", async () => {
      if (input.limit <= 0) {
        return [];
      }

      const baseQuery = this.db
        .selectFrom("outboxEvents")
        .selectAll()
        .where("status", "=", "failed");
      const rows = await (input.cursor
        ? baseQuery.where("updatedAt", "<", input.cursor)
        : baseQuery
      )
        .orderBy("updatedAt", "desc")
        .orderBy("createdAt", "desc")
        .limit(input.limit)
        .execute();
      return rows.map(mapOutboxEventRowToDomain);
    });
  }

  async deletePublishedEventsBefore(
    input: DeletePublishedEventsBeforeInput,
  ): Promise<number> {
    return this.dbOperation("delete_published_events_before", async () => {
      if (input.limit <= 0) {
        return 0;
      }

      const result = await sql<{ deletedCount: number }>`
        with deleted as (
          delete from outbox_events
          where id in (
            select id
            from outbox_events
            where status = 'published'
              and published_at is not null
              and published_at < ${input.publishedBefore}
            order by published_at asc, created_at asc
            limit ${input.limit}
          )
          returning id
        )
        select count(*)::int as "deletedCount" from deleted
      `.execute(this.db);
      return Number(result.rows[0]?.deletedCount ?? 0);
    });
  }

  async hasProcessedEvent(input: {
    eventId: EventId;
    consumer: OutboxConsumerName;
  }): Promise<boolean> {
    return this.dbOperation("has_processed_event", async () => {
      const row = await this.db
        .selectFrom("processedEvents")
        .select("eventId")
        .where("eventId", "=", input.eventId)
        .where("consumer", "=", input.consumer)
        .executeTakeFirst();
      return Boolean(row);
    });
  }

  async recordProcessedEvent(
    input: RecordProcessedEventInput,
  ): Promise<boolean> {
    return this.dbOperation("record_processed_event", async () => {
      const row = await this.db
        .insertInto("processedEvents")
        .values({
          eventId: input.eventId,
          consumer: input.consumer,
          processedAt: input.processedAt,
        })
        .onConflict((oc) => oc.columns(["eventId", "consumer"]).doNothing())
        .returning("eventId")
        .executeTakeFirst();
      return Boolean(row);
    });
  }

  private async dbOperation<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return instrumentation.run(
      operation,
      {
        attributes: { "db.system": "postgresql" },
      },
      fn,
    );
  }
}

function mapEventEnvelopeToInsert(event: DomainEventEnvelope) {
  return {
    id: event.id,
    eventType: event.type,
    schemaVersion: event.schemaVersion,
    aggregateType: event.aggregate.type,
    aggregateId: event.aggregate.id,
    ownerUserId: event.ownerUserId ?? null,
    requestId: event.lineage.requestId,
    correlationId: event.lineage.correlationId,
    causationId: event.lineage.causationId,
    payload: event.payload,
    status: "pending",
    availableAt: event.occurredAt,
    attempts: 0,
    lockedBy: null,
    lockedAt: null,
    publishedAt: null,
    lastError: null,
    createdAt: event.occurredAt,
    updatedAt: event.occurredAt,
  };
}

function mapOutboxEventRowToDomain(
  row: Selectable<OutboxEventsTable>,
): OutboxEvent {
  return {
    id: eventId(row.id),
    eventType: eventType(row.eventType),
    schemaVersion: row.schemaVersion,
    aggregateType: aggregateType(row.aggregateType),
    aggregateId: aggregateId(row.aggregateId),
    ownerUserId: row.ownerUserId,
    lineage: {
      requestId: row.requestId,
      correlationId: row.correlationId,
      causationId: row.causationId,
    },
    payload: row.payload as JsonObject,
    status: outboxEventStatus(row.status),
    availableAt: assertOutboxEventDate(row.availableAt, "availableAt"),
    attempts: assertOutboxEventAttempts(row.attempts),
    lockedBy: row.lockedBy,
    lockedAt: row.lockedAt
      ? assertOutboxEventDate(row.lockedAt, "lockedAt")
      : null,
    publishedAt: row.publishedAt
      ? assertOutboxEventDate(row.publishedAt, "publishedAt")
      : null,
    lastError: row.lastError,
    createdAt: assertOutboxEventDate(row.createdAt, "createdAt"),
    updatedAt: assertOutboxEventDate(row.updatedAt, "updatedAt"),
  };
}

export function processedEventConsumer(value: unknown): OutboxConsumerName {
  return outboxConsumerName(value);
}
