import { useEffect, useState } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
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
  initialBlueprintVersionId,
  lastRemoteSaveSnapshotKey,
  lastSavedDraftKey,
  loadedBlueprintId,
  loadedBlueprintKeyRef,
  loadedBlueprintVersionId,
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
  initialBlueprintVersionId: string;
  lastRemoteSaveSnapshotKey: string | null;
  lastSavedDraftKey: string | null;
  loadedBlueprintId: string | null;
  loadedBlueprintKeyRef: MutableRef<string | null>;
  loadedBlueprintVersionId: string | null;
  onLocalDraftLoadFailed(): void;
  sources: { sourceId: string; name: string; workbookId: string }[];
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
          sources,
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
        nextBlueprintVersionId: initialBlueprintVersionId || null,
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
    initialBlueprintVersionId,
    lastRemoteSaveSnapshotKey,
    lastSavedDraftKey,
    loadedBlueprintId,
    loadedBlueprintKeyRef,
    loadedBlueprintVersionId,
    onLocalDraftLoadFailed,
    sources,
    warningSnapshot,
  ]);

  return {
    warningSnapshot,
    setWarningSnapshot,
  };
}
