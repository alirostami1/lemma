import { useCallback } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  createResetStudioDraftSnapshotState,
  createSavedBlueprintDraftSnapshotState,
} from "./blueprint-draft-snapshots";
import {
  deleteStudioDraftSnapshot,
  writeStudioDraftSnapshot,
} from "./studio-draft-store";

type WritableRef<T> = {
  current: T;
};

type DraftStatusSetter = (status: "idle" | "autosaved" | "failed") => void;
type NavigateToStudio = (options: {
  to: "/studio";
  search: Record<string, never>;
}) => unknown;

export function useBlueprintDraftResetAction(input: {
  checkedRecoveryDraftKeyRef: WritableRef<string | null>;
  draftStorageKey: string;
  loadedBlueprintKeyRef: WritableRef<string | null>;
  navigate: NavigateToStudio;
  replaceCurrentSnapshot(): void;
  setAuthoringModel(model: ComposedEditorModel): void;
  setBlueprintDescription(description: string): void;
  setBlueprintName(name: string): void;
  setBlueprintOpenWarningSnapshot(snapshot: null): void;
  setDraftStorageKey(key: string): void;
  setHasUserEdited(value: boolean): void;
  setIsRecoveryResolved(value: boolean): void;
  setIsResetConfirmationOpen(value: boolean): void;
  setLastLocalSavedDraftKey(key: string | null): void;
  setLastRemoteSaveSnapshotKey(key: string | null): void;
  setLastSavedDraftKey(key: string | null): void;
  setLoadError(error: string | null): void;
  setLoadedBlueprintId(id: string | null): void;
  setLoadedBlueprintVersionId(id: string | null): void;
  setLocalDraftError(error: string | null): void;
  setLocalDraftStatus: DraftStatusSetter;
  setRecoverySnapshot(snapshot: null): void;
  setSelectedWorkbookId(workbookId: string): void;
}) {
  return useCallback(() => {
    const {
      authoringModel: nextAuthoringModel,
      draftKey: nextDraftKey,
      draftStorageKey: nextDraftStorageKey,
      snapshot: nextSnapshot,
    } = createResetStudioDraftSnapshotState();

    if (input.draftStorageKey !== nextDraftStorageKey) {
      deleteStudioDraftSnapshot(input.draftStorageKey);
    }

    input.setBlueprintName(nextSnapshot.blueprintName);
    input.setBlueprintDescription(nextSnapshot.blueprintDescription);
    input.setAuthoringModel(nextAuthoringModel);
    input.setSelectedWorkbookId("");
    input.setLoadedBlueprintId(null);
    input.setLoadedBlueprintVersionId(null);
    input.setDraftStorageKey(nextDraftStorageKey);
    input.loadedBlueprintKeyRef.current = null;
    input.checkedRecoveryDraftKeyRef.current = nextDraftStorageKey;
    input.setLastSavedDraftKey(null);
    input.setLastRemoteSaveSnapshotKey(null);
    input.setRecoverySnapshot(null);
    input.setBlueprintOpenWarningSnapshot(null);
    input.setIsRecoveryResolved(true);
    input.setHasUserEdited(true);
    input.setLoadError(null);
    input.setIsResetConfirmationOpen(false);

    if (writeStudioDraftSnapshot(nextSnapshot).ok) {
      input.setLastLocalSavedDraftKey(nextDraftKey);
      input.setLocalDraftStatus("autosaved");
      input.setLocalDraftError(null);
    } else {
      input.setLastLocalSavedDraftKey(null);
      input.setLocalDraftStatus("failed");
      input.setLocalDraftError("Local draft could not be reset.");
    }

    input.replaceCurrentSnapshot();
    void input.navigate({ to: "/studio", search: {} });
  }, [input]);
}

export function useBlueprintDraftMarkSavedAction(input: {
  authoringModel: ComposedEditorModel;
  draftStorageKey: string;
  loadedBlueprintKeyRef: WritableRef<string | null>;
  replaceCurrentSnapshot(): void;
  setBlueprintDescription(description: string): void;
  setBlueprintName(name: string): void;
  setDraftStorageKey(key: string): void;
  setHasUserEdited(value: boolean): void;
  setLastLocalSavedDraftKey(key: string | null): void;
  setLastRemoteSaveSnapshotKey(key: string | null): void;
  setLastSavedDraftKey(key: string | null): void;
  setLoadedBlueprintId(id: string | null): void;
  setLoadedBlueprintVersionId(id: string | null): void;
  setLocalDraftError(error: string | null): void;
  setLocalDraftStatus: DraftStatusSetter;
  setSelectedWorkbookId(workbookId: string): void;
}) {
  return useCallback(
    ({
      authoringModel: nextAuthoringModel,
      blueprintDescription: nextBlueprintDescription,
      blueprintId,
      blueprintName: nextBlueprintName,
      blueprintVersionId,
      workbookId,
    }: {
      authoringModel?: ComposedEditorModel;
      blueprintDescription: string;
      blueprintId: string;
      blueprintName: string;
      blueprintVersionId?: string | null;
      workbookId: string;
    }) => {
      const savedAuthoringModel = nextAuthoringModel ?? input.authoringModel;
      const {
        draftKey: nextDraftKey,
        remoteSnapshotKey,
        syncedSnapshot,
      } = createSavedBlueprintDraftSnapshotState({
        authoringModel: savedAuthoringModel,
        blueprintDescription: nextBlueprintDescription,
        blueprintId,
        blueprintName: nextBlueprintName,
        blueprintVersionId,
        workbookId,
      });
      input.setBlueprintName(nextBlueprintName);
      input.setBlueprintDescription(nextBlueprintDescription);
      input.setSelectedWorkbookId(workbookId);
      input.setLoadedBlueprintId(blueprintId);
      input.setLoadedBlueprintVersionId(blueprintVersionId ?? null);
      input.setDraftStorageKey(nextDraftKey);
      input.loadedBlueprintKeyRef.current = blueprintId;
      input.setHasUserEdited(false);
      input.setLastSavedDraftKey(remoteSnapshotKey);
      input.setLastRemoteSaveSnapshotKey(remoteSnapshotKey);
      if (nextDraftKey !== input.draftStorageKey) {
        deleteStudioDraftSnapshot(input.draftStorageKey);
      }
      if (writeStudioDraftSnapshot(syncedSnapshot).ok) {
        input.setLastLocalSavedDraftKey(remoteSnapshotKey);
        input.setLocalDraftStatus("autosaved");
        input.setLocalDraftError(null);
      } else {
        input.setLocalDraftStatus("failed");
        input.setLocalDraftError("Local draft could not be marked as synced.");
      }
      input.replaceCurrentSnapshot();
    },
    [input],
  );
}
