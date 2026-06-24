import { useEffect, useState } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { StudioSource } from "./source/studio-source-model";
import {
  createStudioDraftSnapshot,
  readLatestStudioDraftSnapshot,
  type StudioDraftSnapshot,
} from "./studio-draft-store";
import {
  hasUnsavedChangesFromKeys,
  shouldWarnBeforeOpeningBlueprint,
} from "./studio-state";

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
  initialBlueprintOpenKey,
  lastRemoteSaveSnapshotKey,
  lastSavedDraftKey,
  loadedBlueprintId,
  loadedBlueprintKeyRef,
  onLocalDraftLoadFailed,
  sources,
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
  initialBlueprintOpenKey: string;
  lastRemoteSaveSnapshotKey: string | null;
  lastSavedDraftKey: string | null;
  loadedBlueprintId: string | null;
  loadedBlueprintKeyRef: MutableRef<string | null>;
  onLocalDraftLoadFailed(): void;
  sources: StudioSource[];
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
      loadedBlueprintKeyRef.current === initialBlueprintOpenKey ||
      confirmedBlueprintOpenIdsRef.current.has(initialBlueprintOpenKey) ||
      cancelledBlueprintOpenIdRef.current === initialBlueprintOpenKey ||
      warningSnapshot !== null
    ) {
      return;
    }

    const hasCurrentLocalChanges =
      hasUserEdited &&
      hasUnsavedChangesFromKeys({
        currentDraftKey,
        lastSavedDraftKey,
        loadedBlueprintId,
      });
    const latestResult = readLatestStudioDraftSnapshot();
    const nextWarningSnapshot = hasCurrentLocalChanges
      ? createStudioDraftSnapshot({
          authoringModel,
          blueprintDescription,
          blueprintName,
          draftKey: draftStorageKey,
          lastRemoteSaveSnapshotKey,
          loadedBlueprintId,
          sources,
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
        nextBlueprintId: initialBlueprintId,
        snapshot: nextWarningSnapshot,
      })
    ) {
      setWarningSnapshot(nextWarningSnapshot);
      return;
    }

    confirmedBlueprintOpenIdsRef.current.add(initialBlueprintOpenKey);
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
    initialBlueprintOpenKey,
    lastRemoteSaveSnapshotKey,
    lastSavedDraftKey,
    loadedBlueprintId,
    loadedBlueprintKeyRef,
    onLocalDraftLoadFailed,
    sources,
    warningSnapshot,
  ]);

  return {
    setWarningSnapshot,
    warningSnapshot,
  };
}
