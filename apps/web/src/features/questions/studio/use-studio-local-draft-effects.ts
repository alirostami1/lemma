import { useEffect, useRef } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { StudioSource } from "./source/studio-source-model";
import {
  createStudioDraftSnapshot,
  readStudioDraftSnapshot,
  type StudioDraftSnapshot,
  writeStudioDraftSnapshot,
} from "./studio-draft-store";
import type { StudioLocalDraftStatus } from "./studio-state";
import {
  createDraftKeyFromSnapshot,
  hasUnsavedChangesFromKeys,
} from "./studio-state";

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
  loadedBlueprintId,
  serverDraftId,
  sources,
  isDraftRouteActive,
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
  loadedBlueprintId: string | null;
  serverDraftId: string | null;
  sources: StudioSource[];
  isDraftRouteActive: boolean;
  setIsRecoveryResolved(value: boolean): void;
  setLastLocalSavedDraftKey(value: string | null): void;
  setLocalDraftError(value: string | null): void;
  setLocalDraftStatus(value: StudioLocalDraftStatus): void;
  setRecoverySnapshot(value: StudioDraftSnapshot | null): void;
}) {
  const checkedRecoveryDraftKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (isDraftRouteActive) {
      checkedRecoveryDraftKeyRef.current = draftStorageKey;
      setRecoverySnapshot(null);
      if (!isRecoveryResolved) {
        setIsRecoveryResolved(true);
      }
      return;
    }

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

    if (!isSynced && isDifferent) {
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
    isDraftRouteActive,
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
        currentDraftKey,
        lastSavedDraftKey,
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
      void (async () => {
        setLocalDraftStatus("saving");
        const snapshot = createStudioDraftSnapshot({
          authoringModel,
          blueprintDescription,
          blueprintName,
          draftKey: draftStorageKey,
          lastRemoteSaveSnapshotKey,
          loadedBlueprintId,
          sources,
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
      })();
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
    sources,
    setLastLocalSavedDraftKey,
    setLocalDraftError,
    setLocalDraftStatus,
  ]);

  useEffect(() => {
    const hasUnsavedLocalFiles = sources.some(
      (source) => source.backing.kind === "local_file",
    );
    const hasUnsavedServerDraft =
      serverDraftId !== null && currentDraftKey !== lastRemoteSaveSnapshotKey;
    const hasUnsavedLocalDraft =
      serverDraftId === null && lastLocalSavedDraftKey !== currentDraftKey;
    const hasUnsafeAssets = sources.some(
      (source) => source.backing.kind === "restoring_local_file",
    );
    const shouldProtectLeave =
      hasUnsavedServerDraft ||
      hasUnsavedLocalDraft ||
      hasUnsavedLocalFiles ||
      hasUnsafeAssets;
    if (!shouldProtectLeave) {
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
    lastLocalSavedDraftKey,
    serverDraftId,
    loadedBlueprintId,
    lastRemoteSaveSnapshotKey,
    sources,
  ]);

  return {
    checkedRecoveryDraftKeyRef,
  };
}
