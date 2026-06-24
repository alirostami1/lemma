import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuestionGenerationRun } from "#/domains/questions/model";
import { useGenerationRetryController } from "./use-generation-retry-controller";

const mocks = vi.hoisted(() => ({
  notifyFailed: vi.fn(),
  notifyStarted: vi.fn(() => "retry-toast"),
  retryGeneration: vi.fn(),
}));

vi.mock("#/domains/questions", () => ({
  useRetryQuestionGenerationRun: () => ({
    isPending: false,
    mutateAsync: mocks.retryGeneration,
  }),
}));

vi.mock("#/features/notifications", () => ({
  notifyQuestionGenerationRetryFailed: mocks.notifyFailed,
  notifyQuestionGenerationRetryStarted: mocks.notifyStarted,
}));

const failedContext = {
  count: 3,
  questionSetId: "question-set-old",
  questionSetName: "Practice",
  runId: "run-failed",
};

const replacementRun: QuestionGenerationRun = {
  attemptNumber: 2,
  attempts: 0,
  blueprintId: "blueprint-1",
  createdAt: new Date("2026-06-21T00:00:00.000Z"),
  createdByUserId: "user-1",
  errorMessage: null,
  finishedAt: null,
  id: "run-replacement",
  ownerUserId: "user-1",
  requestedCount: 3,
  result: null,
  retryOfRunId: "run-failed",
  startedAt: null,
  status: "queued",
  targetQuestionSetId: "question-set-replacement",
  updatedAt: new Date("2026-06-21T00:00:00.000Z"),
  workbookCalculationId: null,
};

describe("useGenerationRetryController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tracks replacement run returned by retry", async () => {
    mocks.retryGeneration.mockResolvedValue({
      questionGenerationRun: replacementRun,
    });
    const onRetryStarted = vi.fn();
    const { result } = renderHook(() =>
      useGenerationRetryController({
        lastRunContext: failedContext,
        onGenerationErrorChange: vi.fn(),
        onRetryStarted,
        onRetryToastChange: vi.fn(),
      }),
    );

    await act(() => result.current.retryLastRun());

    expect(mocks.retryGeneration).toHaveBeenCalledWith({
      questionGenerationRunId: "run-failed",
      questionSetId: "question-set-old",
    });
    expect(onRetryStarted).toHaveBeenCalledWith(replacementRun, {
      ...failedContext,
      questionSetId: "question-set-replacement",
      runId: "run-replacement",
    });
    expect(onRetryStarted).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ runId: "run-failed" }),
    );
  });

  it("leaves failed run unchanged when retry fails", async () => {
    mocks.retryGeneration.mockRejectedValue(new Error("Retry unavailable"));
    const onGenerationErrorChange = vi.fn();
    const onRetryStarted = vi.fn();
    const { result } = renderHook(() =>
      useGenerationRetryController({
        lastRunContext: failedContext,
        onGenerationErrorChange,
        onRetryStarted,
        onRetryToastChange: vi.fn(),
      }),
    );

    await act(() => result.current.retryLastRun());

    expect(onRetryStarted).not.toHaveBeenCalled();
    expect(onGenerationErrorChange).toHaveBeenLastCalledWith(
      "Retry unavailable",
    );
    expect(mocks.notifyFailed).toHaveBeenCalledWith({
      message: "Retry unavailable",
      toastId: "retry-toast",
    });
  });
});
