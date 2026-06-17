import {
  type UseMutationOptions,
  type UseQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  createQuestionBlueprint,
  createQuestionGenerationRun,
  createQuestionSet,
  getQuestion,
  getQuestionBlueprint,
  getQuestionBlueprintAuthoring,
  getQuestionGenerationRun,
  getQuestionSet,
  gradeQuestion,
  listQuestionBlueprints,
  listQuestionSetQuestions,
  listQuestionSets,
  retryQuestionGenerationRun,
  updateQuestionBlueprint,
} from "./api";
import { questionKeys } from "./keys";
import type {
  CreateQuestionBlueprintInput,
  CreateQuestionGenerationRunInput,
  CreateQuestionSetInput,
  GetQuestionBlueprintInput,
  GetQuestionGenerationRunInput,
  GetQuestionInput,
  GradeQuestionInput,
  ListQuestionBlueprintsInput,
  ListQuestionSetItemsInput,
  ListQuestionSetsInput,
  QuestionBlueprintAuthoringResult,
  QuestionBlueprintResult,
  QuestionBlueprintsPage,
  QuestionGenerationRunResult,
  QuestionGradeResult,
  QuestionResult,
  QuestionSetResult,
  QuestionSetsPage,
  RetryQuestionGenerationRunInput,
  UpdateQuestionBlueprintInput,
} from "./model";

export function useQuestionSetsQuery(
  input?: ListQuestionSetsInput,
  options?: Omit<UseQueryOptions<QuestionSetsPage>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: questionKeys.questionSetList(input),
    queryFn: () => listQuestionSets(input),
    ...options,
  });
}

export function useQuestionSetNameLookup() {
  const query = useQuestionSetsQuery({ limit: 100 });
  const namesById = useMemo(
    () =>
      new Map(
        (query.data?.questionSets ?? []).map((questionSet) => [
          questionSet.id,
          questionSet.name,
        ]),
      ),
    [query.data?.questionSets],
  );

  return useCallback(
    (questionSetId: string | null) =>
      questionSetId ? (namesById.get(questionSetId) ?? null) : null,
    [namesById],
  );
}

export function useQuestionSetsInfiniteQuery(
  input?: Omit<ListQuestionSetsInput, "cursor">,
  options?: { enabled?: boolean },
) {
  return useInfiniteQuery({
    queryKey: questionKeys.questionSetInfiniteList(input),
    queryFn: ({ pageParam }) =>
      listQuestionSets({ ...input, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    ...options,
  });
}

export function useQuestionSetQuery(
  questionSetId: string,
  options?: Omit<UseQueryOptions<QuestionSetResult>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: questionKeys.questionSetDetail(questionSetId),
    queryFn: () => getQuestionSet(questionSetId),
    enabled: Boolean(questionSetId),
    ...options,
  });
}

export function useQuestionSetQuestionsInfiniteQuery(
  input: Omit<ListQuestionSetItemsInput, "cursor">,
  options?: { enabled?: boolean },
) {
  const params = { limit: input.limit };

  return useInfiniteQuery({
    queryKey: questionKeys.questionSetQuestionsInfiniteList(
      input.questionSetId,
      params,
    ),
    queryFn: ({ pageParam }) =>
      listQuestionSetQuestions({ ...input, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(input.questionSetId),
    ...options,
  });
}

export function useQuestionQuery(
  input: GetQuestionInput,
  options?: Omit<UseQueryOptions<QuestionResult>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: questionKeys.questionDetail(input.questionId),
    queryFn: () => getQuestion(input),
    enabled: Boolean(input.questionId),
    ...options,
  });
}

export function useGradeQuestion(
  options?: UseMutationOptions<QuestionGradeResult, Error, GradeQuestionInput>,
) {
  return useMutation({
    mutationFn: gradeQuestion,
    ...options,
  });
}

export function useQuestionBlueprintsQuery(
  input?: ListQuestionBlueprintsInput,
  options?: Omit<
    UseQueryOptions<QuestionBlueprintsPage>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: questionKeys.questionBlueprintsList(input),
    queryFn: () => listQuestionBlueprints(input),
    ...options,
  });
}

export function useQuestionBlueprintsInfiniteQuery(
  input?: Omit<ListQuestionBlueprintsInput, "cursor">,
  options?: { enabled?: boolean },
) {
  return useInfiniteQuery({
    queryKey: questionKeys.questionBlueprintsInfiniteList(input),
    queryFn: ({ pageParam }) =>
      listQuestionBlueprints({ ...input, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    ...options,
  });
}

export function useQuestionBlueprintQuery(
  input: GetQuestionBlueprintInput,
  options?: Omit<
    UseQueryOptions<QuestionBlueprintResult>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: questionKeys.questionBlueprintDetail(input.questionBlueprintId),
    queryFn: () => getQuestionBlueprint(input),
    enabled: Boolean(input.questionBlueprintId),
    ...options,
  });
}

export function useQuestionBlueprintAuthoringQuery(
  input: GetQuestionBlueprintInput,
  options?: Omit<
    UseQueryOptions<QuestionBlueprintAuthoringResult>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: questionKeys.questionBlueprintAuthoring(
      input.questionBlueprintId,
    ),
    queryFn: () => getQuestionBlueprintAuthoring(input),
    enabled: Boolean(input.questionBlueprintId),
    ...options,
  });
}

