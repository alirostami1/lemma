import { useEffect, useMemo, useRef, useState } from "react";
import {
  useCreateQuestionSet,
  useQuestionSetsQuery,
} from "#/domains/questions";
import type { QuestionSet } from "#/domains/questions/model";
import type {
  GenerateQuestionsDialogInput,
  GenerateQuestionsDialogProps,
  GenerateQuestionsDialogSource,
} from "./generation-controller-types";
import { getGenerateCountIssue } from "./generation-error-state";
import { CREATE_NEW_VALUE } from "./generation-target-section";

type Input = {
  open: boolean;
  source: GenerateQuestionsDialogSource | null;
  errorMessage: string | null;
  isGenerating: boolean;
  onOpenChange(open: boolean): void;
  onGenerate(input: GenerateQuestionsDialogInput): Promise<boolean>;
};

export function useGenerateQuestionsDialogController(
  input: Input,
): GenerateQuestionsDialogProps {
  const createQuestionSet = useCreateQuestionSet();
  const questionSetsQuery = useQuestionSetsQuery({ limit: 100 });
  const questionSets = useMemo(
    () => getQuestionSetsForGeneration(questionSetsQuery.data?.questionSets),
    [questionSetsQuery.data?.questionSets],
  );
  const [countInput, setCountInput] = useState("1");
  const [questionSetMode, setQuestionSetMode] = useState<
    "existing" | "create_new"
  >("existing");
  const [selectedQuestionSetId, setSelectedQuestionSetId] = useState("");
  const [newQuestionSetName, setNewQuestionSetName] = useState("");
  const [newQuestionSetDescription, setNewQuestionSetDescription] =
    useState("");
  const [submitError, setSubmitError] = useState<string | null>(
    input.errorMessage,
  );
  const hasInitializedSelectionRef = useRef(false);

  useEffect(() => {
    if (!input.open) {
      hasInitializedSelectionRef.current = false;
      return;
    }
    if (!questionSetsQuery.isFetched || hasInitializedSelectionRef.current) {
      return;
    }
    hasInitializedSelectionRef.current = true;
    setCountInput("1");
    setSubmitError(input.errorMessage);
    setNewQuestionSetName("");
    setNewQuestionSetDescription("");
    setQuestionSetMode(questionSets.length > 0 ? "existing" : "create_new");
    setSelectedQuestionSetId(questionSets[0]?.id ?? "");
  }, [
    input.errorMessage,
    input.open,
    questionSets,
    questionSetsQuery.isFetched,
  ]);

  useEffect(() => {
    if (input.open) {
      setSubmitError(input.errorMessage);
    }
  }, [input.errorMessage, input.open]);

  const countIssue = getGenerateCountIssue(countInput);
  const existingQuestionSetIssue =
    questionSetMode === "existing" && selectedQuestionSetId.length === 0
      ? "Select a question set."
      : null;
  const newQuestionSetNameIssue =
    questionSetMode === "create_new" && newQuestionSetName.trim().length === 0
      ? "Question set name is required."
      : null;
  const disabledIssue =
    countIssue ?? existingQuestionSetIssue ?? newQuestionSetNameIssue;
  const isSubmitting = input.isGenerating || createQuestionSet.isPending;

  async function onSubmit() {
    setSubmitError(null);
    if (disabledIssue) {
      setSubmitError(disabledIssue);
      return;
    }

    let targetQuestionSetId = selectedQuestionSetId;
    let targetQuestionSetName =
      questionSets.find(
        (questionSet) => questionSet.id === selectedQuestionSetId,
      )?.name ?? null;
    if (questionSetMode === "create_new") {
      try {
        const result = await createQuestionSet.mutateAsync({
          name: newQuestionSetName.trim(),
          description: newQuestionSetDescription.trim() || null,
        });
        targetQuestionSetId = result.questionSet.id;
        targetQuestionSetName = result.questionSet.name;
      } catch {
        setSubmitError("Question set could not be created.");
        return;
      }
    }

    if (
      await input.onGenerate({
        count: Number(countInput),
        targetQuestionSetId,
        targetQuestionSetName,
      })
    ) {
      input.onOpenChange(false);
      return;
    }
    setSubmitError((current) => current ?? "Questions could not be generated.");
  }

  return {
    open: input.open,
    source: input.source,
    questionSets,
    questionSetsLoading: questionSetsQuery.isLoading,
    questionSetsErrorMessage:
      questionSetsQuery.isError && !questionSetsQuery.data
        ? "Question sets could not be loaded."
        : null,
    questionSetMode,
    selectedQuestionSetId,
    newQuestionSetName,
    newQuestionSetDescription,
    countInput,
    isSubmitting,
    isGenerateDisabled: isSubmitting || disabledIssue !== null,
    countIssue,
    existingQuestionSetIssue,
    newQuestionSetNameIssue,
    submitError,
    onOpenChange: input.onOpenChange,
    onSubmit: () => {
      void onSubmit();
    },
    onQuestionSetValueChange: (value) => {
      if (value === CREATE_NEW_VALUE) {
        setQuestionSetMode("create_new");
        return;
      }
      setQuestionSetMode("existing");
      setSelectedQuestionSetId(value);
    },
    onNewQuestionSetNameChange: setNewQuestionSetName,
    onNewQuestionSetDescriptionChange: setNewQuestionSetDescription,
    onCountInputChange: setCountInput,
  };
}

export function getQuestionSetsForGeneration(
  questionSets: QuestionSet[] | undefined,
) {
  return [...(questionSets ?? [])]
    .filter((questionSet) => questionSet.status !== "deleted")
    .sort(
      (left, right) =>
        right.updatedAt.getTime() - left.updatedAt.getTime() ||
        right.createdAt.getTime() - left.createdAt.getTime(),
    );
}
