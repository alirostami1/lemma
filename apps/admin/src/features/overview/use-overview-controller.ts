import { useOpsOverviewQuery } from "#/domains/ops";

export function useOverviewController() {
  const overview = useOpsOverviewQuery();

  return {
    overview: overview.data ?? null,
    isLoading: overview.isLoading,
    isFetching: overview.isFetching,
    refresh: () => void overview.refetch(),
  };
}
