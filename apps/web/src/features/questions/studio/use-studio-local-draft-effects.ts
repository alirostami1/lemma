import { useEffect, useRef } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { QuestionBlueprintAuthoring } from "#/domains/questions/model";
import {
  createDraftKeyFromSnapshot,
  hasUnsavedChangesFromKeys,
} from "./studio-state";
import {
  createStudioDraftSnapshot,
  readStudioDraftSnapshot,
  type StudioDraftSnapshot,
  writeStudioDraftSnapshot,
} from "./studio-draft-store";
import type { StudioLocalDraftStatus } from "./studio-state";

const LOCAL_AUTOSAVE_DELAY_MS = 800;

export function useStudioLocalDraftEffects({
  authoringModel,
  blueprintDescription,
  blueprintName,
  currentDraftKey,
  draftStorageKey,
  hasUserEdited,
  isRecoveryResolved,
  isRemoteLoadPending,
  lastLocalSavedDraftKey,
  lastRemoteSaveSnapshotKey,
  lastSavedDraftKey,
  loadedBlueprint,
  loadedBlueprintId,
  loadedBlueprintVersionId,
  selectedWorkbookId,
  setIsRecoveryResolved,
  setLastLocalSavedDraftKey,
  setLocalDraftError,
  setLocalDraftStatus,
  setRecoverySnapshot,
}: {
  authoringModel: ComposedEditorModel;
  blueprintDescription: string;
  blueprintName: string;
  currentDraftKey: string;
  draftStorageKey: string;
  hasUserEdited: boolean;
  isRecoveryResolved: boolean;
  isRemoteLoadPending: boolean;
  lastLocalSavedDraftKey: string | null;
  lastRemoteSaveSnapshotKey: string | null;
  lastSavedDraftKey: string | null;
  loadedBlueprint: QuestionBlueprintAuthoring | null;
  loadedBlueprintId: string | null;
  loadedBlueprintVersionId: string | null;
  selectedWorkbookId: string;
  setIsRecoveryResolved(value: boolean): void;
  setLastLocalSavedDraftKey(value: string | null): void;
  setLocalDraftError(value: string | null): void;
  setLocalDraftStatus(value: StudioLocalDraftStatus): void;
  setRecoverySnapshot(value: StudioDraftSnapshot | null): void;
}) {
  const checkedRecoveryDraftKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      isRemoteLoadPending ||
      checkedRecoveryDraftKeyRef.current === draftStorageKey
    ) {
      return;
    }

    checkedRecoveryDraftKeyRef.current = draftStorageKey;
    const result = readStudioDraftSnapshot(draftStorageKey);
    if (!result.ok || !result.value) {
      setIsRecoveryResolved(true);
      if (!result.ok && result.error === "storage_unavailable") {
        setLocalDraftStatus("failed");
        setLocalDraftError("Local draft could not be loaded.");
      }
      return;
    }

    const snapshot = result.value;
    const snapshotKey = createDraftKeyFromSnapshot(snapshot);
    const isSynced = snapshot.lastRemoteSaveSnapshotKey === snapshotKey;
    const isDifferent = snapshotKey !== currentDraftKey;
    const isNewerThanRemote =
      !loadedBlueprint ||
      snapshot.lastLocalSaveTimestamp > loadedBlueprint.updatedAt.getTime();

    if (!isSynced && isDifferent && isNewerThanRemote) {
      setRecoverySnapshot(snapshot);
      return;
    }

    setLastLocalSavedDraftKey(snapshotKey);
    setLocalDraftStatus(isDifferent ? "idle" : "autosaved");
    setIsRecoveryResolved(true);
  }, [
    currentDraftKey,
    draftStorageKey,
    isRemoteLoadPending,
    lastRemoteSaveSnapshotKey,
    loadedBlueprint,
    loadedBlueprintId,
    setIsRecoveryResolved,
    setLastLocalSavedDraftKey,
    setLocalDraftError,
    setLocalDraftStatus,
    setRecoverySnapshot,
  ]);

  useEffect(() => {
    if (!isRecoveryResolved) return;

    const shouldAutosave =
      hasUnsavedChangesFromKeys({
        loadedBlueprintId,
        lastSavedDraftKey,
        currentDraftKey,
      }) &&
      (loadedBlueprintId !== null || hasUserEdited);
    if (!shouldAutosave) {
      return;
    }

    if (lastLocalSavedDraftKey === currentDraftKey) {
      setLocalDraftStatus("autosaved");
      setLocalDraftError(null);
      return;
    }

    setLocalDraftStatus("idle");
    const timeout = window.setTimeout(() => {
      setLocalDraftStatus("saving");
      const snapshot = createStudioDraftSnapshot({
        draftKey: draftStorageKey,
        loadedBlueprintId,
        loadedBlueprintVersionId,
        selectedWorkbookId,
        blueprintName,
        blueprintDescription,
        authoringModel,
        lastRemoteSaveSnapshotKey,
      });
      const result = writeStudioDraftSnapshot(snapshot);
      if (!result.ok) {
        setLocalDraftStatus("failed");
        setLocalDraftError("Local draft could not be autosaved.");
        return;
      }

      setLastLocalSavedDraftKey(currentDraftKey);
      setLocalDraftStatus("autosaved");
      setLocalDraftError(null);
    }, LOCAL_AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [
    authoringModel,
    blueprintDescription,
    blueprintName,
    currentDraftKey,
    draftStorageKey,
    hasUserEdited,
    isRecoveryResolved,
    lastLocalSavedDraftKey,
    lastRemoteSaveSnapshotKey,
    lastSavedDraftKey,
    loadedBlueprintId,
    loadedBlueprintVersionId,
    selectedWorkbookId,
    setLastLocalSavedDraftKey,
    setLocalDraftError,
    setLocalDraftStatus,
  ]);

  useEffect(() => {
    const hasUnsavedChanges = hasUnsavedChangesFromKeys({
      loadedBlueprintId,
      lastSavedDraftKey,
      currentDraftKey,
    });
    const shouldProtect =
      hasUnsavedChanges && (loadedBlueprintId !== null || hasUserEdited);
    const hasSafeLocalDraft = lastLocalSavedDraftKey === currentDraftKey;
    if (!shouldProtect || hasSafeLocalDraft) {
      return;
    }

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [
    currentDraftKey,
    hasUserEdited,
    lastLocalSavedDraftKey,
    lastSavedDraftKey,
    loadedBlueprintId,
  ]);

  return {
    checkedRecoveryDraftKeyRef,
  };
}
