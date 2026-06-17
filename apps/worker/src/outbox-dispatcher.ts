import { childOperationLineage, isUuidV7 } from "@lemma/domain";
import type { OutboxService } from "@lemma/events/application";
import { type OutboxEvent, outboxConsumerName } from "@lemma/events/domain";
import type { JobDispatcher } from "@lemma/jobs/application";
import type { NotificationProjector } from "@lemma/notifications/application";
import { withSpan } from "@lemma/observability/node";
import {
  QUESTION_GENERATION_RUN_CANCELLED_EVENT,
  QUESTION_GENERATION_RUN_FAILED_EVENT,
  QUESTION_GENERATION_RUN_MATERIALIZING_EVENT,
  QUESTION_GENERATION_RUN_REQUESTED_EVENT,
  QUESTION_GENERATION_RUN_SUCCEEDED_EVENT,
  QUESTION_GENERATION_RUN_WAITING_FOR_WORKBOOK_CALCULATION_EVENT,
  QUESTION_SET_QUESTIONS_ADDED_EVENT,
} from "@lemma/questions/domain";
import {
  WORKBOOK_CALCULATION_FAILED_EVENT,
  WORKBOOK_CALCULATION_REQUESTED_EVENT,
  WORKBOOK_CALCULATION_SUCCEEDED_EVENT,
  WORKBOOK_VALIDATION_FAILED_EVENT,
  WORKBOOK_VALIDATION_REQUESTED_EVENT,
  WORKBOOK_VALIDATION_SUCCEEDED_EVENT,
} from "@lemma/workbook/domain";
import {
  type EventConsumer,
  type EventConsumerResult,
  errorMessageFromUnknown,
  nextRetryAt,
  outboxEventSpanAttributes,
  runEventConsumer,
} from "./pipeline.js";
import { PollingLoop } from "./polling-loop.js";

const queueQuestionGenerationConsumer = outboxConsumerName(
  "queue-question-generation",
);
const queueWorkbookValidationConsumer = outboxConsumerName(
  "queue-workbook-validation",
);
const queueWorkbookCalculationConsumer = outboxConsumerName(
  "queue-workbook-calculation",
);
const publishRealtimeNotificationsConsumer = outboxConsumerName(
  "publish-realtime-notifications",
);
const questionGenerationRequestedEventTypes = [
  QUESTION_GENERATION_RUN_REQUESTED_EVENT,
] as const;
const workbookValidationRequestedEventTypes = [
  WORKBOOK_VALIDATION_REQUESTED_EVENT,
] as const;
const workbookCalculationRequestedEventTypes = [
  WORKBOOK_CALCULATION_REQUESTED_EVENT,
] as const;
const workbookCalculationResultEventTypes = [
  WORKBOOK_CALCULATION_SUCCEEDED_EVENT,
  WORKBOOK_CALCULATION_FAILED_EVENT,
] as const;
const realtimeNotificationEventTypes = [
  QUESTION_GENERATION_RUN_REQUESTED_EVENT,
  QUESTION_GENERATION_RUN_WAITING_FOR_WORKBOOK_CALCULATION_EVENT,
  QUESTION_GENERATION_RUN_MATERIALIZING_EVENT,
  QUESTION_GENERATION_RUN_SUCCEEDED_EVENT,
  QUESTION_GENERATION_RUN_CANCELLED_EVENT,
  QUESTION_GENERATION_RUN_FAILED_EVENT,
  QUESTION_SET_QUESTIONS_ADDED_EVENT,
] as const;
const publishedOnlyEventTypes = [
  WORKBOOK_VALIDATION_SUCCEEDED_EVENT,
  WORKBOOK_VALIDATION_FAILED_EVENT,
] as const;

export type OutboxPollingDispatcherConfig = {
  workerId: string;
  batchSize: number;
  pollIntervalMs: number;
  lockTimeoutMs: number;
  retryDelayMs: number;
  maxAttempts: number;
  queueRetryLimit: number;
  queueRetryDelaySeconds: number;
};

export class OutboxPollingDispatcher {
  private readonly eventConsumers: readonly EventConsumer[];
  private readonly pollingLoop: PollingLoop;

