import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as browserChannels from "../browser/notification-channel.js";
import type {
  NotificationChannelAccessRequirement,
  NotificationChannelTarget,
} from "./notification-channel.js";
import * as domainChannels from "./notification-channel.js";

type NotificationChannelApi = Pick<
  typeof domainChannels,
  | "buildNotificationChannel"
  | "getNotificationChannelAccessRequirement"
  | "parseNotificationChannel"
  | "questionGenerationRunNotificationChannel"
  | "questionSetNotificationChannel"
  | "userNotificationChannel"
  | "workbookCalculationNotificationChannel"
>;

const userId = "019e9315-6a87-715f-9861-8654df070e01";
const runId = "019e9315-6a87-715f-9861-8654df070e02";
const questionSetId = "019e9315-6a87-715f-9861-8654df070e03";
const workbookCalculationId = "019e9315-6a87-715f-9861-8654df070e04";

const channelCases: {
  build(api: NotificationChannelApi): string;
  invalidBuild(api: NotificationChannelApi): unknown;
  target: NotificationChannelTarget;
  accessRequirement: NotificationChannelAccessRequirement;
}[] = [
  {
    accessRequirement: { type: "current_user", userId },
    build: (api) => api.userNotificationChannel(userId),
    invalidBuild: (api) => api.userNotificationChannel("not-a-uuid"),
    target: { type: "user", userId },
  },
  {
    accessRequirement: {
      questionGenerationRunId: runId,
      type: "question_generation_run",
    },
    build: (api) => api.questionGenerationRunNotificationChannel(runId),
    invalidBuild: (api) =>
      api.questionGenerationRunNotificationChannel("not-a-uuid"),
    target: {
      questionGenerationRunId: runId,
      type: "question_generation_run",
    },
  },
  {
    accessRequirement: { questionSetId, type: "question_set" },
    build: (api) => api.questionSetNotificationChannel(questionSetId),
    invalidBuild: (api) => api.questionSetNotificationChannel("not-a-uuid"),
    target: { questionSetId, type: "question_set" },
  },
  {
    accessRequirement: {
      type: "workbook_calculation",
      workbookCalculationId,
    },
    build: (api) =>
      api.workbookCalculationNotificationChannel(workbookCalculationId),
    invalidBuild: (api) =>
      api.workbookCalculationNotificationChannel("not-a-uuid"),
    target: {
      type: "workbook_calculation",
      workbookCalculationId,
    },
  },
];

describe("notification channel wrappers", () => {
  for (const [name, api] of [
    ["domain", domainChannels],
    ["browser", browserChannels],
  ] satisfies [string, NotificationChannelApi][]) {
    describe(name, () => {
      it("builds and parses registered channels", () => {
        for (const { build, target } of channelCases) {
          const channel = build(api);

          assert.equal(api.buildNotificationChannel(target), channel);
          assert.deepEqual(api.parseNotificationChannel(channel), target);
        }
      });

      it("declares access requirements from the registry target", () => {
        for (const { accessRequirement, target } of channelCases) {
          assert.deepEqual(
            api.getNotificationChannelAccessRequirement(target),
            accessRequirement,
          );
        }
      });

      it("throws for invalid IDs in build helpers", () => {
        for (const { invalidBuild } of channelCases) {
          assert.throws(
            () => invalidBuild(api),
            /must be a supported UUID string/u,
          );
        }
      });

      it("rejects unknown or malformed channels", () => {
        for (const channel of [
          "",
          "$unknown:019e9315-6a87-715f-9861-8654df070e01",
          "$user:not-a-uuid",
          "$user:019e9315-6a87-715f-9861-8654df070e01:extra",
        ]) {
          assert.equal(api.parseNotificationChannel(channel), null);
        }
      });
    });
  }
});
