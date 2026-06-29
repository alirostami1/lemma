import {
  type InfiniteData,
  type UseMutationOptions,
  type UseQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  attachQuestionBlueprintDraftSourceFile,
  completeQuestionBlueprintDraftWorkbookEditorUpload,
  createQuestionBlueprintDraft,
  createQuestionBlueprintDraftWorkbookEditorUpload,
  createQuestionBlueprintEditDraft,
  createQuestionGenerationRun,
  createQuestionSet,
  getQuestion,
  getQuestionBlueprint,
  getQuestionBlueprintAuthoring,
  getQuestionBlueprintDraft,
  getQuestionGenerationRun,
  getQuestionSet,
  gradeQuestion,
  listQuestionBlueprintDraftSummaries,
  listQuestionBlueprints,
  listQuestionSetQuestions,
  listQuestionSets,
  publishQuestionBlueprintDraft,
  retryQuestionGenerationRun,
  saveQuestionBlueprintDraftWorkbookSourceRevision,
  updateQuestionBlueprintDraft,
} from "./api";
import { questionKeys } from "./keys";
import type {
  AttachQuestionBlueprintDraftSourceFileInput,
  CompleteQuestionBlueprintDraftWorkbookEditorUploadInput,
  CompleteQuestionBlueprintDraftWorkbookEditorUploadResult,
  CreateQuestionBlueprintDraftInput,
  CreateQuestionBlueprintDraftWorkbookEditorUploadInput,
  CreateQuestionBlueprintDraftWorkbookEditorUploadResult,
  CreateQuestionBlueprintEditDraftInput,
  CreateQuestionGenerationRunInput,
  CreateQuestionSetInput,
  GetQuestionBlueprintInput,
  GetQuestionGenerationRunInput,
  GetQuestionInput,
  GradeQuestionInput,
  ListQuestionBlueprintDraftsInput,
  ListQuestionBlueprintsInput,
  ListQuestionSetItemsInput,
  ListQuestionSetsInput,
  PublishQuestionBlueprintDraftInput,
  PublishQuestionBlueprintDraftResult,
  QuestionBlueprintAuthoringResult,
  QuestionBlueprintDraftResult,
  QuestionBlueprintDraftSummariesPage,
  QuestionBlueprintEditDraftResult,
  QuestionBlueprintResult,
  QuestionBlueprintsPage,
  QuestionGenerationRunResult,
  QuestionGradeResult,
  QuestionResult,
  QuestionSetResult,
  QuestionSetsPage,
  QuestionsPage,
  RetryQuestionGenerationRunInput,
  SaveQuestionBlueprintDraftWorkbookSourceRevisionInput,
  SaveQuestionBlueprintDraftWorkbookSourceRevisionResult,
  UpdateQuestionBlueprintDraftInput,
} from "./model";

export function useQuestionBlueprintDraftQuery(
  draftId: string,
  options?: Omit<
    UseQueryOptions<QuestionBlueprintDraftResult>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    enabled: Boolean(draftId),
    queryFn: () => getQuestionBlueprintDraft(draftId),
    queryKey: questionKeys.questionBlueprintDraftDetail(draftId),
    ...options,
  });
}

export function useCreateQuestionBlueprintDraft(
  options?: UseMutationOptions<
    QuestionBlueprintDraftResult,
    Error,
    CreateQuestionBlueprintDraftInput
  >,
) {
  return useMutation({ mutationFn: createQuestionBlueprintDraft, ...options });
}

export function useCreateQuestionBlueprintEditDraft(
  options?: UseMutationOptions<
    QuestionBlueprintEditDraftResult,
    Error,
    CreateQuestionBlueprintEditDraftInput
  >,
) {
  return useMutation({
    mutationFn: createQuestionBlueprintEditDraft,
    ...options,
  });
}

export function useUpdateQuestionBlueprintDraft(
  options?: UseMutationOptions<
    QuestionBlueprintDraftResult,
    Error,
    UpdateQuestionBlueprintDraftInput
  >,
) {
  return useMutation({ mutationFn: updateQuestionBlueprintDraft, ...options });
}

export function useAttachQuestionBlueprintDraftSourceFile(
  options?: UseMutationOptions<
    QuestionBlueprintDraftResult,
    Error,
    AttachQuestionBlueprintDraftSourceFileInput
  >,
) {
  return useMutation({
    mutationFn: attachQuestionBlueprintDraftSourceFile,
    ...options,
  });
}

export function useSaveQuestionBlueprintDraftWorkbookSourceRevision(
  options?: UseMutationOptions<
    SaveQuestionBlueprintDraftWorkbookSourceRevisionResult,
    Error,
    SaveQuestionBlueprintDraftWorkbookSourceRevisionInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveQuestionBlueprintDraftWorkbookSourceRevision,
    ...options,
    onSuccess: async (result, variables, onMutateResult, context) => {
      queryClient.setQueryData(
        questionKeys.questionBlueprintDraftDetail(result.draft.id),
        { draft: result.draft },
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: questionKeys.questionBlueprintDraftInfiniteLists(),
        }),
        queryClient.invalidateQueries({
          queryKey: questionKeys.questionBlueprintDraftLists(),
        }),
      ]);
      await options?.onSuccess?.(result, variables, onMutateResult, context);
    },
  });
}