  constructor(
    private readonly deps: {
      outboxService: OutboxService;
      jobDispatcher: JobDispatcher;
      notificationProjector: NotificationProjector;
      clock: { now(): Date };
      config: OutboxPollingDispatcherConfig;
    },
  ) {
    this.pollingLoop = new PollingLoop({
      name: "outbox-dispatcher",
      intervalMs: deps.config.pollIntervalMs,
      task: () => this.runPollingTask(),
    });
    this.eventConsumers = [
      {
        name: queueQuestionGenerationConsumer,
        eventTypes: questionGenerationRequestedEventTypes,
        handle: (event) => this.dispatchQuestionGenerationQueueEvent(event),
      },
      {
        name: queueWorkbookValidationConsumer,
        eventTypes: workbookValidationRequestedEventTypes,
        handle: (event) => this.dispatchWorkbookValidationQueueEvent(event),
      },
      {
        name: queueWorkbookCalculationConsumer,
        eventTypes: workbookCalculationRequestedEventTypes,
        handle: (event) => this.dispatchWorkbookCalculationQueueEvent(event),
      },
      {
        name: queueQuestionGenerationConsumer,
        eventTypes: workbookCalculationResultEventTypes,
        handle: (event) =>
          this.dispatchQuestionGenerationWorkbookResultEvent(event),
      },
      {
        name: publishRealtimeNotificationsConsumer,
        eventTypes: realtimeNotificationEventTypes,
        handle: (event) => this.publishRealtimeNotifications(event),
      },
    ];
  }

  start(): void {
    this.pollingLoop.start();
  }

  stop(): void {
    this.pollingLoop.stop();
  }

  async runOnce(): Promise<number> {
    const now = this.deps.clock.now();
    const staleBefore = new Date(
      now.getTime() - this.deps.config.lockTimeoutMs,
    );
    const events = await this.deps.outboxService.claimPendingEvents({
      eventTypes: this.dispatchableEventTypes(),
      limit: this.deps.config.batchSize,
      lockedBy: this.deps.config.workerId,
      staleBefore,
    });

    for (const event of events) {
      await withSpan(
        "outbox.dispatch_event",
        outboxEventSpanAttributes(event),
        () => this.dispatchEvent(event),
      );
    }

    return events.length;
  }

  private async runPollingTask() {
    const dispatchedCount = await this.runOnce();
    return {
      attributes: {
        "outbox.dispatch.claimed_count": dispatchedCount,
      },
    };
  }

  private async dispatchEvent(event: OutboxEvent): Promise<void> {
    try {
      for (const consumer of this.eventConsumers) {
        await runEventConsumer({
          event,
          consumer,
          idempotencyStore: this.deps.outboxService,
        });
      }
      await this.deps.outboxService.markEventPublished(event.id);
    } catch (error) {
      await this.markFailed(event, error);
    }
  }

  private async dispatchQuestionGenerationQueueEvent(
    event: OutboxEvent,
  ): Promise<EventConsumerResult> {
    const questionGenerationRunId = getQuestionGenerationRunIdFromEvent(event);
    await this.deps.jobDispatcher.enqueueQuestionGenerationOrchestration({
      jobId: event.id,
      questionGenerationRunId,
      lineage: childOperationLineage(event.lineage, event.id),
      retryLimit: this.deps.config.queueRetryLimit,
      retryDelaySeconds: this.deps.config.queueRetryDelaySeconds,
    });
    return { status: "processed" };
  }

  private async dispatchWorkbookValidationQueueEvent(
    event: OutboxEvent,
  ): Promise<EventConsumerResult> {
    const workbookId = getWorkbookIdFromEvent(event);
    await this.deps.jobDispatcher.enqueueWorkbookValidation({
      jobId: event.id,
      workbookId,
      lineage: childOperationLineage(event.lineage, event.id),
      retryLimit: this.deps.config.queueRetryLimit,
      retryDelaySeconds: this.deps.config.queueRetryDelaySeconds,
    });
    return { status: "processed" };
  }

  private async dispatchWorkbookCalculationQueueEvent(
    event: OutboxEvent,
  ): Promise<EventConsumerResult> {
    const workbookCalculationId = getWorkbookCalculationIdFromEvent(event);
    await this.deps.jobDispatcher.enqueueWorkbookCalculation({
      jobId: event.id,
      workbookCalculationId,
      lineage: childOperationLineage(event.lineage, event.id),
      retryLimit: this.deps.config.queueRetryLimit,
      retryDelaySeconds: this.deps.config.queueRetryDelaySeconds,
    });
    return { status: "processed" };
  }

