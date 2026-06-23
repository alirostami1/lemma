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
  causationId: null,
  correlationId: "019e9315-6a87-715f-9861-8654df070e04",
  requestId: "019e9315-6a87-715f-9861-8654df070e04",
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
      aggregate: {
        id: runId,
        type: "question_generation_run",
      },
      id: "019e9315-6a87-715f-9861-8654df070e03",
      lineage,
      occurredAt: at,
      ownerUserId,
      payload: { questionGenerationRunId: runId, questionIds: [] },
      schemaVersion: 1,
      type: QUESTION_GENERATION_RUN_SUCCEEDED_EVENT,
    }),
  );
}

function createWorkbookCalculationOutboxEvent(): OutboxEvent {
  return outboxEventFromEnvelope(
    domainEventEnvelope({
      aggregate: {
        id: workbookCalculationId,
        type: "workbook_calculation",
      },
      id: "019e9315-6a87-715f-9861-8654df070e06",
      lineage,
      occurredAt: at,
      ownerUserId,
      payload: {
        correlationId: null,
        errorMessage: null,
        requestedCount: 1,
        snapshotIds: [],
        status: "succeeded",
        workbookCalculationId,
        workbookId: "019e9315-6a87-715f-9861-8654df070e07",
      },
      schemaVersion: 1,
      type: "workbook_calculation.succeeded.v2",
    }),
  );
}
