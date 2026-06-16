import type { OutboxEvent } from "@lemma/events/domain";
import { instrumentService } from "@lemma/observability";
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
  questionGenerationRunNotificationChannel,
  questionSetNotificationChannel,
  type RealtimeNotificationMessage,
  userNotificationChannel,
  workbookCalculationNotificationChannel,
} from "../domain/index.js";
import type { RealtimePublisherPort } from "./ports.js";

const instrumentation = instrumentService("notifications", "projector");

const questionGenerationEventTypes = new Set<string>([
  QUESTION_GENERATION_RUN_REQUESTED_EVENT,
  QUESTION_GENERATION_RUN_WAITING_FOR_WORKBOOK_CALCULATION_EVENT,
  QUESTION_GENERATION_RUN_MATERIALIZING_EVENT,
  QUESTION_GENERATION_RUN_SUCCEEDED_EVENT,
  QUESTION_GENERATION_RUN_CANCELLED_EVENT,
  QUESTION_GENERATION_RUN_FAILED_EVENT,
]);

export class NotificationProjector {
  constructor(
    private readonly deps: {
      realtimePublisher: RealtimePublisherPort;
    },
  ) {}

  projectEvent(event: OutboxEvent): {
    channel: string;
    data: RealtimeNotificationMessage;
    idempotencyKey: string;
  }[] {
    const channels = this.channelsForEvent(event);
    if (channels.length === 0) {
      return [];
    }
    const data = this.messageForEvent(event);
    return channels.map((channel) => ({
      channel,
      data,
      idempotencyKey: `${event.id}:${channel}`,
    }));
  }

  async publishOutboxEvent(event: OutboxEvent): Promise<number> {
    return instrumentation.run(
      "publish_outbox_event",
      { lineage: event.lineage },
      async () => {
        const publications = this.projectEvent(event);
        for (const publication of publications) {
          await this.deps.realtimePublisher.publish(publication);
        }
        return publications.length;
      },
    );
  }

  private channelsForEvent(event: OutboxEvent): string[] {
    const channels = new Set<string>();
    if (event.ownerUserId) {
      channels.add(userNotificationChannel(event.ownerUserId));
    }
    if (questionGenerationEventTypes.has(event.eventType)) {
      channels.add(questionGenerationRunNotificationChannel(event.aggregateId));
    }
    if (event.eventType === QUESTION_SET_QUESTIONS_ADDED_EVENT) {
      channels.add(questionSetNotificationChannel(event.aggregateId));
    }
    if (event.aggregateType === "workbook_calculation") {
      channels.add(workbookCalculationNotificationChannel(event.aggregateId));
    }
    return [...channels];
  }

  private messageForEvent(event: OutboxEvent): RealtimeNotificationMessage {
    return {
      schemaVersion: 1,
      eventId: event.id,
      eventType: event.eventType,
      lineage: event.lineage,
      aggregate: {
        type: event.aggregateType,
        id: event.aggregateId,
      },
      payload: event.payload,
      occurredAt: event.createdAt.toISOString(),
    };
  }
}
