import type { JsonObject } from "@lemma/domain";
import type { OutboxConsumerName, OutboxEvent } from "@lemma/events/domain";
import type {
  JobQueuePort,
  QueueJob,
  QueueWorkerRegistration,
} from "@lemma/jobs/application";
import {
  type OperationLineageLike,
  spanAttributesFromLineage,
  withSpan,
} from "@lemma/observability/node";

export type PipelineSpanAttributes = Record<string, string | number | boolean>;

export type EventConsumerResult =
  | { status: "processed" }
  | { status: "skipped"; reason?: string };

export type EventConsumer = {
  name: OutboxConsumerName;
  eventTypes: readonly string[];
  handle(event: OutboxEvent): Promise<EventConsumerResult>;
};

export type IdempotencyStore = {
  hasProcessedEvent(input: {
    eventId: OutboxEvent["id"];
    consumer: OutboxConsumerName;
  }): Promise<boolean>;
  recordProcessedEvent(input: {
    eventId: OutboxEvent["id"];
    consumer: OutboxConsumerName;
  }): Promise<unknown>;
};

export type EventConsumerRunResult =
  | EventConsumerResult
  | { status: "not_applicable" }
  | { status: "already_processed" };

export type JobConsumer<TData extends JsonObject> = {
  name: string;
  spanName: string;
  batchSize?: number;
  concurrency?: number;
  parse(data: TData): TData;
  attributes(job: QueueJob<TData>): PipelineSpanAttributes;
  handle(job: QueueJob<TData>): Promise<unknown>;
};

export type WorkflowJobDefinition<TData extends JsonObject> = {
  workflowName: string;
  stepName: string;
  jobName: string;
  batchSize?: number;
  concurrency?: number;
  parsePayload(data: TData): TData;
  lineage(data: TData): OperationLineageLike | null;
  attributes?(job: QueueJob<TData>): PipelineSpanAttributes;
  run(job: QueueJob<TData>): Promise<unknown>;
};

export type RetryPolicy = {
  maxAttempts: number;
  retryDelayMs: number;
};

export type ReconciliationOutcome<TResult extends string> = {
  result: TResult;
  resourceId: string | null;
  errorMessage: string | null;
};

export type ReconciliationPolicy<TJob, TResult extends string> = {
  jobNames: readonly string[];
  reconcile(job: TJob): Promise<ReconciliationOutcome<TResult>>;
  recordFailure(job: TJob, error: unknown): Promise<void>;
};

export async function runEventConsumer(input: {
  event: OutboxEvent;
  consumer: EventConsumer;
  idempotencyStore: IdempotencyStore;
}): Promise<EventConsumerRunResult> {
  if (!input.consumer.eventTypes.includes(input.event.eventType)) {
    return { status: "not_applicable" };
  }
  if (
    await input.idempotencyStore.hasProcessedEvent({
      consumer: input.consumer.name,
      eventId: input.event.id,
    })
  ) {
    return { status: "already_processed" };
  }

  const result = await input.consumer.handle(input.event);
  if (result.status === "processed") {
    await input.idempotencyStore.recordProcessedEvent({
      consumer: input.consumer.name,
      eventId: input.event.id,
    });
  }
  return result;
}

export function registerJobConsumer<TData extends JsonObject>(input: {
  jobQueue: JobQueuePort;
  consumer: JobConsumer<TData>;
  concurrency?: number;
}): Promise<QueueWorkerRegistration> {
  return input.jobQueue.registerHandler<TData>({
    batchSize: input.consumer.batchSize ?? 1,
    concurrency: input.consumer.concurrency ?? input.concurrency ?? 1,
    handler: async (jobs) => {
      for (const job of jobs) {
        const data = input.consumer.parse(job.data);
        const parsedJob = { ...job, data };
        await withSpan(
          input.consumer.spanName,
          {
            "job.id": parsedJob.id,
            "job.name": parsedJob.name,
            ...jobDataLineageSpanAttributes(parsedJob.data),
            ...input.consumer.attributes(parsedJob),
          },
          () => input.consumer.handle(parsedJob),
        );
      }
    },
    name: input.consumer.name,
  });
}

export function workflowJobConsumer<TData extends JsonObject>(
  definition: WorkflowJobDefinition<TData>,
): JobConsumer<TData> {
  return {
    attributes: (job) => ({
      "workflow.name": definition.workflowName,
      "workflow.step": definition.stepName,
      ...(spanAttributesFromLineage(
        definition.lineage(job.data),
      ) as PipelineSpanAttributes),
      ...(definition.attributes?.(job) ?? {}),
    }),
    batchSize: definition.batchSize,
    concurrency: definition.concurrency,
    handle: definition.run,
    name: definition.jobName,
    parse: definition.parsePayload,
    spanName: `${definition.workflowName}.${definition.stepName}_job`,
  };
}

export function outboxEventSpanAttributes(
  event: OutboxEvent,
): PipelineSpanAttributes {
  return {
    "outbox.aggregate_id": event.aggregateId,
    "outbox.aggregate_type": event.aggregateType,
    "outbox.attempts": event.attempts,
    "outbox.event_id": event.id,
    "outbox.event_type": event.eventType,
    ...spanAttributesFromLineage(event.lineage),
  } as PipelineSpanAttributes;
}

export function nextRetryAt(input: {
  attempts: number;
  failedAt: Date;
  policy: RetryPolicy;
}): Date | undefined {
  return input.attempts >= input.policy.maxAttempts
    ? undefined
    : new Date(input.failedAt.getTime() + input.policy.retryDelayMs);
}

export function errorMessageFromUnknown(
  error: unknown,
  fallback: string,
): string {
  return error instanceof Error ? error.message : fallback;
}

export function jobDataLineageSpanAttributes(
  data: unknown,
): PipelineSpanAttributes {
  if (typeof data !== "object" || data === null) {
    return {};
  }
  const lineage = (data as Record<string, unknown>).lineage;
  if (!isOperationLineageLike(lineage)) {
    return {};
  }
  return spanAttributesFromLineage(lineage) as PipelineSpanAttributes;
}

function isOperationLineageLike(value: unknown): value is OperationLineageLike {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.requestId === "string" &&
    typeof record.correlationId === "string" &&
    (record.causationId === undefined ||
      record.causationId === null ||
      typeof record.causationId === "string")
  );
}
