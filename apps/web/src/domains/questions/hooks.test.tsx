import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useRetryQuestionGenerationRun } from "./hooks";
import { questionKeys } from "./keys";
import type { QuestionGenerationRun } from "./model";

const mocks = vi.hoisted(() => ({
  retryQuestionGenerationRun: vi.fn(),
}));

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  retryQuestionGenerationRun: mocks.retryQuestionGenerationRun,
}));

describe("useRetryQuestionGenerationRun", () => {
  it("caches replacement run under replacement id", async () => {
    const replacementRun: QuestionGenerationRun = {
      attemptNumber: 2,
      attempts: 0,
      blueprintId: "blueprint-1",
      blueprintVersionId: "blueprint-version-1",
      createdAt: new Date("2026-06-21T00:00:00.000Z"),
      createdByUserId: "user-1",
      errorMessage: null,
      finishedAt: null,
      id: "run-replacement",
      ownerUserId: "user-1",
      requestedCount: 2,
      result: null,
      retryOfRunId: "run-failed",
      startedAt: null,
      status: "queued",
      targetQuestionSetId: "question-set-1",
      updatedAt: new Date("2026-06-21T00:00:00.000Z"),
      workbookCalculationId: null,
    };
    const response = { questionGenerationRun: replacementRun };
    mocks.retryQuestionGenerationRun.mockResolvedValue(response);
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useRetryQuestionGenerationRun(), {
      wrapper,
    });

    await act(() =>
      result.current.mutateAsync({
        questionGenerationRunId: "run-failed",
        questionSetId: "question-set-1",
      }),
    );

    expect(
      queryClient.getQueryData(
        questionKeys.generationRunDetail("run-replacement"),
      ),
    ).toEqual(response);
    expect(
      queryClient.getQueryData(questionKeys.generationRunDetail("run-failed")),
    ).toBeUndefined();
  });
});
