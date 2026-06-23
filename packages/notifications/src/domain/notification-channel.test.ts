import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNotificationChannel,
  getNotificationChannelAccessRequirement,
  parseNotificationChannel,
  questionGenerationRunNotificationChannel,
  questionSetNotificationChannel,
  userNotificationChannel,
  workbookCalculationNotificationChannel,
} from "./notification-channel.js";

const userId = "019e9315-6a87-715f-9861-8654df070e01";
const runId = "019e9315-6a87-715f-9861-8654df070e02";
const questionSetId = "019e9315-6a87-715f-9861-8654df070e03";
const workbookCalculationId = "019e9315-6a87-715f-9861-8654df070e04";

describe("notification channels", () => {
  it("builds and parses registered channels", () => {
    const cases = [
      {
        channel: userNotificationChannel(userId),
        target: { type: "user" as const, userId },
      },
      {
        channel: questionGenerationRunNotificationChannel(runId),
        target: {
          questionGenerationRunId: runId,
          type: "question_generation_run" as const,
        },
      },
      {
        channel: questionSetNotificationChannel(questionSetId),
        target: { questionSetId, type: "question_set" as const },
      },
      {
        channel: workbookCalculationNotificationChannel(workbookCalculationId),
        target: {
          type: "workbook_calculation" as const,
          workbookCalculationId,
        },
      },
    ];

    for (const { target, channel } of cases) {
      assert.equal(buildNotificationChannel(target), channel);
      assert.deepEqual(parseNotificationChannel(channel), target);
    }
  });

  it("rejects unknown or malformed channels", () => {
    for (const channel of [
      "",
      "$unknown:019e9315-6a87-715f-9861-8654df070e01",
      "$user:not-a-uuid",
      "$user:019e9315-6a87-715f-9861-8654df070e01:extra",
    ]) {
      assert.equal(parseNotificationChannel(channel), null);
    }
  });

  it("declares access requirements from the registry target", () => {
    assert.deepEqual(
      getNotificationChannelAccessRequirement({
        questionGenerationRunId: runId,
        type: "question_generation_run",
      }),
      {
        questionGenerationRunId: runId,
        type: "question_generation_run",
      },
    );
  });
});
