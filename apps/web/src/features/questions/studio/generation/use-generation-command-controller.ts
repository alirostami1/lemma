import { useState } from "react";
import { useCreateQuestionGenerationRun } from "#/domains/questions";
import { toCreateQuestionGenerationRunInput } from "#/domains/questions/blueprint";
import type { QuestionGenerationRun } from "#/domains/questions/model";
import { notifyQuestionGenerationFailed } from "#/features/notifications";
import type {
  ActiveRunContext,
  GenerateBlueprintSource,
  GenerateQuestionsDialogInput,
  GenerateQuestionsDialogSource,
} from "./generation-controller-types";
import { getGenerateCountIssue } from "./generation-error-state";

type UseGenerationCommandControllerInput = {
  getQuestionSetName(questionSetId: string | null): string | null;
  onGenerationErrorChange(message: string | null): void;
  onRunStarted(run: QuestionGenerationRun, context: ActiveRunContext): void;
};

export function useGenerationCommandController({
  getQuestionSetName,
  onGenerationErrorChange,
  onRunStarted,
}: UseGenerationCommandControllerInput) {
  const {
    mutateAsync: createGeneration,
    isPending: isCreateGenerationPending,
  } = useCreateQuestionGenerationRun();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogSource, setDialogSource] =
    useState<GenerateQuestionsDialogSource | null>(null);

  async function onGenerate(
    dialogInput: GenerateQuestionsDialogInput,
  ): Promise<boolean> {
    onGenerationErrorChange(null);

    if (!dialogSource) {
      return false;
    }

    const countIssue = getGenerateCountIssue(String(dialogInput.count));
    if (countIssue) {
      onGenerationErrorChange(countIssue);
      return false;
    }

    try {
      const result = await createGeneration(
        toCreateQuestionGenerationRunInput({
          blueprintId: dialogSource.blueprintId,
          count: dialogInput.count,
          targetQuestionSetId: dialogInput.targetQuestionSetId,
        }),
      );

      const run = result.questionGenerationRun;
      onRunStarted(run, {
        count: dialogInput.count,
        questionSetId:
          run.targetQuestionSetId ?? dialogInput.targetQuestionSetId,
        questionSetName:
          dialogInput.targetQuestionSetName ??
          getQuestionSetName(dialogInput.targetQuestionSetId),
        runId: run.id,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error && error.message.length > 0
          ? error.message
          : "Questions could not be generated.";
      onGenerationErrorChange(message);
      notifyQuestionGenerationFailed(message);
      return false;
    }
  }

  function onGenerateBlueprint(blueprint: GenerateBlueprintSource) {
    onGenerationErrorChange(null);
    setDialogSource({
      blueprintId: blueprint.id,
      kind: "saved_blueprint",
      name: blueprint.name,
      sources: blueprint.sources,
    });
    setIsDialogOpen(true);
  }

  function onOpenChange(open: boolean) {
    setIsDialogOpen(open);
    if (!open) {
      setDialogSource(null);
    }
  }

  function clearSource() {
    setDialogSource(null);
  }

  return {
    clearSource,
    dialogSource,
    generateDialog: {
      onGenerate,
      onOpenChange,
      open: isDialogOpen,
      source: dialogSource,
    },
    isCreateGenerationPending,
    onGenerateBlueprint,
  };
}
