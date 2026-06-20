import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuestionSetNameLookup } from "#/domains/questions";
import type { QuestionGenerationRun } from "#/domains/questions/model";
import type { notifyQuestionGenerationRetryStarted } from "#/features/notifications";
import type {
  ActiveRunContext,
  GenerateQuestionsController,
} from "./generation/generation-controller-types";
import { useGenerateQuestionsDialogController } from "./generation/use-generate-questions-dialog-controller";
import { useGenerationCommandController } from "./generation/use-generation-command-controller";
import { useGenerationRetryController } from "./generation/use-generation-retry-controller";
import { useGenerationStatusController } from "./generation/use-generation-status-controller";

export function useGenerateQuestionsController(): GenerateQuestionsController {
  const navigate = useNavigate();
  const getQuestionSetName = useQuestionSetNameLookup();
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [activeRunContext, setActiveRunContext] =
    useState<ActiveRunContext | null>(null);
  const [lastRunContext, setLastRunContext] = useState<ActiveRunContext | null>(
    null,
  );
  const [lastRun, setLastRun] = useState<QuestionGenerationRun | null>(null);
  const [retryToastId, setRetryToastId] = useState<ReturnType<
    typeof notifyQuestionGenerationRetryStarted
  > | null>(null);

  async function openQuestionSet(questionSetId: string | null) {
    if (!questionSetId) {
      return;
    }

    await navigate({
      to: "/question-sets/$questionSetId",
      params: { questionSetId },
    });
  }

  const command = useGenerationCommandController({
    getQuestionSetName,
    onGenerationErrorChange: setGenerationError,
    onRunStarted: (run, context) => {
      setLastRun(run);
      setActiveRunContext(context);
      setLastRunContext(context);
    },
  });

  const retry = useGenerationRetryController({
    lastRunContext,
    onGenerationErrorChange: setGenerationError,
    onRetryToastChange: setRetryToastId,
    onRetryStarted: setActiveRunContext,
  });

  const status = useGenerationStatusController({
    activeRunContext,
    lastRunContext,
    lastRun,
    retryToastId,
    onActiveRunContextChange: setActiveRunContext,
    onLastRunChange: setLastRun,
    onLastRunContextChange: setLastRunContext,
    onGenerationErrorChange: setGenerationError,
    onRetryToastChange: setRetryToastId,
    getQuestionSetName,
    openQuestionSet,
    onRetry: () => {
      void retry.retryLastRun();
    },
  });
  const generateDialog = useGenerateQuestionsDialogController({
    open: command.generateDialog.open,
    source: command.generateDialog.source,
    errorMessage: generationError,
    isGenerating:
      command.isCreateGenerationPending ||
      retry.isRetryGenerationPending ||
      status.isRunLoading,
    onOpenChange: command.generateDialog.onOpenChange,
    onGenerate: async (dialogInput) => {
      const started = await command.generateDialog.onGenerate(dialogInput);
      if (started) {
        command.clearSource();
      }
      return started;
    },
  });

  return {
    generateDialog,
    generationStatus: {
      run: status.run,
      errorMessage: generationError,
      isRetrying: retry.isRetryGenerationPending,
      onRetry: () => {
        void retry.retryLastRun();
      },
    },
    onGenerateBlueprint: command.onGenerateBlueprint,
  };
}
