import { useCallback, useMemo, useState } from "react";
import {
  useCreateQuestionBlueprint,
  useUpdateQuestionBlueprint,
} from "#/domains/questions";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  toCreateQuestionBlueprintInput,
  toUpdateQuestionBlueprintInput,
} from "#/domains/questions/blueprint";
import { buildQuestionBlueprintDraft } from "#/domains/questions/blueprint-draft";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import {
  notifyBlueprintSaved,
  notifyBlueprintSaveFailed,
} from "#/features/notifications";
import type {
  SaveBlueprintDialogInput,
  SaveDialogState,
} from "./save-blueprint-dialog";
import {
  getFirstReadinessIssueMessage,
  type StudioReadiness,
} from "./studio-readiness";

type UseSaveBlueprintControllerInput = {
  authoringModel: ComposedEditorModel;
  blueprintDescription: string;
  blueprintName: string;
  hasUnsavedChanges: boolean;
  loadedBlueprintId: string | null;
  sources: QuestionBlueprintWorkbookSource[];
  onSaved(input: {
    blueprintDescription: string;
    blueprintId: string;
    blueprintName: string;
    blueprintVersionId?: string | null;
    sources: QuestionBlueprintWorkbookSource[];
  }): void;
  readiness: StudioReadiness;
};

export type SaveBlueprintController = {
  commandBarSave: {
    isSaving: boolean;
    saveError: string | null;
    onOpenSaveDialog(): void;
  };
  clearMessages(): void;
  saveDialog: {
    open: boolean;
    state: SaveDialogState;
    isSaving: boolean;
    onOpenChange(open: boolean): void;
    onSave(input: SaveBlueprintDialogInput): void;
  };
  saveDocumentIssue: string | null;
};

export function useSaveBlueprintController({
  authoringModel,
  blueprintDescription,
  blueprintName,
  hasUnsavedChanges,
  loadedBlueprintId,
  onSaved,
  sources,
  readiness,
}: UseSaveBlueprintControllerInput): SaveBlueprintController {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { mutateAsync: createBlueprint, isPending: isCreateBlueprintPending } =
    useCreateQuestionBlueprint();
  const { mutateAsync: updateBlueprint, isPending: isUpdateBlueprintPending } =
    useUpdateQuestionBlueprint();

  const isSaving = isCreateBlueprintPending || isUpdateBlueprintPending;
  const hasExistingBlueprint = loadedBlueprintId !== null;
  const saveDocumentIssue = getFirstReadinessIssueMessage(readiness, "save");

  const saveDialogState: SaveDialogState = useMemo(
    () => ({
      hasExistingBlueprint,
      isDirty: hasUnsavedChanges,
      currentName: blueprintName,
      validationIssue: saveDocumentIssue,
    }),
    [blueprintName, hasExistingBlueprint, hasUnsavedChanges, saveDocumentIssue],
  );

  const clearMessages = useCallback(() => {
    setSaveError(null);
  }, []);

  async function saveBlueprint(
    mode: "update_existing" | "save_as_new",
    nameOverride?: string,
  ) {
    clearMessages();
    if (saveDocumentIssue) {
      setSaveError(saveDocumentIssue);
      return false;
    }

    const draft = buildQuestionBlueprintDraft({
      description: blueprintDescription,
      model: authoringModel,
      name: nameOverride ?? blueprintName,
      sources,
    });
    if (!draft.ok) {
      if (draft.code === "missing_name") {
        setSaveError("Add a blueprint name.");
        return false;
      }

      setSaveError(
        draft.cause instanceof Error && draft.cause.message.length > 0
          ? draft.cause.message
          : "Blueprint is invalid.",
      );
      return false;
    }

    try {
      const result =
        mode === "update_existing" && hasExistingBlueprint
          ? await updateBlueprint(
              toUpdateQuestionBlueprintInput({
                ...draft.value,
                questionBlueprintId: loadedBlueprintId ?? "",
              }),
            )
          : await createBlueprint(toCreateQuestionBlueprintInput(draft.value));
      const savedBlueprint = result.questionBlueprint;

      onSaved({
        blueprintDescription: savedBlueprint.description ?? "",
        blueprintId: savedBlueprint.id,
        blueprintName: savedBlueprint.name,
        blueprintVersionId: savedBlueprint.currentVersionId ?? null,
        sources: savedBlueprint.sources,
      });
      notifyBlueprintSaved();
      return true;
    } catch (error) {
      const message =
        error instanceof Error && error.message.length > 0
          ? error.message
          : null;
      notifyBlueprintSaveFailed(message);
      setSaveError(message ?? "Blueprint could not be saved.");
      return false;
    }
  }

  return {
    commandBarSave: {
      isSaving,
      saveError,
      onOpenSaveDialog: () => {
        clearMessages();
        setIsSaveDialogOpen(true);
      },
    },
    clearMessages,
    saveDialog: {
      open: isSaveDialogOpen,
      state: saveDialogState,
      isSaving,
      onOpenChange: setIsSaveDialogOpen,
      onSave: (dialogInput) => {
        void saveBlueprint(dialogInput.mode, dialogInput.name).then((saved) => {
          if (saved) {
            setIsSaveDialogOpen(false);
          }
        });
      },
    },
    saveDocumentIssue,
  };
}
