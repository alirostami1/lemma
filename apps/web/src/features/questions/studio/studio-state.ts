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
  | "editing_draft"
  | "editing_local_draft"
  | "dirty"
  | "saving"
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
}) {
  return input.lastSavedDraftKey !== input.currentDraftKey;
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

export function getStudioGenerateState(): Pick<
  StudioState,
  "canGenerate" | "generateDisabledReason"
> {
  return {
    canGenerate: false,
    generateDisabledReason: "Publish before generating questions.",
  };
}

export function getStudioPhase(input: {
  hasUnsavedChanges: boolean;
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
  if (input.hasUnsavedChanges) {
    return input.restoredInitialLocalDraft ? "editing_local_draft" : "dirty";
  }
  if (input.loadedBlueprintId) {
    return "editing_draft";
  }
  return "idle";
}

export function getStudioState(input: {
  hasUnsavedChanges: boolean;
  isLoadingBlueprint: boolean;
  isResetPending: boolean;
  loadError: string | null;
  localDraftError: string | null;
  localDraftStatus: StudioLocalDraftStatus;
  loadedBlueprintId: string | null;
  remoteSaveError: string | null;
  remoteSaveIsSaving: boolean;
  restoredInitialLocalDraft: boolean;
}): StudioState {
  const saveError = getStudioSaveError(input);
  const saveState = getStudioSaveState(input);
  const generateState = getStudioGenerateState();
  return {
    ...generateState,
    phase: getStudioPhase(input),
    saveError,
    saveState,
  };
}
