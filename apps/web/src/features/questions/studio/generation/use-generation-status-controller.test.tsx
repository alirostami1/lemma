import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGenerationStatusController } from "./use-generation-status-controller";

const mocks = vi.hoisted(() => ({
  statusQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
}));

vi.mock("#/domains/questions", () => ({
  useQuestionGenerationRunStatusQuery: mocks.statusQuery,
}));

vi.mock("#/domains/realtime", () => ({
  questionGenerationRunNotificationChannel: (runId: string) =>
    `question-generation-run:${runId}`,
  useRealtimeNotificationChannel: vi.fn(),
}));

vi.mock("#/features/notifications", () => ({
  notifyQuestionGenerationFailed: vi.fn(),
  notifyQuestionGenerationRetryFailed: vi.fn(),
  notifyQuestionGenerationRetrySucceeded: vi.fn(),
  notifyQuestionGenerationStarted: vi.fn(),
  notifyQuestionsGenerated: vi.fn(),
}));

describe("useGenerationStatusController", () => {
  it("loads status for replacement run context", () => {
    renderHook(() =>
      useGenerationStatusController({
        activeRunContext: {
          count: 2,
          questionSetId: "question-set-1",
          runId: "run-replacement",
        },
        getQuestionSetName: vi.fn(() => null),
        lastRun: null,
        lastRunContext: {
          count: 2,
          questionSetId: "question-set-1",
          runId: "run-replacement",
        },
        onActiveRunContextChange: vi.fn(),
        onGenerationErrorChange: vi.fn(),
        onLastRunChange: vi.fn(),
        onLastRunContextChange: vi.fn(),
        onRetry: vi.fn(),
        onRetryToastChange: vi.fn(),
        openQuestionSet: vi.fn(),
        retryToastId: null,
      }),
    );

    expect(mocks.statusQuery).toHaveBeenCalledWith(
      { questionGenerationRunId: "run-replacement" },
      expect.objectContaining({ enabled: true }),
    );
  });
});
