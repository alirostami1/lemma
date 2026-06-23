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
      canRetry: false,
      description: errorMessage
        ? "Check issue and retry when ready."
        : "Questions are being created.",
      hidden: !errorMessage,
      message: errorMessage,
      title: errorMessage ? "Generation failed." : "Generation status",
    };
  }

  if (run.status === "succeeded") {
    return {
      canRetry: false,
      description: "Generation finished.",
      hidden: true,
      message: null,
      title: "Questions generated.",
    };
  }

  if (run.status === "failed") {
    return {
      canRetry: true,
      description: "Check issue and retry when ready.",
      hidden: false,
      message: errorMessage ?? run.errorMessage ?? "Generation failed.",
      title: "Generation failed.",
    };
  }

  if (run.status === "cancelled") {
    return {
      canRetry: false,
      description: "Check issue and retry when ready.",
      hidden: false,
      message: errorMessage ?? run.errorMessage ?? "Generation failed.",
      title: "Generation failed.",
    };
  }

  return {
    canRetry: false,
    description: "Questions are being created.",
    hidden: false,
    message: errorMessage ?? run.errorMessage,
    title: "Generating questions...",
  };
}
