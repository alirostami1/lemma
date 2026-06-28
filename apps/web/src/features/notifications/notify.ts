import { toast } from "@lemma/ui/components/sonner";

type ToastId = string | number;

export function notifyDraftPublished(): void {
  toast.success("Blueprint published.");
}

export function notifyDraftPublishFailed(message?: string | null): void {
  toast.error("Blueprint could not be published.", {
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
    action: {
      label: "Open question set",
      onClick: input.onOpenQuestionSet,
    },
    description: formatQuestionsGeneratedDescription(input),
    id: input.toastId,
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
    action: options?.onRetry
      ? {
          label: "Retry",
          onClick: options.onRetry,
        }
      : undefined,
    description: message ?? undefined,
    id: options?.toastId ?? undefined,
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
  return toast.loading("Generation retry started...");
}

export function notifyQuestionGenerationRetrySucceeded(input: {
  toastId?: ToastId;
  count?: number | null;
  questionSetName?: string | null;
  onOpenQuestionSet(): void;
}): void {
  toast.success("Questions generated.", {
    action: {
      label: "Open question set",
      onClick: input.onOpenQuestionSet,
    },
    description: formatQuestionsGeneratedDescription(input),
    id: input.toastId,
  });
}

export function notifyQuestionGenerationRetryFailed(input: {
  toastId?: ToastId;
  message?: string | null;
}): void {
  toast.error("Generation failed.", {
    description: input.message ?? undefined,
    id: input.toastId,
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