export function useQuestionGenerationRunQuery(
  input: GetQuestionGenerationRunInput,
  options?: Omit<
    UseQueryOptions<QuestionGenerationRunResult>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: questionKeys.generationRunDetail(input.questionGenerationRunId),
    queryFn: () => getQuestionGenerationRun(input),
    enabled: Boolean(input.questionGenerationRunId),
    ...options,
  });
}

export function useQuestionGenerationRunStatusQuery(
  input: GetQuestionGenerationRunInput,
  options?: Omit<
    UseQueryOptions<QuestionGenerationRunResult>,
    "queryKey" | "queryFn"
  >,
) {
  const queryClient = useQueryClient();
  const invalidatedSucceededRunsRef = useRef(new Set<string>());
  const query = useQuestionGenerationRunQuery(input, options);
  const run = query.data?.questionGenerationRun;
  const runId = run?.id;
  const runStatus = run?.status;
  const targetQuestionSetId = run?.targetQuestionSetId;

  useEffect(() => {
    if (
      !runId ||
      runStatus !== "succeeded" ||
      !targetQuestionSetId ||
      invalidatedSucceededRunsRef.current.has(runId)
    ) {
      return;
    }

    invalidatedSucceededRunsRef.current.add(runId);
    void queryClient.invalidateQueries({
      queryKey: questionKeys.questionSetQuestions(targetQuestionSetId),
    });
  }, [queryClient, runId, runStatus, targetQuestionSetId]);

  return query;
}

export function useCreateQuestionSet(
  options?: UseMutationOptions<
    QuestionSetResult,
    Error,
    CreateQuestionSetInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createQuestionSet,
    ...options,
    onSuccess: async (result, variables, onMutateResult, context) => {
      queryClient.setQueryData(
        questionKeys.questionSetDetail(result.questionSet.id),
        result,
      );
      await queryClient.invalidateQueries({
        queryKey: questionKeys.questionSets(),
      });
      await options?.onSuccess?.(result, variables, onMutateResult, context);
    },
  });
}

export function useCreateQuestionBlueprint(
  options?: UseMutationOptions<
    QuestionBlueprintResult,
    Error,
    CreateQuestionBlueprintInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createQuestionBlueprint,
    ...options,
    onSuccess: async (result, variables, onMutateResult, context) => {
      queryClient.setQueryData(
        questionKeys.questionBlueprintDetail(result.questionBlueprint.id),
        result,
      );
      await queryClient.invalidateQueries({
        queryKey: questionKeys.questionBlueprintAuthoring(
          result.questionBlueprint.id,
        ),
      });
      await queryClient.invalidateQueries({
        queryKey: questionKeys.questionBlueprints(),
      });
      await options?.onSuccess?.(result, variables, onMutateResult, context);
    },
  });
}

export function useUpdateQuestionBlueprint(
  options?: UseMutationOptions<
    QuestionBlueprintResult,
    Error,
    UpdateQuestionBlueprintInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateQuestionBlueprint,
    ...options,
    onSuccess: async (result, variables, onMutateResult, context) => {
      queryClient.setQueryData(
        questionKeys.questionBlueprintDetail(result.questionBlueprint.id),
        result,
      );
      await queryClient.invalidateQueries({
        queryKey: questionKeys.questionBlueprintAuthoring(
          result.questionBlueprint.id,
        ),
      });
      await queryClient.invalidateQueries({
        queryKey: questionKeys.questionBlueprints(),
      });
      await options?.onSuccess?.(result, variables, onMutateResult, context);
    },
  });
}

export function useCreateQuestionGenerationRun(
  options?: UseMutationOptions<
    QuestionGenerationRunResult,
    Error,
    CreateQuestionGenerationRunInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createQuestionGenerationRun,
    ...options,
    onSuccess: async (result, variables, onMutateResult, context) => {
      queryClient.setQueryData(
        questionKeys.generationRunDetail(result.questionGenerationRun.id),
        result,
      );
      if (variables.targetQuestionSetId) {
        await queryClient.invalidateQueries({
          queryKey: questionKeys.questionSetQuestions(
            variables.targetQuestionSetId,
          ),
        });
      }
      await options?.onSuccess?.(result, variables, onMutateResult, context);
    },
  });
}

export function useRetryQuestionGenerationRun(
  options?: UseMutationOptions<
    QuestionGenerationRunResult,
    Error,
    RetryQuestionGenerationRunInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: retryQuestionGenerationRun,
    ...options,
    onSuccess: async (result, variables, onMutateResult, context) => {
      queryClient.setQueryData(
        questionKeys.generationRunDetail(result.questionGenerationRun.id),
        result,
      );
      const questionSetId =
        result.questionGenerationRun.targetQuestionSetId ??
        variables.questionSetId;
      if (questionSetId) {
        await queryClient.invalidateQueries({
          queryKey: questionKeys.questionSetQuestions(questionSetId),
        });
      }
      await options?.onSuccess?.(result, variables, onMutateResult, context);
    },
  });
}
