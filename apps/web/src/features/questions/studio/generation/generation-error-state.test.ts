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
        createRun({ status: "failed", errorMessage: "Source failed." }),
        null,
      ),
    ).toMatchObject({
      title: "Generation failed.",
      description: "Check issue and retry when ready.",
      message: "Source failed.",
      canRetry: true,
      hidden: false,
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
    id: "run_1",
    ownerUserId: "user_1",
    createdByUserId: "user_1",
    blueprintId: "blueprint_1",
    blueprintVersionId: "version_1",
    targetQuestionSetId: "question_set_1",
    requestedCount: 2,
    source: null,
    status,
    result: null,
    errorMessage: null,
    attempts: 1,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date("2026-06-10T00:00:00.000Z"),
    updatedAt: new Date("2026-06-10T00:00:00.000Z"),
    ...rest,
  };
}
