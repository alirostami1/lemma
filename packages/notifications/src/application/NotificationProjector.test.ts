import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OutboxEvent } from "@lemma/events/domain";
import {
  domainEventEnvelope,
  outboxEventFromEnvelope,
} from "@lemma/events/domain";
import { QUESTION_GENERATION_RUN_SUCCEEDED_EVENT } from "@lemma/questions/domain";
import {
  questionGenerationRunNotificationChannel,
  userNotificationChannel,
  workbookCalculationNotificationChannel,
} from "../domain/index.js";
import { NotificationProjector } from "./NotificationProjector.js";

const at = new Date("2026-01-01T00:00:00.000Z");
const ownerUserId = "019e9315-6a87-715f-9861-8654df070e01";
const runId = "019e9315-6a87-715f-9861-8654df070e02";
const workbookCalculationId = "019e9315-6a87-715f-9861-8654df070e05";
const lineage = {
  requestId: "019e9315-6a87-715f-9861-8654df070e04",
  correlationId: "019e9315-6a87-715f-9861-8654df070e04",
  causationId: null,
};

describe("NotificationProjector", () => {
  it("projects question generation events to user and run channels", async () => {
    const publications: { channel: string }[] = [];
    const projector = new NotificationProjector({
      realtimePublisher: {
        async publish(input) {
          publications.push({ channel: input.channel });
        },
      },
    });

    const count = await projector.publishOutboxEvent(createOutboxEvent());

    assert.equal(count, 2);
    assert.deepEqual(
      publications.map((publication) => publication.channel),
      [
        userNotificationChannel(ownerUserId),
        questionGenerationRunNotificationChannel(runId),
      ],
    );
  });

  it("projects workbook calculation events to user and calculation channels", async () => {
    const publications: { channel: string }[] = [];
    const projector = new NotificationProjector({
      realtimePublisher: {
        async publish(input) {
          publications.push({ channel: input.channel });
        },
      },
    });

    const count = await projector.publishOutboxEvent(
      createWorkbookCalculationOutboxEvent(),
    );

    assert.equal(count, 2);
    assert.deepEqual(
      publications.map((publication) => publication.channel),
      [
        userNotificationChannel(ownerUserId),
        workbookCalculationNotificationChannel(workbookCalculationId),
      ],
    );
  });
});

function createOutboxEvent(): OutboxEvent {
  return outboxEventFromEnvelope(
    domainEventEnvelope({
      id: "019e9315-6a87-715f-9861-8654df070e03",
      type: QUESTION_GENERATION_RUN_SUCCEEDED_EVENT,
      schemaVersion: 1,
      aggregate: {
        type: "question_generation_run",
        id: runId,
      },
      ownerUserId,
      lineage,
      occurredAt: at,
      payload: { questionGenerationRunId: runId, questionIds: [] },
    }),
  );
}

function createWorkbookCalculationOutboxEvent(): OutboxEvent {
  return outboxEventFromEnvelope(
    domainEventEnvelope({
      id: "019e9315-6a87-715f-9861-8654df070e06",
      type: "workbook_calculation.succeeded.v1",
      schemaVersion: 1,
      aggregate: {
        type: "workbook_calculation",
        id: workbookCalculationId,
      },
      ownerUserId,
      lineage,
      occurredAt: at,
      payload: {
        workbookCalculationId,
        workbookId: "019e9315-6a87-715f-9861-8654df070e07",
        correlationId: null,
        status: "succeeded",
        requestedCount: 1,
        snapshotIds: [],
        errorMessage: null,
      },
    }),
  );
}
