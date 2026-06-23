import {
  type UseMutationOptions,
  type UseQueryOptions,
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createWorkbook,
  createWorkbookCalculation,
  deleteWorkbook,
  getWorkbook,
  getWorkbookSnapshotCells,
  getWorkbookSnapshotMetadata,
  getWorkbookSnapshotRange,
  getWorkbookSnapshotRangeBatch,
  listWorkbookCalculations,
  listWorkbookSnapshotSheets,
  listWorkbookSnapshots,
  listWorkbooks,
  retryWorkbookCalculation,
  updateWorkbook,
  validateWorkbook,
} from "./api";
import { workbookKeys } from "./keys";
import type {
  CreateWorkbookCalculationInput,
  CreateWorkbookInput,
  DeleteWorkbookInput,
  GetWorkbookSnapshotCellsInput,
  GetWorkbookSnapshotRangeBatchInput,
  GetWorkbookSnapshotRangeInput,
  ListWorkbookCalculationsInput,
  ListWorkbookSnapshotSheetsInput,
  ListWorkbookSnapshotsInput,
  ListWorkbooksInput,
  RetryWorkbookCalculationInput,
  UpdateWorkbookInput,
  ValidateWorkbookInput,
  Workbook,
  WorkbookCalculation,
  WorkbookCalculationsPage,
  WorkbookSnapshotCells,
  WorkbookSnapshotMetadata,
  WorkbookSnapshotRange,
  WorkbookSnapshotRangeBatch,
  WorkbookSnapshotSheetsPage,
  WorkbookSnapshotsPage,
  WorkbooksPage,
} from "./model";

const IMMUTABLE_WORKBOOK_SNAPSHOT_STALE_TIME_MS = Number.POSITIVE_INFINITY;
export const WORKBOOK_SNAPSHOT_RANGE_BATCH_REF_LIMIT = 50;

export function useWorkbooksQuery(
  input?: ListWorkbooksInput,
  options?: Omit<UseQueryOptions<WorkbooksPage>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryFn: () => listWorkbooks(input),
    queryKey: workbookKeys.list(input),
    ...options,
  });
}

export function useWorkbooksInfiniteQuery(
  input?: Omit<ListWorkbooksInput, "cursor">,
  options?: { enabled?: boolean },
) {
  return useInfiniteQuery<
    WorkbooksPage,
    Error,
    InfiniteData<WorkbooksPage>,
    ReturnType<typeof workbookKeys.infiniteList>,
    string | undefined
  >({
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listWorkbooks({ ...input, cursor: pageParam }),
    queryKey: workbookKeys.infiniteList(input),
    ...options,
  });
}

export function useWorkbookQuery(
  workbookId: string,
  options?: Omit<UseQueryOptions<Workbook>, "queryKey" | "queryFn">,
) {
  return useQuery({
    enabled: Boolean(workbookId),
    queryFn: () => getWorkbook(workbookId),
    queryKey: workbookKeys.detail(workbookId),
    ...options,
  });
}

export function useWorkbookCalculationsQuery(
  input: ListWorkbookCalculationsInput,
  options?: Omit<
    UseQueryOptions<WorkbookCalculationsPage>,
    "queryKey" | "queryFn"
  >,
) {
  const { workbookId, ...params } = input;

  return useQuery({
    enabled: Boolean(workbookId),
    queryFn: () => listWorkbookCalculations(input),
    queryKey: workbookKeys.calculationsList(workbookId, params),
    ...options,
  });
}

export function useWorkbookSnapshotsQuery(
  input: ListWorkbookSnapshotsInput,
  options?: Omit<
    UseQueryOptions<WorkbookSnapshotsPage>,
    "queryKey" | "queryFn"
  >,
) {
  const { workbookCalculationId, ...params } = input;

  return useQuery({
    enabled: Boolean(workbookCalculationId),
    queryFn: () => listWorkbookSnapshots(input),
    queryKey: workbookKeys.snapshotsList(workbookCalculationId, params),
    ...options,
  });
}

