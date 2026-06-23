import { isQuestionGenerationRunActive } from "#/domains/questions/generation-status";
import type { QuestionGenerationRun } from "#/domains/questions/model";
import { createDraftSnapshotKey } from "./studio-controller-helpers";
import type { StudioDraftSnapshot } from "./studio-draft-store";

export type StudioLocalDraftStatus = "idle" | "saving" | "autosaved" | "failed";

export type StudioSaveState =
  | "saved"
  | "unsaved"
  | "saving"
  | "autosaved"
  | "failed";

export type StudioPhase =
  | "idle"
  | "loading_blueprint"
  | "editing_saved_blueprint"
  | "editing_local_draft"
  | "dirty"
  | "saving"
  | "generating"
  | "reset_pending";

export type StudioState = {
  canGenerate: boolean;
  generateDisabledReason: string | null;
  phase: StudioPhase;
  saveError: string | null;
  saveState: StudioSaveState;
};

export function getInitialStudioDraftSnapshot(input: {
  latestDraft: StudioDraftSnapshot | null;
  routeBlueprintId: string;
}): StudioDraftSnapshot | null {
  return input.routeBlueprintId.length === 0 ? input.latestDraft : null;
}

export function createDraftKeyFromSnapshot(snapshot: StudioDraftSnapshot) {
  return createDraftSnapshotKey({
    authoringModel: snapshot.authoringModel,
    blueprintId: snapshot.loadedBlueprintId ?? "",
    blueprintName: snapshot.blueprintName.trim(),
    description: snapshot.blueprintDescription.trim(),
    sources: snapshot.sources,
  });
}

export function shouldWarnBeforeOpeningBlueprint(input: {
  nextBlueprintId: string;
  snapshot: StudioDraftSnapshot;
}) {
  const snapshotKey = createDraftKeyFromSnapshot(input.snapshot);
  const isSynced = input.snapshot.lastRemoteSaveSnapshotKey === snapshotKey;
  return (
    input.snapshot.loadedBlueprintId !== input.nextBlueprintId || !isSynced
  );
}

export function hasUnsavedChangesFromKeys(input: {
  currentDraftKey: string;
  lastSavedDraftKey: string | null;
  loadedBlueprintId: string | null;
}) {
  return (
    input.loadedBlueprintId === null ||
    input.lastSavedDraftKey !== input.currentDraftKey
  );
}

export function getStudioSaveState(input: {
  hasUnsavedChanges: boolean;
  loadError: string | null;
  localDraftError: string | null;
  localDraftStatus: StudioLocalDraftStatus;
  remoteSaveError: string | null;
  remoteSaveIsSaving: boolean;
}): StudioSaveState {
  if (input.loadError || input.remoteSaveError || input.localDraftError) {
    return "failed";
  }
  if (input.remoteSaveIsSaving || input.localDraftStatus === "saving") {
    return "saving";
  }
  if (input.hasUnsavedChanges && input.localDraftStatus === "autosaved") {
    return "autosaved";
  }
  if (input.hasUnsavedChanges) {
    return "unsaved";
  }
  return "saved";
}

export function getStudioSaveError(input: {
  loadError: string | null;
  localDraftError: string | null;
  remoteSaveError: string | null;
}): string | null {
  return input.loadError ?? input.remoteSaveError ?? input.localDraftError;
}

export function getStudioGenerateState(input: {
  hasLoadedBlueprintId: boolean;
  hasUnsavedChanges: boolean;
  isGenerationSubmitting: boolean;
  readinessIssue: string | null;
}): Pick<StudioState, "canGenerate" | "generateDisabledReason"> {
  const generateDisabledReason =
    input.hasLoadedBlueprintId === false || input.hasUnsavedChanges
      ? "Save this blueprint before generating questions."
      : (input.readinessIssue ??
        (input.isGenerationSubmitting ? "Questions are generating." : null));

  return {
    canGenerate: generateDisabledReason === null,
    generateDisabledReason,
  };
}

export function getStudioPhase(input: {
  activeGenerationRun: QuestionGenerationRun | null;
  hasUnsavedChanges: boolean;
  isGenerationSubmitting: boolean;
  isLoadingBlueprint: boolean;
  isResetPending: boolean;
  localDraftStatus: StudioLocalDraftStatus;
  loadedBlueprintId: string | null;
  remoteSaveIsSaving: boolean;
  restoredInitialLocalDraft: boolean;
}): StudioPhase {
  if (input.isResetPending) {
    return "reset_pending";
  }
  if (input.isLoadingBlueprint) {
    return "loading_blueprint";
  }
  if (input.remoteSaveIsSaving || input.localDraftStatus === "saving") {
    return "saving";
  }
  if (
    input.isGenerationSubmitting ||
    (input.activeGenerationRun &&
      isQuestionGenerationRunActive(input.activeGenerationRun))
  ) {
    return "generating";
  }
  if (input.hasUnsavedChanges) {
    return input.restoredInitialLocalDraft ? "editing_local_draft" : "dirty";
  }
  if (input.loadedBlueprintId) {
    return "editing_saved_blueprint";
  }
  return "idle";
}

export function getStudioState(input: {
  activeGenerationRun: QuestionGenerationRun | null;
  hasUnsavedChanges: boolean;
  isGenerationSubmitting: boolean;
  isLoadingBlueprint: boolean;
  isResetPending: boolean;
  loadError: string | null;
  localDraftError: string | null;
  localDraftStatus: StudioLocalDraftStatus;
  loadedBlueprintId: string | null;
  readinessIssue: string | null;
  remoteSaveError: string | null;
  remoteSaveIsSaving: boolean;
  restoredInitialLocalDraft: boolean;
}): StudioState {
  const saveError = getStudioSaveError(input);
  const saveState = getStudioSaveState(input);
  const generateState = getStudioGenerateState({
    hasLoadedBlueprintId: input.loadedBlueprintId !== null,
    hasUnsavedChanges: input.hasUnsavedChanges,
    isGenerationSubmitting: input.isGenerationSubmitting,
    readinessIssue: input.readinessIssue,
  });
  return {
    ...generateState,
    phase: getStudioPhase(input),
    saveError,
    saveState,
  };
}
