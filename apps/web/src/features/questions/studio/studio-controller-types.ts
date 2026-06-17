import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { QuestionGenerationRun } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import type {
  WorkbookPickerController,
  WorkbookPickerRequest,
  WorkbookRangeSelection,
} from "#/features/questions/table-block-editor";
import type { GenerateQuestionsDialogProps } from "./generation/generation-controller-types";
import type {
  SaveBlueprintDialogInput,
  SaveDialogState,
} from "./save-blueprint-dialog";
import type { SourceController } from "./source/use-source-controller";
import type { StudioReadiness } from "./studio-readiness";
import type { StudioState } from "./studio-state";
import type {
  StudioBlueprintOpenWarningState,
  StudioDraftRecoveryState,
  StudioResetConfirmationState,
} from "./use-blueprint-draft-controller";

export type StudioRouteSearch = {
  workbookId?: string;
  blueprintId?: string;
};

export type StudioController = {
  state: StudioState;
  commandBar: {
    blueprintDescription: string;
    blueprintName: string;
    canGenerate: boolean;
    canRedo: boolean;
    canUndo: boolean;
    generateDisabledReason: string | null;
    isSaving: boolean;
    saveState: "saved" | "unsaved" | "saving" | "autosaved" | "failed";
    saveError: string | null;
    onBlueprintDescriptionChange(description: string): void;
    onBlueprintNameChange(name: string): void;
    onGenerate(): void;
    onOpenSaveDialog(): void;
    onOpenSavedBlueprints(): void;
    onReset(): void;
    onRedo(): void;
    onUndo(): void;
  };
  blueprintOpenWarning: StudioBlueprintOpenWarningState;
  draftRecovery: StudioDraftRecoveryState;
  resetConfirmation: StudioResetConfirmationState;
  source: SourceController;
  editor: {
    authoringModel: ComposedEditorModel;
    referencePreviewCache: ReferencePreviewCache;
    canUseWorkbookTools: boolean;
    onAuthoringModelChange(model: ComposedEditorModel): void;
  };
  savedBlueprints: {
    open: boolean;
    items: Array<{
      id: string;
      title: string;
      description: string | null;
      metadata: string;
    }>;
    isInitialLoading: boolean;
    errorMessage: string | null;
    loadMoreErrorMessage: string | null;
    hasMore: boolean;
    isLoadingMore: boolean;
    onOpenChange(open: boolean): void;
    onRetry(): void;
    onLoadMore(): void;
    onOpenBlueprint(id: string): void;
    onGenerate(id: string): void;
  };
  generationStatus: {
    run: QuestionGenerationRun | null;
    errorMessage: string | null;
    isRetrying: boolean;
    onRetry(): void;
  };
  saveDialog: {
    open: boolean;
    state: SaveDialogState;
    isSaving: boolean;
    onOpenChange(open: boolean): void;
    onSave(input: SaveBlueprintDialogInput): void;
  };
  generateDialog: GenerateQuestionsDialogProps;
  workbookPicker: {
    file: File | null;
    fileName: string;
    open: boolean;
    request: WorkbookPickerRequest | null;
    openWorkbookPicker: WorkbookPickerController["openWorkbookPicker"];
    onOpenChange(open: boolean): void;
    onSelect(selection: WorkbookRangeSelection): void;
  };
  readiness: StudioReadiness;
};
