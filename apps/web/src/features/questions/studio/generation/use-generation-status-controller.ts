import { useEffect, useRef } from "react";
import { useQuestionGenerationRunStatusQuery } from "#/domains/questions";
import { isQuestionGenerationRunActive } from "#/domains/questions/generation-status";
import type { QuestionGenerationRun } from "#/domains/questions/model";
import {
  questionGenerationRunNotificationChannel,
  useRealtimeNotificationChannel,
} from "#/domains/realtime";
import type { notifyQuestionGenerationRetryStarted } from "#/features/notifications";
import {
  notifyQuestionGenerationFailed,
  notifyQuestionGenerationRetryFailed,
  notifyQuestionGenerationRetrySucceeded,
  notifyQuestionGenerationStarted,
  notifyQuestionsGenerated,
} from "#/features/notifications";
import type { ActiveRunContext } from "./generation-controller-types";

const REALTIME_FALLBACK_REFETCH_INTERVAL_MS = 10_000;

type UseGenerationStatusControllerInput = {
  activeRunContext: ActiveRunContext | null;
  lastRunContext: ActiveRunContext | null;
  lastRun: QuestionGenerationRun | null;
  retryToastId: ReturnType<typeof notifyQuestionGenerationRetryStarted> | null;
  onActiveRunContextChange(context: ActiveRunContext | null): void;
  onLastRunChange(run: QuestionGenerationRun): void;
  onLastRunContextChange(context: ActiveRunContext): void;
  onGenerationErrorChange(message: string | null): void;
  onRetryToastChange(
    toastId: ReturnType<typeof notifyQuestionGenerationRetryStarted> | null,
  ): void;
  getQuestionSetName(questionSetId: string | null): string | null;
  openQuestionSet(questionSetId: string | null): Promise<void>;
  onRetry(): void;
};

export function useGenerationStatusController({
  activeRunContext,
  lastRunContext,
  lastRun,
  retryToastId,
  onActiveRunContextChange,
  onLastRunChange,
  onLastRunContextChange,
  onGenerationErrorChange,
  onRetryToastChange,
  getQuestionSetName,
  openQuestionSet,
  onRetry,
}: UseGenerationStatusControllerInput) {
  const notifiedSuccessRunIdsRef = useRef(new Set<string>());
  const notifiedFailureRunIdsRef = useRef(new Set<string>());
  const activeToastRunIdRef = useRef<string | null>(null);
  const activeToastIdRef = useRef<ReturnType<
    typeof notifyQuestionGenerationStarted
  > | null>(null);
  const activeRunChannel = activeRunContext
    ? questionGenerationRunNotificationChannel(activeRunContext.runId)
    : null;

  const runQuery = useQuestionGenerationRunStatusQuery(
    { questionGenerationRunId: activeRunContext?.runId ?? "" },
    {
      enabled: activeRunContext !== null,
      refetchInterval: (query) => {
        const run = query.state.data?.questionGenerationRun;
        return run && isQuestionGenerationRunActive(run)
          ? REALTIME_FALLBACK_REFETCH_INTERVAL_MS
          : false;
      },
    },
  );
  useRealtimeNotificationChannel(activeRunChannel);

  useEffect(() => {
    if (!activeRunContext) {
      return;
    }

    if (activeToastRunIdRef.current === activeRunContext.runId) {
      return;
    }

    activeToastRunIdRef.current = activeRunContext.runId;
    activeToastIdRef.current =
      retryToastId ??
      notifyQuestionGenerationStarted({
        count: activeRunContext.count,
        questionSetName: activeRunContext.questionSetName,
      });
  }, [activeRunContext, retryToastId]);

  useEffect(() => {
    const run = runQuery.data?.questionGenerationRun;
    if (!run) {
      return;
    }

    onLastRunChange(run);
    const nextRunContext = {
      count: lastRunContext?.count,
      questionSetId: run.targetQuestionSetId ?? "",
      questionSetName:
        lastRunContext?.questionSetName ??
        getQuestionSetName(run.targetQuestionSetId ?? null),
      runId: run.id,
    };
    if (!areActiveRunContextsEqual(lastRunContext, nextRunContext)) {
      onLastRunContextChange(nextRunContext);
    }

    if (isQuestionGenerationRunActive(run)) {
      onGenerationErrorChange(null);
      return;
    }

    if (run.status === "succeeded") {
      if (!notifiedSuccessRunIdsRef.current.has(run.id)) {
        notifiedSuccessRunIdsRef.current.add(run.id);
        const successInput = {
          count: run.result?.questionIds.length ?? lastRunContext?.count,
          onOpenQuestionSet: () => {
            void openQuestionSet(run.targetQuestionSetId ?? null);
          },
          questionSetName:
            lastRunContext?.questionSetName ??
            getQuestionSetName(run.targetQuestionSetId ?? null),
        };

        if (retryToastId) {
          notifyQuestionGenerationRetrySucceeded({
            toastId: retryToastId,
            ...successInput,
          });
          onRetryToastChange(null);
        } else {
          notifyQuestionsGenerated({
            toastId: getActiveToastIdForRun(run.id),
            ...successInput,
          });
        }
      }

      clearActiveToast(run.id);
      onGenerationErrorChange(null);
      onActiveRunContextChange(null);
      return;
    }

    if (run.status === "failed" || run.status === "cancelled") {
      const message =
        run.errorMessage ??
        (run.status === "cancelled"
          ? "Generation was cancelled."
          : "Generation failed.");
      onGenerationErrorChange(message);
      if (!notifiedFailureRunIdsRef.current.has(run.id)) {
        notifiedFailureRunIdsRef.current.add(run.id);
        if (retryToastId) {
          notifyQuestionGenerationRetryFailed({
            message,
            toastId: retryToastId,
          });
          onRetryToastChange(null);
        } else {
          notifyQuestionGenerationFailed(message, {
            onRetry: run.status === "failed" ? onRetry : null,
            toastId: getActiveToastIdForRun(run.id),
          });
        }
      }
      clearActiveToast(run.id);
      onActiveRunContextChange(null);
    }
  }, [
    getQuestionSetName,
    lastRunContext,
    onActiveRunContextChange,
    onGenerationErrorChange,
    onLastRunChange,
    onLastRunContextChange,
    onRetry,
    onRetryToastChange,
    openQuestionSet,
    retryToastId,
    runQuery.data,
  ]);

  function getActiveToastIdForRun(runId: string) {
    return activeToastRunIdRef.current === runId
      ? (activeToastIdRef.current ?? undefined)
      : undefined;
  }

  function clearActiveToast(runId: string) {
    if (activeToastRunIdRef.current !== runId) {
      return;
    }

    activeToastRunIdRef.current = null;
    activeToastIdRef.current = null;
  }

  return {
    isRunLoading: runQuery.isLoading,
    run: runQuery.data?.questionGenerationRun ?? lastRun,
  };
}

function areActiveRunContextsEqual(
  left: ActiveRunContext | null,
  right: ActiveRunContext,
) {
  return (
    left !== null &&
    left.count === right.count &&
    left.questionSetId === right.questionSetId &&
    left.questionSetName === right.questionSetName &&
    left.runId === right.runId
  );
}
