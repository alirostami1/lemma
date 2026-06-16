import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getOpsOverview,
  listOpsFailedQueueJobs,
  listOpsQueueJobs,
  listOpsOutboxEvents,
  replayOpsOutboxEvent,
  reviewOpsOutboxEvent,
} from "./api";
import { opsKeys } from "./keys";
import type {
  OpsOutboxStatusFilter,
  OpsQueueStateFilter,
  OpsReviewState,
} from "./model";

export function useOpsOverviewQuery() {
  return useQuery({
    queryKey: opsKeys.overview(),
    queryFn: getOpsOverview,
  });
}

export function useOpsOutboxEventsQuery(input: {
  status?: OpsOutboxStatusFilter;
  reviewState: OpsReviewState;
}) {
  const status = input.status ?? "failed";
  return useQuery({
    queryKey: opsKeys.outboxEvents({ status, reviewState: input.reviewState }),
    queryFn: () =>
      listOpsOutboxEvents({ status, reviewState: input.reviewState }),
  });
}

export function useOpsFailedQueueJobsQuery() {
  return useQuery({
    queryKey: opsKeys.failedQueueJobs(),
    queryFn: () => listOpsFailedQueueJobs(),
  });
}

export function useOpsQueueJobsQuery(input: { state?: OpsQueueStateFilter }) {
  const state = input.state ?? "all";
  return useQuery({
    queryKey: opsKeys.queueJobs({ state }),
    queryFn: () => listOpsQueueJobs({ state }),
  });
}

export function useReviewOpsOutboxEventMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reviewOpsOutboxEvent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: opsKeys.all });
    },
  });
}

export function useReplayOpsOutboxEventMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: replayOpsOutboxEvent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: opsKeys.all });
    },
  });
}
