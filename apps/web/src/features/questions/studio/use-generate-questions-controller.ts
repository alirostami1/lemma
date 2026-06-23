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
      params: { questionSetId },
      to: "/question-sets/$questionSetId",
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
    onRetryStarted: (run, context) => {
      setLastRun(run);
      setActiveRunContext(context);
      setLastRunContext(context);
    },
    onRetryToastChange: setRetryToastId,
  });

  const status = useGenerationStatusController({
    activeRunContext,
    getQuestionSetName,
    lastRun,
    lastRunContext,
    onActiveRunContextChange: setActiveRunContext,
    onGenerationErrorChange: setGenerationError,
    onLastRunChange: setLastRun,
    onLastRunContextChange: setLastRunContext,
    onRetry: () => {
      void retry.retryLastRun();
    },
    onRetryToastChange: setRetryToastId,
    openQuestionSet,
    retryToastId,
  });
  const generateDialog = useGenerateQuestionsDialogController({
    errorMessage: generationError,
    isGenerating:
      command.isCreateGenerationPending ||
      retry.isRetryGenerationPending ||
      status.isRunLoading,
    onGenerate: async (dialogInput) => {
      const started = await command.generateDialog.onGenerate(dialogInput);
      if (started) {
        command.clearSource();
      }
      return started;
    },
    onOpenChange: command.generateDialog.onOpenChange,
    open: command.generateDialog.open,
    source: command.generateDialog.source,
  });

  return {
    generateDialog,
    generationStatus: {
      errorMessage: generationError,
      isRetrying: retry.isRetryGenerationPending,
      onRetry: () => {
        void retry.retryLastRun();
      },
      run: status.run,
    },
    onGenerateBlueprint: command.onGenerateBlueprint,
  };
}