export function useWorkbookSnapshotMetadataQuery(
  workbookSnapshotId: string,
  options?: Omit<
    UseQueryOptions<WorkbookSnapshotMetadata>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    enabled: Boolean(workbookSnapshotId),
    queryFn: () => getWorkbookSnapshotMetadata(workbookSnapshotId),
    queryKey: workbookKeys.snapshotMetadata(workbookSnapshotId),
    staleTime: IMMUTABLE_WORKBOOK_SNAPSHOT_STALE_TIME_MS,
    ...options,
  });
}

export function useWorkbookSnapshotSheetsQuery(
  input: ListWorkbookSnapshotSheetsInput,
  options?: Omit<
    UseQueryOptions<WorkbookSnapshotSheetsPage>,
    "queryKey" | "queryFn"
  >,
) {
  const { workbookSnapshotId, ...params } = input;

  return useQuery({
    enabled: Boolean(workbookSnapshotId),
    queryFn: () => listWorkbookSnapshotSheets(input),
    queryKey: workbookKeys.snapshotSheets(workbookSnapshotId, params),
    staleTime: IMMUTABLE_WORKBOOK_SNAPSHOT_STALE_TIME_MS,
    ...options,
  });
}

export function useWorkbookSnapshotSheetsInfiniteQuery(
  input: Omit<ListWorkbookSnapshotSheetsInput, "cursor">,
  options?: { enabled?: boolean },
) {
  const { workbookSnapshotId, ...params } = input;
  const { enabled = true, ...queryOptions } = options ?? {};

  return useInfiniteQuery<
    WorkbookSnapshotSheetsPage,
    Error,
    InfiniteData<WorkbookSnapshotSheetsPage>,
    ReturnType<typeof workbookKeys.snapshotSheetsInfinite>,
    string | undefined
  >({
    enabled: enabled && Boolean(workbookSnapshotId),
    queryKey: workbookKeys.snapshotSheetsInfinite(workbookSnapshotId, params),
    queryFn: ({ pageParam }) =>
      listWorkbookSnapshotSheets({ ...input, cursor: pageParam }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: IMMUTABLE_WORKBOOK_SNAPSHOT_STALE_TIME_MS,
    ...queryOptions,
  });
}

export function useWorkbookSnapshotCellsQuery(
  input: GetWorkbookSnapshotCellsInput,
  options?: Omit<
    UseQueryOptions<WorkbookSnapshotCells>,
    "queryKey" | "queryFn"
  >,
) {
  const { workbookSnapshotId, ...params } = input;

  return useQuery({
    enabled: Boolean(workbookSnapshotId),
    queryFn: () => getWorkbookSnapshotCells(input),
    queryKey: workbookKeys.snapshotCells(workbookSnapshotId, params),
    staleTime: IMMUTABLE_WORKBOOK_SNAPSHOT_STALE_TIME_MS,
    ...options,
  });
}

export function useWorkbookSnapshotRangeQuery(
  input: GetWorkbookSnapshotRangeInput,
  options?: Omit<
    UseQueryOptions<WorkbookSnapshotRange>,
    "queryKey" | "queryFn"
  >,
) {
  const { workbookSnapshotId, ...params } = input;

  return useQuery({
    enabled: Boolean(workbookSnapshotId),
    queryFn: () => getWorkbookSnapshotRange(input),
    queryKey: workbookKeys.snapshotRange(workbookSnapshotId, params),
    staleTime: IMMUTABLE_WORKBOOK_SNAPSHOT_STALE_TIME_MS,
    ...options,
  });
}

export function useWorkbookSnapshotRangeBatchQuery(
  input: GetWorkbookSnapshotRangeBatchInput,
  options?: Omit<
    UseQueryOptions<WorkbookSnapshotRangeBatch>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  const { workbookSnapshotId, ...params } = input;
  const { enabled = true, ...queryOptions } = options ?? {};

  return useQuery({
    enabled: enabled && Boolean(workbookSnapshotId) && input.refs.length > 0,
    queryFn: () => getWorkbookSnapshotRangeBatch(input),
    queryKey: workbookKeys.snapshotRangeBatch(workbookSnapshotId, params),
    retry: false,
    staleTime: IMMUTABLE_WORKBOOK_SNAPSHOT_STALE_TIME_MS,
    ...queryOptions,
  });
}

export function useWorkbookSnapshotRangeBatchQueries(
  inputs: GetWorkbookSnapshotRangeBatchInput[],
  options?: { enabled?: boolean },
): WorkbookSnapshotRangeBatch {
  const { enabled = true } = options ?? {};

  return useQueries({
    combine: (results): WorkbookSnapshotRangeBatch => ({
      ranges: results.flatMap(
        (result) =>
          (result.data as WorkbookSnapshotRangeBatch | undefined)?.ranges ?? [],
      ),
    }),
    queries: inputs.map((input) => {
      const { workbookSnapshotId, ...params } = input;

      return {
        enabled:
          enabled && Boolean(workbookSnapshotId) && input.refs.length > 0,
        queryFn: () => getWorkbookSnapshotRangeBatch(input),
        queryKey: workbookKeys.snapshotRangeBatch(workbookSnapshotId, params),
        retry: false,
        staleTime: IMMUTABLE_WORKBOOK_SNAPSHOT_STALE_TIME_MS,
      };
    }),
  });
}

export function useCreateWorkbook(
  options?: UseMutationOptions<Workbook, Error, CreateWorkbookInput>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWorkbook,
    ...options,
    onSuccess: async (workbook, variables, onMutateResult, context) => {
      queryClient.setQueryData(workbookKeys.detail(workbook.id), workbook);
      await queryClient.invalidateQueries({ queryKey: workbookKeys.lists() });
      await options?.onSuccess?.(workbook, variables, onMutateResult, context);
    },
  });
}

