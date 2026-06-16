import { useEffect, useState } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  hasUnsavedChangesFromKeys,
  shouldWarnBeforeOpeningBlueprint,
} from "./studio-state";
import {
  createStudioDraftSnapshot,
  readLatestStudioDraftSnapshot,
  type StudioDraftSnapshot,
} from "./studio-draft-store";

type MutableRef<T> = {
  current: T;
};

export function useStudioBlueprintOpenWarning({
  authoringModel,
  blueprintDescription,
  blueprintName,
  currentDraftKey,
  draftStorageKey,
  hasUserEdited,
  initialBlueprintId,
  lastRemoteSaveSnapshotKey,
  lastSavedDraftKey,
  loadedBlueprintId,
  loadedBlueprintKeyRef,
  loadedBlueprintVersionId,
  onLocalDraftLoadFailed,
  selectedWorkbookId,
  cancelledBlueprintOpenIdRef,
  confirmedBlueprintOpenIdsRef,
}: {
  authoringModel: ComposedEditorModel;
  blueprintDescription: string;
  blueprintName: string;
  currentDraftKey: string;
  draftStorageKey: string;
  hasUserEdited: boolean;
  initialBlueprintId: string;
  lastRemoteSaveSnapshotKey: string | null;
  lastSavedDraftKey: string | null;
  loadedBlueprintId: string | null;
  loadedBlueprintKeyRef: MutableRef<string | null>;
  loadedBlueprintVersionId: string | null;
  onLocalDraftLoadFailed(): void;
  selectedWorkbookId: string;
  cancelledBlueprintOpenIdRef: MutableRef<string | null>;
  confirmedBlueprintOpenIdsRef: MutableRef<Set<string>>;
}) {
  const [warningSnapshot, setWarningSnapshot] =
    useState<StudioDraftSnapshot | null>(null);

  useEffect(() => {
    if (initialBlueprintId.length === 0) {
      cancelledBlueprintOpenIdRef.current = null;
      return;
    }

    if (
      loadedBlueprintKeyRef.current === initialBlueprintId ||
      confirmedBlueprintOpenIdsRef.current.has(initialBlueprintId) ||
      cancelledBlueprintOpenIdRef.current === initialBlueprintId ||
      warningSnapshot !== null
    ) {
      return;
    }

    const hasCurrentLocalChanges =
      hasUserEdited &&
      hasUnsavedChangesFromKeys({
        loadedBlueprintId,
        lastSavedDraftKey,
        currentDraftKey,
      });
    const latestResult = readLatestStudioDraftSnapshot();
    const nextWarningSnapshot = hasCurrentLocalChanges
      ? createStudioDraftSnapshot({
          draftKey: draftStorageKey,
          loadedBlueprintId,
          loadedBlueprintVersionId,
          selectedWorkbookId,
          blueprintName,
          blueprintDescription,
          authoringModel,
          lastRemoteSaveSnapshotKey,
        })
      : latestResult.ok
        ? latestResult.value
        : null;

    if (!latestResult.ok && latestResult.error === "storage_unavailable") {
      onLocalDraftLoadFailed();
    }

    if (
      nextWarningSnapshot &&
      shouldWarnBeforeOpeningBlueprint({
        snapshot: nextWarningSnapshot,
        nextBlueprintId: initialBlueprintId,
      })
    ) {
      setWarningSnapshot(nextWarningSnapshot);
      return;
    }

    confirmedBlueprintOpenIdsRef.current.add(initialBlueprintId);
  }, [
    authoringModel,
    blueprintDescription,
    blueprintName,
    cancelledBlueprintOpenIdRef,
    confirmedBlueprintOpenIdsRef,
    currentDraftKey,
    draftStorageKey,
    hasUserEdited,
    initialBlueprintId,
    lastRemoteSaveSnapshotKey,
    lastSavedDraftKey,
    loadedBlueprintId,
    loadedBlueprintKeyRef,
    loadedBlueprintVersionId,
    onLocalDraftLoadFailed,
    selectedWorkbookId,
    warningSnapshot,
  ]);

  return {
    warningSnapshot,
    setWarningSnapshot,
  };
}
