import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createInitialWorkbookCalculation,
  createRetryWorkbookCalculation,
  markWorkbookCalculationFailed,
  reconstituteWorkbookCalculation,
  userId,
  workbookCalculationId,
} from "./index.js";

const at = new Date("2026-06-21T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df073001");

describe("WorkbookCalculation", () => {
  it("rejects persisted attemptNumber zero", () => {
    assert.throws(
      () =>
        reconstituteWorkbookCalculation({
          ...storedCalculation(),
          attemptNumber: 0,
        }),
      /attemptNumber must be a positive integer/,
    );
  });

  it("creates retry replacement and preserves terminal original", () => {
    const initial = createInitialWorkbookCalculation(
      {
        correlationId: "generation-run-id",
        createdByUserId: ownerUserId,
        id: workbookCalculationId("019e9315-6a87-715f-9861-8654df073002"),
        ownerUserId,
        requestedCount: 2,
      },
      at,
    );
    const failed = markWorkbookCalculationFailed(initial, "failed", at);
    const retry = createRetryWorkbookCalculation(
      {
        createdByUserId: ownerUserId,
        id: workbookCalculationId("019e9315-6a87-715f-9861-8654df073003"),
        original: failed,
      },
      at,
    );

    assert.equal(retry.retryOfCalculationId, failed.id);
    assert.equal(retry.attemptNumber, 2);
    assert.equal(retry.correlationId, null);
    assert.equal(failed.status, "failed");
  });

  it("rejects retry of active calculation", () => {
    const active = createInitialWorkbookCalculation(
      {
        correlationId: null,
        createdByUserId: ownerUserId,
        id: workbookCalculationId("019e9315-6a87-715f-9861-8654df073002"),
        ownerUserId,
        requestedCount: 2,
      },
      at,
    );

    assert.throws(
      () =>
        createRetryWorkbookCalculation(
          {
            createdByUserId: ownerUserId,
            id: workbookCalculationId("019e9315-6a87-715f-9861-8654df073003"),
            original: active,
          },
          at,
        ),
      /Only failed or cancelled workbook calculations can be retried/,
    );
  });
});

function storedCalculation() {
  return {
    attemptNumber: 1,
    attempts: 0,
    correlationId: null,
    createdAt: at,
    createdByUserId: ownerUserId,
    errorMessage: null,
    finishedAt: null,
    id: "019e9315-6a87-715f-9861-8654df073002",
    ownerUserId,
    requestedCount: 1,
    retryOfCalculationId: null,
    startedAt: null,
    status: "queued",
    updatedAt: at,
  };
}
