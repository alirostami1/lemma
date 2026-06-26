import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import type { LocalWorkbookParseResult } from "#/domains/workbooks/local-xlsx";
import type {
  WorkbookPickerController,
  WorkbookPickerRequest,
  WorkbookRangeSelection,
} from "#/features/questions/table-block-editor";
import type { WorkbookPickerSheet } from "#/features/questions/use-workbook-picker-cells";
import type { PublishDraftDialogState } from "./publish-draft-dialog";
import type { SavedBlueprintsDialogBlueprintAction } from "./saved-blueprints-dialog";
import type {
  SavedBlueprintListItem,
  SavedDraftListItem,
} from "./saved-blueprints-view-model";
import type { SourceController } from "./source/use-source-controller";
import type { StudioReadiness } from "./studio-readiness";
import type {
  StudioRouteIntent,
  StudioRouteSearch,
} from "./studio-route-intent";
import type { StudioState } from "./studio-state";
import type {
  StudioDraftLoadState,
  StudioDraftRecoveryState,
  StudioResetConfirmationState,
} from "./use-blueprint-draft-controller";
import type { DraftSaveConflict } from "./use-studio-draft-save-controller";

export type { StudioRouteIntent, StudioRouteSearch };

export type StudioController = {
  routeIntent: StudioRouteIntent;
  draftLoadState: StudioDraftLoadState;
  state: StudioState;
  commandBar: {
    blueprintDescription: string;
    blueprintName: string;
    canGenerate: boolean;
    routeSearch: StudioRouteSearch;
    canRedo: boolean;
    canUndo: boolean;
    generateDisabledReason: string | null;
    isSaving: boolean;
    isPublishing: boolean;
    saveState: "saved" | "unsaved" | "saving" | "autosaved" | "failed";
    saveError: string | null;
    saveConflict: DraftSaveConflict | null;
    onBlueprintDescriptionChange(description: string): void;
    onBlueprintNameChange(name: string): void;
    onOpenPublishDialog(): void;
    onReloadLatestDraft(): void;
    onSaveDraft(): void;
    onOpenSavedBlueprints(): void;
    onReset(): void;
    onRedo(): void;
    onUndo(): void;
  };
  draftRecovery: StudioDraftRecoveryState;
  resetConfirmation: StudioResetConfirmationState;
  source: SourceController;
  editor: {
    authoringModel: ComposedEditorModel;
    referencePreviewCache: ReferencePreviewCache;
    canUseWorkbookTools: boolean;
    sources: QuestionBlueprintWorkbookSource[];
    workbookSheetNamesBySourceId: Readonly<Record<string, readonly string[]>>;
    onAuthoringModelChange(model: ComposedEditorModel): void;
  };
  savedBlueprints: {
    open: boolean;
    drafts: SavedDraftListItem[];
    isDraftsInitialLoading: boolean;
    draftsErrorMessage: string | null;
    draftLoadMoreErrorMessage: string | null;
    hasMoreDrafts: boolean;
    isLoadingDraftsMore: boolean;
    blueprints: SavedBlueprintListItem[];
    isInitialLoading: boolean;
    errorMessage: string | null;
    loadMoreErrorMessage: string | null;
    hasMoreBlueprints: boolean;
    isLoadingBlueprintsMore: boolean;
    onOpenChange(open: boolean): void;
    onRetry(): void;
    onLoadMoreDrafts(): void;
    onLoadMoreBlueprints(): void;
    onOpenDraft(id: string): void;
    blueprintAction: SavedBlueprintsDialogBlueprintAction;
  };
  publishDialog: {
    open: boolean;
    state: PublishDraftDialogState;
    isSavingBeforePublish: boolean;
    isPublishing: boolean;
    onOpenChange(open: boolean): void;
    onPublish(): void;
  };
  workbookPicker: {
    localWorkbook: LocalWorkbookParseResult | null;
    workbookSnapshotId: string | null;
    workbookSheets: WorkbookPickerSheet[];
    hasMoreWorkbookSheets: boolean;
    isLoadingMoreWorkbookSheets: boolean;
    fileName: string;
    open: boolean;
    request: WorkbookPickerRequest | null;
    openWorkbookPicker: WorkbookPickerController["openWorkbookPicker"];
    onOpenChange(open: boolean): void;
    onLoadMoreWorkbookSheets(): void;
    onSelect(selection: WorkbookRangeSelection): void;
  };
  sourcePicker: {
    open: boolean;
    onOpenChange(open: boolean): void;
  };
  readiness: StudioReadiness;
};
