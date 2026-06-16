import { toast } from "@lemma/ui/components/sonner";

type ToastId = ReturnType<typeof toast.loading>;

export function notifyBlueprintSaved(): void {
  toast.success("Blueprint saved.");
}

export function notifyBlueprintSaveFailed(message?: string | null): void {
  toast.error("Blueprint could not be saved.", {
    description: message ?? undefined,
  });
}

export function notifyQuestionsGenerated(input: {
  toastId?: ToastId;
  count?: number | null;
  questionSetName?: string | null;
  onOpenQuestionSet(): void;
}): void {
  toast.success("Questions generated.", {
    id: input.toastId,
    description: formatQuestionsGeneratedDescription(input),
    action: {
      label: "Open question set",
      onClick: input.onOpenQuestionSet,
    },
  });
}

export function notifyQuestionGenerationFailed(
  message?: string | null,
  options?: {
    toastId?: ToastId | null;
    onRetry?: (() => void) | null;
  },
): void {
  toast.error("Generation failed.", {
    id: options?.toastId ?? undefined,
    description: message ?? undefined,
    action: options?.onRetry
      ? {
          label: "Retry",
          onClick: options.onRetry,
        }
      : undefined,
  });
}

export function notifyQuestionGenerationStarted(input: {
  count?: number | null;
  questionSetName?: string | null;
}): ToastId {
  return toast.loading("Generating questions...", {
    description: formatQuestionGenerationStartedDescription(input),
  });
}

export function notifyQuestionGenerationRetryStarted(): ToastId {
  return toast.loading("Retrying generation...");
}

export function notifyQuestionGenerationRetrySucceeded(input: {
  toastId?: ToastId;
  count?: number | null;
  questionSetName?: string | null;
  onOpenQuestionSet(): void;
}): void {
  toast.success("Questions generated.", {
    id: input.toastId,
    description: formatQuestionsGeneratedDescription(input),
    action: {
      label: "Open question set",
      onClick: input.onOpenQuestionSet,
    },
  });
}

export function notifyQuestionGenerationRetryFailed(input: {
  toastId?: ToastId;
  message?: string | null;
}): void {
  toast.error("Generation failed.", {
    id: input.toastId,
    description: input.message ?? undefined,
  });
}

export function notifySourceUploaded(input: {
  context: "create" | "studio";
  sourceName?: string | null;
}): void {
  toast.success("Source uploaded.", {
    description:
      input.context === "create"
        ? "Opening Studio with this source."
        : input.sourceName
          ? `${input.sourceName} selected for this blueprint.`
          : "Source selected for this blueprint.",
  });
}

export function notifyGeneratedQuestionsLoadMoreFailed(): void {
  toast.error("More generated questions could not be loaded.");
}

function formatQuestionsGeneratedDescription(input: {
  count?: number | null;
  questionSetName?: string | null;
}) {
  const countText =
    typeof input.count === "number" && input.count > 0
      ? `${input.count} question${input.count === 1 ? "" : "s"} were added`
      : "Questions were added";

  if (input.questionSetName) {
    return `${countText} to ${input.questionSetName}.`;
  }

  return `${countText} to the question set.`;
}

function formatQuestionGenerationStartedDescription(input: {
  count?: number | null;
  questionSetName?: string | null;
}) {
  const countText =
    typeof input.count === "number" && input.count > 0
      ? `${input.count} question${input.count === 1 ? "" : "s"}`
      : "questions";

  if (input.questionSetName) {
    return `Creating ${countText} for ${input.questionSetName}.`;
  }

  return `Creating ${countText}.`;
}