export function useCreateQuestionBlueprintDraftWorkbookEditorUpload(
  options?: UseMutationOptions<
    CreateQuestionBlueprintDraftWorkbookEditorUploadResult,
    Error,
    CreateQuestionBlueprintDraftWorkbookEditorUploadInput
  >,
) {
  return useMutation({
    mutationFn: createQuestionBlueprintDraftWorkbookEditorUpload,
    ...options,
  });
}

export function useCompleteQuestionBlueprintDraftWorkbookEditorUpload(
  options?: UseMutationOptions<
    CompleteQuestionBlueprintDraftWorkbookEditorUploadResult,
    Error,
    CompleteQuestionBlueprintDraftWorkbookEditorUploadInput
  >,
) {
  return useMutation({
    mutationFn: completeQuestionBlueprintDraftWorkbookEditorUpload,
    ...options,
  });
}

export function usePublishQuestionBlueprintDraft(
  options?: UseMutationOptions<
    PublishQuestionBlueprintDraftResult,
    Error,
    PublishQuestionBlueprintDraftInput
  >,
) {
  return useMutation({
    mutationFn: publishQuestionBlueprintDraft,
    ...options,
  });
}

export function useQuestionSetsQuery(
  input?: ListQuestionSetsInput,
  options?: Omit<UseQueryOptions<QuestionSetsPage>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryFn: () => listQuestionSets(input),
    queryKey: questionKeys.questionSetList(input),
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
  return useInfiniteQuery<
    QuestionSetsPage,
    Error,
    InfiniteData<QuestionSetsPage>,
    ReturnType<typeof questionKeys.questionSetInfiniteList>,
    string | undefined
  >({
    queryKey: questionKeys.questionSetInfiniteList(input),
    queryFn: ({ pageParam }) =>
      listQuestionSets({ ...input, cursor: pageParam }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    ...options,
  });
}

export function useQuestionSetQuery(
  questionSetId: string,
  options?: Omit<UseQueryOptions<QuestionSetResult>, "queryKey" | "queryFn">,
) {
  return useQuery({
    enabled: Boolean(questionSetId),
    queryFn: () => getQuestionSet(questionSetId),
    queryKey: questionKeys.questionSetDetail(questionSetId),
    ...options,
  });
}

export function useQuestionSetQuestionsInfiniteQuery(
  input: Omit<ListQuestionSetItemsInput, "cursor">,
  options?: { enabled?: boolean },
) {
  const params = { limit: input.limit };

  return useInfiniteQuery<
    QuestionsPage,
    Error,
    InfiniteData<QuestionsPage>,
    ReturnType<typeof questionKeys.questionSetQuestionsInfiniteList>,
    string | undefined
  >({
    enabled: Boolean(input.questionSetId),
    queryKey: questionKeys.questionSetQuestionsInfiniteList(
      input.questionSetId,
      params,
    ),
    queryFn: ({ pageParam }) =>
      listQuestionSetQuestions({ ...input, cursor: pageParam }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    ...options,
  });
}

export function useQuestionQuery(
  input: GetQuestionInput,
  options?: Omit<UseQueryOptions<QuestionResult>, "queryKey" | "queryFn">,
) {
  return useQuery({
    enabled: Boolean(input.questionId),
    queryFn: () => getQuestion(input),
    queryKey: questionKeys.questionDetail(input.questionId),
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
    queryFn: () => listQuestionBlueprints(input),
    queryKey: questionKeys.questionBlueprintsList(input),
    ...options,
  });
}

export function useQuestionBlueprintsInfiniteQuery(
  input?: Omit<ListQuestionBlueprintsInput, "cursor">,
  options?: { enabled?: boolean },
) {
  return useInfiniteQuery<
    QuestionBlueprintsPage,
    Error,
    InfiniteData<QuestionBlueprintsPage>,
    ReturnType<typeof questionKeys.questionBlueprintsInfiniteList>,
    string | undefined
  >({
    queryKey: questionKeys.questionBlueprintsInfiniteList(input),
    queryFn: ({ pageParam }) =>
      listQuestionBlueprints({ ...input, cursor: pageParam }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    ...options,
  });
}

export function useQuestionBlueprintDraftsInfiniteQuery(
  input?: Omit<ListQuestionBlueprintDraftsInput, "cursor">,
  options?: { enabled?: boolean },
) {
  return useInfiniteQuery<
    QuestionBlueprintDraftSummariesPage,
    Error,
    InfiniteData<QuestionBlueprintDraftSummariesPage>,
    ReturnType<typeof questionKeys.questionBlueprintDraftsInfiniteList>,
    string | undefined
  >({
    queryKey: questionKeys.questionBlueprintDraftsInfiniteList(input),
    queryFn: ({ pageParam }) =>
      listQuestionBlueprintDraftSummaries({ ...input, cursor: pageParam }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
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
    enabled: Boolean(input.questionBlueprintId),
    queryFn: () => getQuestionBlueprint(input),
    queryKey: questionKeys.questionBlueprintDetail(input.questionBlueprintId),
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
    enabled: Boolean(input.questionBlueprintId),
    queryFn: () => getQuestionBlueprintAuthoring(input),
    queryKey: questionKeys.questionBlueprintAuthoring(
      input.questionBlueprintId,
    ),
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
    enabled: Boolean(input.questionGenerationRunId),
    queryFn: () => getQuestionGenerationRun(input),
    queryKey: questionKeys.generationRunDetail(input.questionGenerationRunId),
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
