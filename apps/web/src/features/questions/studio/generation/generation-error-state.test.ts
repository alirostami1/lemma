import { describe, expect, it } from "vitest";
import type { QuestionGenerationRun } from "#/domains/questions/model";
import {
  getGenerateCountIssue,
  getGenerationStatusState,
} from "./generation-error-state";

describe("generation error state", () => {
  it("validates question count", () => {
    expect(getGenerateCountIssue("")).toBe("Enter a question count.");
    expect(getGenerateCountIssue("0")).toBe(
      "Generation count must be between 1 and 100.",
    );
    expect(getGenerateCountIssue("101")).toBe(
      "Generation count must be between 1 and 100.",
    );
    expect(getGenerateCountIssue("1.5")).toBe(
      "Generation count must be between 1 and 100.",
    );
    expect(getGenerateCountIssue("1")).toBeNull();
  });

  it("maps failed runs to retry state", () => {
    expect(
      getGenerationStatusState(
        createRun({ errorMessage: "Source failed.", status: "failed" }),
        null,
      ),
    ).toMatchObject({
      canRetry: true,
      description: "Check issue and retry when ready.",
      hidden: false,
      message: "Source failed.",
      title: "Generation failed.",
    });
  });

  it("hides succeeded runs", () => {
    expect(
      getGenerationStatusState(createRun({ status: "succeeded" }), null).hidden,
    ).toBe(true);
  });
});

function createRun(
  overrides: Partial<QuestionGenerationRun> &
    Pick<QuestionGenerationRun, "status">,
): QuestionGenerationRun {
  const { status, ...rest } = overrides;

  return {
    attemptNumber: 1,
    attempts: 1,
    blueprintId: "blueprint_1",
    createdAt: new Date("2026-06-10T00:00:00.000Z"),
    createdByUserId: "user_1",
    errorMessage: null,
    finishedAt: null,
    id: "run_1",
    ownerUserId: "user_1",
    requestedCount: 2,
    result: null,
    retryOfRunId: null,
    startedAt: null,
    status,
    targetQuestionSetId: "question_set_1",
    updatedAt: new Date("2026-06-10T00:00:00.000Z"),
    workbookCalculationId: null,
    ...rest,
  };
}