export function useUpdateWorkbook(
  options?: UseMutationOptions<Workbook, Error, UpdateWorkbookInput>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateWorkbook,
    ...options,
    onSuccess: async (workbook, variables, onMutateResult, context) => {
      queryClient.setQueryData(workbookKeys.detail(workbook.id), workbook);
      await queryClient.invalidateQueries({ queryKey: workbookKeys.lists() });
      await options?.onSuccess?.(workbook, variables, onMutateResult, context);
    },
  });
}

export function useDeleteWorkbook(
  options?: UseMutationOptions<void, Error, DeleteWorkbookInput>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteWorkbook,
    ...options,
    onSuccess: async (data, variables, onMutateResult, context) => {
      queryClient.removeQueries({
        queryKey: workbookKeys.detail(variables.workbookId),
      });
      await queryClient.invalidateQueries({ queryKey: workbookKeys.lists() });
      await options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useValidateWorkbook(
  options?: UseMutationOptions<Workbook, Error, ValidateWorkbookInput>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: validateWorkbook,
    ...options,
    onSuccess: async (workbook, variables, onMutateResult, context) => {
      queryClient.setQueryData(workbookKeys.detail(workbook.id), workbook);
      await queryClient.invalidateQueries({ queryKey: workbookKeys.lists() });
      await queryClient.invalidateQueries({
        queryKey: workbookKeys.detail(variables.workbookId),
      });
      await options?.onSuccess?.(workbook, variables, onMutateResult, context);
    },
  });
}

export function useCreateWorkbookCalculation(
  options?: UseMutationOptions<
    WorkbookCalculation,
    Error,
    CreateWorkbookCalculationInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWorkbookCalculation,
    ...options,
    onSuccess: async (calculation, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({
        queryKey: workbookKeys.calculations(variables.workbookId),
      });
      await queryClient.invalidateQueries({
        queryKey: workbookKeys.snapshots(calculation.id),
      });
      await options?.onSuccess?.(
        calculation,
        variables,
        onMutateResult,
        context,
      );
    },
  });
}

export function useRetryWorkbookCalculation(
  options?: UseMutationOptions<
    WorkbookCalculation,
    Error,
    RetryWorkbookCalculationInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: retryWorkbookCalculation,
    ...options,
    onSuccess: async (calculation, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: workbookKeys.all });
      await options?.onSuccess?.(
        calculation,
        variables,
        onMutateResult,
        context,
      );
    },
  });
}
