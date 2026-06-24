import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { domainEventEnvelope } from "./event-envelope.js";

const lineage = {
  causationId: null,
  correlationId: "019e9315-6a87-715f-9861-8654df070c82",
  requestId: "019e9315-6a87-715f-9861-8654df070c82",
};

describe("domainEventEnvelope", () => {
  it("normalizes typed event envelope values", () => {
    const occurredAt = new Date("2026-06-14T00:00:00.000Z");
    const event = domainEventEnvelope({
      aggregate: {
        id: "019e9315-6a87-715f-9861-8654df070c81",
        type: "question_generation_run",
      },
      id: "019e9315-6a87-715f-9861-8654df070c80",
      lineage,
      occurredAt,
      payload: {
        questionGenerationRunId: "019e9315-6a87-715f-9861-8654df070c81",
      },
      schemaVersion: 1,
      type: "question_generation.run_requested.v1",
    });

    assert.equal(event.id, "019e9315-6a87-715f-9861-8654df070c80");
    assert.equal(event.type, "question_generation.run_requested.v1");
    assert.equal(event.schemaVersion, 1);
    assert.equal(event.ownerUserId, null);
    assert.equal(event.occurredAt, occurredAt);
  });

  it("rejects invalid event identifiers and payload shapes", () => {
    assert.throws(
      () =>
        domainEventEnvelope({
          aggregate: {
            id: "019e9315-6a87-715f-9861-8654df070c81",
            type: "question_generation_run",
          },
          id: "not-a-uuid",
          lineage,
          occurredAt: new Date("2026-06-14T00:00:00.000Z"),
          payload: {},
          schemaVersion: 1,
          type: "question_generation.run_requested.v1",
        }),
      /eventId must be a valid UUIDv7/,
    );

    assert.throws(
      () =>
        domainEventEnvelope({
          aggregate: {
            id: "019e9315-6a87-715f-9861-8654df070c81",
            type: "question_generation_run",
          },
          id: "019e9315-6a87-715f-9861-8654df070c80",
          lineage,
          occurredAt: new Date("2026-06-14T00:00:00.000Z"),
          payload: [] as never,
          schemaVersion: 1,
          type: "question_generation.run_requested.v1",
        }),
      /payload must be a JSON object/,
    );
  });
});
