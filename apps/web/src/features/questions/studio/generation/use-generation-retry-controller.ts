import { useRetryQuestionGenerationRun } from "#/domains/questions";
import type { QuestionGenerationRun } from "#/domains/questions/model";
import {
  notifyQuestionGenerationRetryFailed,
  notifyQuestionGenerationRetryStarted,
} from "#/features/notifications";
import type { ActiveRunContext } from "./generation-controller-types";

type UseGenerationRetryControllerInput = {
  lastRunContext: ActiveRunContext | null;
  onGenerationErrorChange(message: string | null): void;
  onRetryToastChange(
    toastId: ReturnType<typeof notifyQuestionGenerationRetryStarted> | null,
  ): void;
  onRetryStarted(run: QuestionGenerationRun, context: ActiveRunContext): void;
};

export function useGenerationRetryController({
  lastRunContext,
  onGenerationErrorChange,
  onRetryToastChange,
  onRetryStarted,
}: UseGenerationRetryControllerInput) {
  const { mutateAsync: retryGeneration, isPending: isRetryGenerationPending } =
    useRetryQuestionGenerationRun();

  async function retryLastRun() {
    if (!lastRunContext) {
      return;
    }

    onGenerationErrorChange(null);
    const toastId = notifyQuestionGenerationRetryStarted();
    onRetryToastChange(toastId);

    try {
      const result = await retryGeneration({
        questionGenerationRunId: lastRunContext.runId,
        questionSetId: lastRunContext.questionSetId,
      });
      const replacementRun = result.questionGenerationRun;
      onRetryStarted(replacementRun, {
        ...lastRunContext,
        questionSetId: replacementRun.targetQuestionSetId,
        runId: replacementRun.id,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message.length > 0
          ? error.message
          : "Generation could not be retried.";
      onGenerationErrorChange(message);
      notifyQuestionGenerationRetryFailed({
        message,
        toastId,
      });
      onRetryToastChange(null);
    }
  }

  return {
    isRetryGenerationPending,
    retryLastRun,
  };
}
