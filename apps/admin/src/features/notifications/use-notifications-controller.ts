import { toast } from "@lemma/ui/components/sonner";
import { useState } from "react";
import {
  type OpsOutboxStatusFilter,
  type OpsReviewState,
  useOpsOutboxEventsQuery,
  useReplayOpsOutboxEventMutation,
  useReviewOpsOutboxEventMutation,
} from "#/domains/ops";
import { getUserFacingApiErrorMessage } from "#/lib/errors/api-error";

export function useNotificationsController() {
  const [status, setStatus] = useState<OpsOutboxStatusFilter>("all");
  const [reviewState, setReviewState] = useState<OpsReviewState>("all");
  const notifications = useOpsOutboxEventsQuery({ status, reviewState });
  const failedEvents = useOpsOutboxEventsQuery({
    status: "failed",
    reviewState: "unreviewed",
  });
  const reviewEvent = useReviewOpsOutboxEventMutation();
  const replayEvent = useReplayOpsOutboxEventMutation();

  return {
    events: notifications.data?.events ?? [],
    failedEvents: failedEvents.data?.events ?? [],
    status,
    reviewState,
    isLoading: notifications.isLoading || failedEvents.isLoading,
    isFetching: notifications.isFetching || failedEvents.isFetching,
    isMutating: reviewEvent.isPending || replayEvent.isPending,
    errorMessage:
      getErrorMessage(notifications.error) ?? getErrorMessage(failedEvents.error),
    setStatus,
    setReviewState,
    refresh: () => {
      void notifications.refetch();
      void failedEvents.refetch();
    },
    replay: (eventId: string) =>
      replayEvent.mutate(
        { eventId, note: "Replayed from admin console." },
        {
          onSuccess: () => toast.success("Event queued for replay."),
          onError: (error) =>
            toast.error("Event could not be replayed.", {
              description: getErrorMessage(error) ?? undefined,
            }),
        },
      ),
    review: (eventId: string) =>
      reviewEvent.mutate(
        {
          eventId,
          action: "reviewed",
          note: "Reviewed from admin console.",
        },
        {
          onSuccess: () => toast.success("Event reviewed."),
          onError: (error) =>
            toast.error("Event could not be reviewed.", {
              description: getErrorMessage(error) ?? undefined,
            }),
        },
      ),
    ignore: (eventId: string) =>
      reviewEvent.mutate(
        {
          eventId,
          action: "ignored",
          note: "Ignored from admin console.",
        },
        {
          onSuccess: () => toast.success("Event ignored."),
          onError: (error) =>
            toast.error("Event could not be ignored.", {
              description: getErrorMessage(error) ?? undefined,
            }),
        },
      ),
  };
}

function getErrorMessage(error: unknown): string | null {
  return error ? getUserFacingApiErrorMessage(error) : null;
}
