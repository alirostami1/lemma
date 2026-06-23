import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  questionBlueprintId,
  questionGenerationRunId,
  questionId,
  questionSetId,
  userId,
  workbookCalculationId,
  workbookId,
  workbookSnapshotId,
} from "./ids.js";

const uuidV7 = "019e9315-6a87-715f-9861-8654df070c4c";
const uuidV4 = "2dfb8d1e-9b7c-4b2c-80ac-1f2fae7a9f76";

describe("question IDs", () => {
  const constructors = [
    questionSetId,
    questionBlueprintId,
    questionId,
    questionGenerationRunId,
    userId,
    workbookId,
    workbookCalculationId,
    workbookSnapshotId,
  ];

  it("accepts UUIDv7 app IDs", () => {
    for (const createId of constructors) {
      assert.equal(createId(uuidV7), uuidV7);
    }
  });

  it("rejects UUIDv4 and malformed app IDs", () => {
    for (const createId of constructors) {
      assert.throws(() => createId(uuidV4), /must be a valid UUIDv7\./);
      assert.throws(() => createId("not-a-uuid"), /must be a valid UUIDv7\./);
    }
  });
});
