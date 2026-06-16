import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCurrentUser } from "@lemma/identity/application";
import { createUser } from "@lemma/identity/domain";
import {
  ForbiddenQuestionActionError,
  QuestionGenerationRunNotFoundError,
  type QuestionGenerationService,
  type QuestionSetService,
} from "@lemma/questions/application";
import type { WorkbookCalculationService } from "@lemma/workbook/application";
import { createRealtimeChannelAccess } from "./realtime-channel-access.js";

const now = new Date("2026-06-15T00:00:00.000Z");
const currentUser = createCurrentUser({
  user: createUser(
    {
      id: "019e9315-6a87-715f-9861-8654df070b01",
      identityId: "identity-user",
      email: "user@example.com",
      displayName: "User",
    },
    now,
  ),
  roles: [],
  at: now,
});
const otherUserId = "019e9315-6a87-715f-9861-8654df070b02";
const runId = "019e9315-6a87-715f-9861-8654df070b03";

describe("createRealtimeChannelAccess", () => {
  it("allows only the current user's direct channel", async () => {
    const access = createRealtimeChannelAccess(createServices());

    assert.equal(
      await access.canSubscribe({
        currentUser,
        channel: { type: "user", userId: currentUser.user.id },
        accessRequirement: {
          type: "current_user",
          userId: currentUser.user.id,
        },
      }),
      true,
    );
    assert.equal(
      await access.canSubscribe({
        currentUser,
        channel: { type: "user", userId: otherUserId },
        accessRequirement: {
          type: "current_user",
          userId: otherUserId,
        },
      }),
      false,
    );
  });

  it("denies forbidden and missing question generation run channels", async () => {
    const access = createRealtimeChannelAccess(
      createServices({
        questionGenerationService: {
          getQuestionGenerationRun: async () => {
            throw new ForbiddenQuestionActionError();
          },
        } as unknown as QuestionGenerationService,
      }),
    );

    assert.equal(
      await access.canSubscribe({
        currentUser,
        channel: {
          type: "question_generation_run",
          questionGenerationRunId: runId,
        },
        accessRequirement: {
          type: "question_generation_run",
          questionGenerationRunId: runId,
        },
      }),
      false,
    );

    const missingAccess = createRealtimeChannelAccess(
      createServices({
        questionGenerationService: {
          getQuestionGenerationRun: async () => {
            throw new QuestionGenerationRunNotFoundError();
          },
        } as unknown as QuestionGenerationService,
      }),
    );

    assert.equal(
      await missingAccess.canSubscribe({
        currentUser,
        channel: {
          type: "question_generation_run",
          questionGenerationRunId: runId,
        },
        accessRequirement: {
          type: "question_generation_run",
          questionGenerationRunId: runId,
        },
      }),
      false,
    );
  });

  it("does not swallow unexpected access check failures", async () => {
    const access = createRealtimeChannelAccess(
      createServices({
        questionGenerationService: {
          getQuestionGenerationRun: async () => {
            throw new Error("database offline");
          },
        } as unknown as QuestionGenerationService,
      }),
    );

    await assert.rejects(
      () =>
        access.canSubscribe({
          currentUser,
          channel: {
            type: "question_generation_run",
            questionGenerationRunId: runId,
          },
          accessRequirement: {
            type: "question_generation_run",
            questionGenerationRunId: runId,
          },
        }),
      { message: "database offline" },
    );
  });
});

function createServices(overrides?: {
  questionGenerationService?: QuestionGenerationService;
  questionSetService?: QuestionSetService;
  workbookCalculationService?: WorkbookCalculationService;
}) {
  return {
    questionGenerationService:
      overrides?.questionGenerationService ??
      ({
        getQuestionGenerationRun: async () => ({}),
      } as unknown as QuestionGenerationService),
    questionSetService:
      overrides?.questionSetService ??
      ({
        getQuestionSet: async () => ({}),
      } as unknown as QuestionSetService),
    workbookCalculationService:
      overrides?.workbookCalculationService ??
      ({
        getWorkbookCalculation: async () => ({}),
      } as unknown as WorkbookCalculationService),
  };
}
