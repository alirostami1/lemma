import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createInitialQuestionGenerationRun,
  createQuestionBlueprintSnapshot,
  createRetryQuestionGenerationRun,
  markQuestionGenerationRunFailed,
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintVersionId,
  questionGenerationRunId,
  questionSetId,
  reconstituteQuestionGenerationRun,
  userId,
} from "./index.js";

const at = new Date("2026-06-21T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df072001");
const blueprintId = questionBlueprintId("019e9315-6a87-715f-9861-8654df072002");
const blueprintVersionId = questionBlueprintVersionId(
  "019e9315-6a87-715f-9861-8654df072006",
);
const targetQuestionSetId = questionSetId(
  "019e9315-6a87-715f-9861-8654df072003",
);

describe("QuestionGenerationRun", () => {
  it("rejects persisted attemptNumber zero", () => {
    assert.throws(
      () =>
        reconstituteQuestionGenerationRun({
          ...storedRun(),
          attemptNumber: 0,
        }),
      /attemptNumber must be a positive integer/,
    );
  });

  it("rejects invalid persisted workbookCalculationId", () => {
    assert.throws(
      () =>
        reconstituteQuestionGenerationRun({
          ...storedRun(),
          workbookCalculationId: "invalid",
        }),
      /workbookCalculationId/,
    );
  });

  it("rejects invalid blueprint snapshot capturedAt", () => {
    assert.throws(
      () =>
        reconstituteQuestionGenerationRun({
          ...storedRun(),
          blueprintSnapshot: {
            ...storedRun().blueprintSnapshot,
            capturedAt: "not-a-date",
          },
        }),
      /capturedAt must be a valid date string/,
    );
  });

  it("requires blueprint snapshot documentHash", () => {
    assert.throws(
      () =>
        reconstituteQuestionGenerationRun({
          ...storedRun(),
          blueprintSnapshot: {
            ...storedRun().blueprintSnapshot,
            documentHash: undefined,
          },
        }),
      /documentHash/,
    );
  });

  it("rejects persisted run when blueprintVersionId does not match snapshot", () => {
    assert.throws(
      () =>
        reconstituteQuestionGenerationRun({
          ...storedRun(),
          blueprintVersionId: "019e9315-6a87-715f-9861-8654df072007",
        }),
      /blueprintVersionId must match blueprint snapshot/,
    );
  });

  it("creates retry replacement with frozen snapshot and lineage", () => {
    const initial = createInitialQuestionGenerationRun(
      {
        blueprintId,
        blueprintVersionId,
        blueprintSnapshot: snapshot(),
        createdByUserId: ownerUserId,
        id: questionGenerationRunId("019e9315-6a87-715f-9861-8654df072004"),
        ownerUserId,
        requestedCount: 2,
        targetQuestionSetId,
      },
      at,
    );
    const failed = markQuestionGenerationRunFailed(initial, "failed", at);
    const retry = createRetryQuestionGenerationRun(
      {
        createdByUserId: ownerUserId,
        id: questionGenerationRunId("019e9315-6a87-715f-9861-8654df072005"),
        original: failed,
      },
      at,
    );

    assert.equal(retry.retryOfRunId, failed.id);
    assert.equal(retry.attemptNumber, 2);
    assert.equal(retry.workbookCalculationId, null);
    assert.equal(retry.blueprintVersionId, failed.blueprintVersionId);
    assert.strictEqual(retry.blueprintSnapshot, failed.blueprintSnapshot);
    assert.equal(failed.status, "failed");
  });
});

function snapshot() {
  return createQuestionBlueprintSnapshot({
    blueprintId,
    blueprintVersionId,
    capturedAt: at,
    description: questionBlueprintDescription(null),
    document: questionBlueprintDocument({
      blocks: [],
      references: [],
      responseFields: [],
      schemaVersion: 2,
    }),
    name: questionBlueprintName("Blueprint"),
    sources: [],
  });
}

function storedRun() {
  return {
    attemptNumber: 1,
    attempts: 0,
    blueprintId,
    blueprintVersionId,
    blueprintSnapshot: snapshot(),
    createdAt: at,
    createdByUserId: ownerUserId,
    errorMessage: null,
    finishedAt: null,
    id: "019e9315-6a87-715f-9861-8654df072004",
    ownerUserId,
    requestedCount: 1,
    result: null,
    retryOfRunId: null,
    startedAt: null,
    status: "queued",
    targetQuestionSetId,
    updatedAt: at,
    workbookCalculationId: null,
  };
}