  private async dispatchQuestionGenerationWorkbookResultEvent(
    event: OutboxEvent,
  ): Promise<EventConsumerResult> {
    const result = getWorkbookCalculationResultFromEvent(event);
    if (!result.questionGenerationRunId) {
      return { status: "processed" };
    }

    await this.deps.jobDispatcher.enqueueQuestionGenerationOrchestration({
      jobId: event.id,
      questionGenerationRunId: result.questionGenerationRunId,
      workbookCalculationId: result.workbookCalculationId,
      workbookSnapshotIds: result.snapshotIds,
      workbookCalculationErrorMessage: result.errorMessage,
      lineage: childOperationLineage(event.lineage, event.id),
      retryLimit: this.deps.config.queueRetryLimit,
      retryDelaySeconds: this.deps.config.queueRetryDelaySeconds,
    });
    return { status: "processed" };
  }

  private async publishRealtimeNotifications(
    event: OutboxEvent,
  ): Promise<EventConsumerResult> {
    if (this.deps.notificationProjector.projectEvent(event).length === 0) {
      return { status: "skipped", reason: "no_publications" };
    }

    await this.deps.notificationProjector.publishOutboxEvent(event);
    return { status: "processed" };
  }

  private async markFailed(event: OutboxEvent, error: unknown): Promise<void> {
    const now = this.deps.clock.now();
    await this.deps.outboxService.markEventFailed({
      eventId: event.id,
      errorMessage: errorMessageFromUnknown(error, "Outbox dispatch failed."),
      retryAt: nextRetryAt({
        attempts: event.attempts,
        failedAt: now,
        policy: {
          maxAttempts: this.deps.config.maxAttempts,
          retryDelayMs: this.deps.config.retryDelayMs,
        },
      }),
    });
  }

  private dispatchableEventTypes(): string[] {
    return [
      ...new Set([
        ...this.eventConsumers.flatMap((item) => item.eventTypes),
        ...publishedOnlyEventTypes,
      ]),
    ];
  }
}

function getQuestionGenerationRunIdFromEvent(event: OutboxEvent): string {
  if (event.eventType !== QUESTION_GENERATION_RUN_REQUESTED_EVENT) {
    throw new Error(`Unsupported outbox event type: ${event.eventType}`);
  }
  const value = event.payload.questionGenerationRunId;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      "question_generation.run_requested.v1 payload is missing questionGenerationRunId.",
    );
  }
  return value;
}

function getWorkbookIdFromEvent(event: OutboxEvent): string {
  if (event.eventType !== WORKBOOK_VALIDATION_REQUESTED_EVENT) {
    throw new Error(`Unsupported outbox event type: ${event.eventType}`);
  }
  const value = event.payload.workbookId;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      "workbook.validation_requested.v1 payload is missing workbookId.",
    );
  }
  return value;
}

function getWorkbookCalculationIdFromEvent(event: OutboxEvent): string {
  if (event.eventType !== WORKBOOK_CALCULATION_REQUESTED_EVENT) {
    throw new Error(`Unsupported outbox event type: ${event.eventType}`);
  }
  const value = event.payload.workbookCalculationId;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      "workbook_calculation.requested.v1 payload is missing workbookCalculationId.",
    );
  }
  return value;
}

function getWorkbookCalculationResultFromEvent(event: OutboxEvent): {
  questionGenerationRunId: string | null;
  workbookCalculationId: string;
  snapshotIds: string[];
  errorMessage: string | null;
} {
  if (
    event.eventType !== WORKBOOK_CALCULATION_SUCCEEDED_EVENT &&
    event.eventType !== WORKBOOK_CALCULATION_FAILED_EVENT
  ) {
    throw new Error(`Unsupported outbox event type: ${event.eventType}`);
  }
  const correlationId = event.payload.correlationId;
  const workbookCalculationId = event.payload.workbookCalculationId;
  const snapshotIds = event.payload.snapshotIds;
  const errorMessage = event.payload.errorMessage;
  if (
    typeof workbookCalculationId !== "string" ||
    workbookCalculationId.length === 0
  ) {
    throw new Error(
      "workbook_calculation finished payload is missing workbookCalculationId.",
    );
  }
  if (!Array.isArray(snapshotIds)) {
    throw new Error(
      "workbook_calculation finished payload is missing snapshotIds.",
    );
  }
  return {
    questionGenerationRunId:
      typeof correlationId === "string" && isUuidV7(correlationId)
        ? correlationId
        : null,
    workbookCalculationId,
    snapshotIds: snapshotIds.filter(
      (snapshotId): snapshotId is string => typeof snapshotId === "string",
    ),
    errorMessage:
      event.eventType === WORKBOOK_CALCULATION_FAILED_EVENT
        ? typeof errorMessage === "string" && errorMessage.trim().length > 0
          ? errorMessage
          : "Workbook calculation failed."
        : null,
  };
}
