import type { QuestionGenerationRun } from "#/domains/questions/model";

const MAX_GENERATION_RUN_COUNT = 100;

export function getGenerateCountIssue(countInput: string): string | null {
  if (countInput.trim().length === 0) {
    return "Enter a question count.";
  }

  const parsedCount = Number(countInput);
  if (
    !Number.isInteger(parsedCount) ||
    parsedCount < 1 ||
    parsedCount > MAX_GENERATION_RUN_COUNT
  ) {
    return `Generation count must be between 1 and ${MAX_GENERATION_RUN_COUNT}.`;
  }

  return null;
}

export function getGenerationStatusState(
  run: QuestionGenerationRun | null,
  errorMessage: string | null,
) {
  if (!run) {
    return {
      title: errorMessage ? "Generation failed." : "Generation status",
      description: errorMessage
        ? "Check issue and retry when ready."
        : "Questions are being created.",
      message: errorMessage,
      canRetry: false,
      hidden: !errorMessage,
    };
  }

  if (run.status === "succeeded") {
    return {
      title: "Questions generated.",
      description: "Generation finished.",
      message: null,
      canRetry: false,
      hidden: true,
    };
  }

  if (run.status === "failed") {
    return {
      title: "Generation failed.",
      description: "Check issue and retry when ready.",
      message: errorMessage ?? run.errorMessage ?? "Generation failed.",
      canRetry: true,
      hidden: false,
    };
  }

  if (run.status === "cancelled") {
    return {
      title: "Generation failed.",
      description: "Check issue and retry when ready.",
      message: errorMessage ?? run.errorMessage ?? "Generation failed.",
      canRetry: false,
      hidden: false,
    };
  }

  return {
    title: "Generating questions...",
    description: "Questions are being created.",
    message: errorMessage ?? run.errorMessage,
    canRetry: false,
    hidden: false,
  };
}
