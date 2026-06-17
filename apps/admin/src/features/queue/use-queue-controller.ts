import { useState } from "react";
import { type OpsQueueStateFilter, useOpsQueueJobsQuery } from "#/domains/ops";
import { getUserFacingApiErrorMessage } from "#/lib/errors/api-error";

export function useQueueController() {
  const [state, setState] = useState<OpsQueueStateFilter>("all");
  const queue = useOpsQueueJobsQuery({ state });

  return {
    jobs: queue.data?.jobs ?? [],
    state,
    isLoading: queue.isLoading,
    isFetching: queue.isFetching,
    errorMessage: getErrorMessage(queue.error),
    setState,
    refresh: () => void queue.refetch(),
  };
}

function getErrorMessage(error: unknown): string | null {
  return error ? getUserFacingApiErrorMessage(error) : null;
}
