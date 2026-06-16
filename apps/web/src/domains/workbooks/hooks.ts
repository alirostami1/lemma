import {
  type UseMutationOptions,
  type UseQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createWorkbook,
  createWorkbookCalculation,
  deleteWorkbook,
  getWorkbook,
  listWorkbookCalculations,
  listWorkbookSnapshots,
  listWorkbooks,
  updateWorkbook,
  validateWorkbook,
} from "./api";
import { workbookKeys } from "./keys";
import type {
  CreateWorkbookCalculationInput,
  CreateWorkbookInput,
  DeleteWorkbookInput,
  ListWorkbookCalculationsInput,
  ListWorkbookSnapshotsInput,
  ListWorkbooksInput,
  UpdateWorkbookInput,
  ValidateWorkbookInput,
  Workbook,
  WorkbookCalculation,
  WorkbookCalculationsPage,
  WorkbookSnapshotsPage,
  WorkbooksPage,
} from "./model";

export function useWorkbooksQuery(
  input?: ListWorkbooksInput,
  options?: Omit<UseQueryOptions<WorkbooksPage>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: workbookKeys.list(input),
    queryFn: () => listWorkbooks(input),
    ...options,
  });
}

export function useWorkbooksInfiniteQuery(
  input?: Omit<ListWorkbooksInput, "cursor">,
  options?: { enabled?: boolean },
) {
  return useInfiniteQuery({
    queryKey: workbookKeys.infiniteList(input),
    queryFn: ({ pageParam }) => listWorkbooks({ ...input, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    ...options,
  });
}

export function useWorkbookQuery(
  workbookId: string,
  options?: Omit<UseQueryOptions<Workbook>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: workbookKeys.detail(workbookId),
    queryFn: () => getWorkbook(workbookId),
    enabled: Boolean(workbookId),
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
    queryKey: workbookKeys.calculationsList(workbookId, params),
    queryFn: () => listWorkbookCalculations(input),
    enabled: Boolean(workbookId),
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
    queryKey: workbookKeys.snapshotsList(workbookCalculationId, params),
    queryFn: () => listWorkbookSnapshots(input),
    enabled: Boolean(workbookCalculationId),
    ...options,
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
