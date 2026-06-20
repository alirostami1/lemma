import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useQuestionBlueprintAuthoringQuery,
  useQuestionBlueprintVersionAuthoringQuery,
} from "#/domains/questions";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { createDefaultComposedEditorModel } from "#/domains/questions/authoring";
import type { QuestionBlueprintAuthoring } from "#/domains/questions/model";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import { createLoadedBlueprintDraftSnapshotState } from "./blueprint-draft-snapshots";
import { createDraftSnapshotKey } from "./studio-controller-helpers";
import {
  createStudioDraftKey,
  deleteStudioDraftSnapshot,
  readLatestStudioDraftSnapshot,
  type StudioDraftSnapshot,
  writeStudioDraftSnapshot,
} from "./studio-draft-store";
import {
  createDraftKeyFromSnapshot,
  getInitialStudioDraftSnapshot,
  hasUnsavedChangesFromKeys,
  type StudioLocalDraftStatus,
} from "./studio-state";
import {
  useBlueprintDraftMarkSavedAction,
  useBlueprintDraftResetAction,
} from "./use-blueprint-draft-actions";
import { useBlueprintDraftHistory } from "./use-blueprint-draft-history";
import { useStudioBlueprintOpenWarning } from "./use-studio-blueprint-open-warning";
import { useStudioLocalDraftEffects } from "./use-studio-local-draft-effects";

export type BlueprintDraftController = {
  authoringModel: ComposedEditorModel;
  blueprintDescription: string;
  blueprintName: string;
  currentDraftKey: string;
  blueprintOpenWarning: StudioBlueprintOpenWarningState;
  draftRecovery: StudioDraftRecoveryState;
  hasUnsavedChanges: boolean;
  isLoadingBlueprint: boolean;
  loadError: string | null;
  localDraftError: string | null;
  localDraftStatus: StudioLocalDraftStatus;
  loadedBlueprint: QuestionBlueprintAuthoring | null;
  loadedBlueprintId: string | null;
  loadedBlueprintVersionId: string | null;
  resetConfirmation: StudioResetConfirmationState;
  restoredInitialLocalDraft: boolean;
  canRedo: boolean;
  canUndo: boolean;
  markSaved(input: {
    authoringModel?: ComposedEditorModel;
    blueprintDescription: string;
    blueprintId: string;
    blueprintName: string;
    blueprintVersionId?: string | null;
    sources: QuestionBlueprintWorkbookSource[];
  }): void;
  sources: QuestionBlueprintWorkbookSource[];
  setAuthoringModel(model: ComposedEditorModel): void;
  setBlueprintDescription(description: string): void;
  setBlueprintName(name: string): void;
  setSources(sources: QuestionBlueprintWorkbookSource[]): void;
  requestReset(): void;
  redo(): void;
  undo(): void;
};

export type StudioDraftRecoveryState = {
  open: boolean;
  snapshot: StudioDraftSnapshot | null;
  onDiscard(): void;
  onKeepCurrent(): void;
  onRestore(): void;
};

export type StudioBlueprintOpenWarningState = {
  open: boolean;
  snapshot: StudioDraftSnapshot | null;
  onCancel(): void;
  onContinue(): void;
};

export type StudioResetConfirmationState = {
  open: boolean;
  onCancel(): void;
  onConfirm(): void;
};

type UseBlueprintDraftControllerInput = {
  initialBlueprintId: string;
  initialBlueprintVersionId: string;
};

export function useBlueprintDraftController({
  initialBlueprintId,
  initialBlueprintVersionId,
}: UseBlueprintDraftControllerInput): BlueprintDraftController {
  const navigate = useNavigate();
  const [initialLocalDraft] = useState(() =>
    getInitialStudioDraftSnapshot({
      routeBlueprintId: initialBlueprintId,
      latestDraft: readInitialLocalDraft(),
    }),
  );
  const initialLocalDraftKey = initialLocalDraft
    ? createDraftKeyFromSnapshot(initialLocalDraft)
    : null;
  const [loadedBlueprintId, setLoadedBlueprintId] = useState<string | null>(
    initialLocalDraft?.loadedBlueprintId ?? (initialBlueprintId || null),
  );
  const [loadedBlueprintVersionId, setLoadedBlueprintVersionId] = useState<
    string | null
  >(
    initialLocalDraft?.loadedBlueprintVersionId ??
      (initialBlueprintVersionId || null),
  );
  const [blueprintName, setBlueprintName] = useState(
    initialLocalDraft?.blueprintName ?? "Question blueprint",
  );
  const [blueprintDescription, setBlueprintDescription] = useState(
    initialLocalDraft?.blueprintDescription ?? "",
  );
  const [authoringModel, setAuthoringModel] = useState<ComposedEditorModel>(
    () =>
      initialLocalDraft?.authoringModel ?? createDefaultComposedEditorModel(),
  );
  const [sources, setSources] = useState<QuestionBlueprintWorkbookSource[]>(
    () => initialLocalDraft?.sources ?? [],
  );
  const [draftStorageKey, setDraftStorageKey] = useState(
    () =>
      initialLocalDraft?.draftKey ??
      createStudioDraftKey({
        loadedBlueprintId: initialBlueprintId || null,
        loadedBlueprintVersionId: initialBlueprintVersionId || null,
      }),
  );
  const [lastSavedDraftKey, setLastSavedDraftKey] = useState<string | null>(
    initialLocalDraft?.lastRemoteSaveSnapshotKey ?? null,
  );
  const [lastLocalSavedDraftKey, setLastLocalSavedDraftKey] = useState<
    string | null
  >(initialLocalDraftKey);
  const [lastRemoteSaveSnapshotKey, setLastRemoteSaveSnapshotKey] = useState<
    string | null
  >(initialLocalDraft?.lastRemoteSaveSnapshotKey ?? null);
  const [localDraftStatus, setLocalDraftStatus] = useState<
    BlueprintDraftController["localDraftStatus"]
  >(initialLocalDraft ? "autosaved" : "idle");
  const [localDraftError, setLocalDraftError] = useState<string | null>(null);
  const [recoverySnapshot, setRecoverySnapshot] =
    useState<StudioDraftSnapshot | null>(null);
  const [isResetConfirmationOpen, setIsResetConfirmationOpen] = useState(false);
  const [isRecoveryResolved, setIsRecoveryResolved] = useState(
    initialBlueprintId.length === 0,
  );
  const [hasUserEdited, setHasUserEdited] = useState(
    initialLocalDraft !== null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const initialBlueprintOpenKey = createBlueprintOpenKey(
    initialBlueprintId,
    initialBlueprintVersionId,
  );
  const loadedBlueprintKeyRef = useRef<string | null>(null);
  const confirmedBlueprintOpenIdsRef = useRef(new Set<string>());
  const cancelledBlueprintOpenIdRef = useRef<string | null>(null);
  const loadedBlueprintQuery = useQuestionBlueprintAuthoringQuery(
    { questionBlueprintId: initialBlueprintId },
    {
      enabled:
        initialBlueprintId.length > 0 && initialBlueprintVersionId.length === 0,
    },
  );
  const loadedBlueprintVersionQuery = useQuestionBlueprintVersionAuthoringQuery(
    {
      questionBlueprintId: initialBlueprintId,
      questionBlueprintVersionId: initialBlueprintVersionId,
    },
    {
      enabled:
        initialBlueprintId.length > 0 && initialBlueprintVersionId.length > 0,
    },
  );
  const activeLoadedBlueprintQuery =
    initialBlueprintVersionId.length > 0
      ? loadedBlueprintVersionQuery
      : loadedBlueprintQuery;

  const currentDraftKey = useMemo(
    () =>
      createDraftSnapshotKey({
        blueprintId: loadedBlueprintId ?? "",
        blueprintName: blueprintName.trim(),
        description: blueprintDescription.trim(),
        sources,
        authoringModel,
      }),
    [authoringModel, blueprintDescription, blueprintName, loadedBlueprintId, sources],
  );
  const handleLocalDraftLoadFailed = useCallback(() => {
    setLocalDraftStatus("failed");
    setLocalDraftError("Local draft could not be loaded.");
  }, []);
  const {
    warningSnapshot: blueprintOpenWarningSnapshot,
    setWarningSnapshot: setBlueprintOpenWarningSnapshot,
  } = useStudioBlueprintOpenWarning({
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
    onLocalDraftLoadFailed: handleLocalDraftLoadFailed,
    sources,
  });

  const {
    applyHistorySnapshot,
    canRedo,
    canUndo,
    redoHistory,
    replaceCurrentSnapshot,
    setEditableAuthoringModel,
    setEditableBlueprintDescription,
    setEditableBlueprintName,
    setEditableSources,
    undoHistory,
  } = useBlueprintDraftHistory({
    authoringModel,
    blueprintDescription,
    blueprintName,
    sources,
    setAuthoringModel,
    setBlueprintDescription,
    setBlueprintName,
    setHasUserEdited,
    setSources,
  });

  useEffect(() => {
    if (
      initialBlueprintId.length === 0 ||
      loadedBlueprintKeyRef.current === initialBlueprintOpenKey ||
      !confirmedBlueprintOpenIdsRef.current.has(initialBlueprintOpenKey) ||
      cancelledBlueprintOpenIdRef.current === initialBlueprintOpenKey
    ) {
      return;
    }

    if (activeLoadedBlueprintQuery.isError) {
      setLoadError("Blueprint could not be loaded.");
      return;
    }

    const loadedBlueprint = activeLoadedBlueprintQuery.data?.questionBlueprint;
    if (!loadedBlueprint) {
      return;
    }

    const nextDraftState = createLoadedBlueprintDraftSnapshotState({
      blueprint: loadedBlueprint,
      blueprintId: initialBlueprintId,
    });
    if (!nextDraftState.ok) {
      setLoadError("Blueprint could not be loaded.");
      return;
    }
    const {
      authoringModel: nextAuthoringModel,
      blueprintVersionId: nextBlueprintVersionId,
      draftStorageKey: nextDraftStorageKey,
      remoteSnapshotKey,
      syncedSnapshot,
    } = nextDraftState.value;

    loadedBlueprintKeyRef.current = initialBlueprintOpenKey;
    setLoadError(null);
    setBlueprintName(loadedBlueprint.name);
    setBlueprintDescription(loadedBlueprint.description ?? "");
    setAuthoringModel(nextAuthoringModel);
    setSources(loadedBlueprint.sources);
    setDraftStorageKey(nextDraftStorageKey);
    setLoadedBlueprintId(initialBlueprintId);
    setLoadedBlueprintVersionId(nextBlueprintVersionId);
    setHasUserEdited(false);
    setLastSavedDraftKey(remoteSnapshotKey);
    setLastRemoteSaveSnapshotKey(remoteSnapshotKey);
    if (writeStudioDraftSnapshot(syncedSnapshot).ok) {
      setLastLocalSavedDraftKey(remoteSnapshotKey);
      setLocalDraftStatus("autosaved");
      setLocalDraftError(null);
    } else {
      setLocalDraftStatus("failed");
      setLocalDraftError("Local draft could not be marked as synced.");
    }
    setIsRecoveryResolved(true);
    replaceCurrentSnapshot();
  }, [
    blueprintOpenWarningSnapshot,
    initialBlueprintId,
    activeLoadedBlueprintQuery.data,
    activeLoadedBlueprintQuery.isError,
    replaceCurrentSnapshot,
    initialBlueprintOpenKey,
  ]);

  const isRemoteLoadPending =
    initialBlueprintId.length > 0 &&
    (loadedBlueprintKeyRef.current !== initialBlueprintOpenKey ||
      lastRemoteSaveSnapshotKey === null) &&
    loadError === null;
  const { checkedRecoveryDraftKeyRef } = useStudioLocalDraftEffects({
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
    loadedBlueprint: activeLoadedBlueprintQuery.data?.questionBlueprint ?? null,
    loadedBlueprintId,
    loadedBlueprintVersionId,
    sources,
    setIsRecoveryResolved,
    setLastLocalSavedDraftKey,
    setLocalDraftError,
    setLocalDraftStatus,
    setRecoverySnapshot,
  });

  function restoreSnapshot(snapshot: StudioDraftSnapshot) {
    applyHistorySnapshot({
      authoringModel: snapshot.authoringModel,
      blueprintDescription: snapshot.blueprintDescription,
      blueprintName: snapshot.blueprintName,
      sources: snapshot.sources,
    });
    setLoadedBlueprintId(snapshot.loadedBlueprintId);
    setLoadedBlueprintVersionId(snapshot.loadedBlueprintVersionId ?? null);
    setDraftStorageKey(snapshot.draftKey);
    setLastLocalSavedDraftKey(createDraftKeyFromSnapshot(snapshot));
    setLastRemoteSaveSnapshotKey(snapshot.lastRemoteSaveSnapshotKey);
    setLastSavedDraftKey(snapshot.lastRemoteSaveSnapshotKey);
    setLocalDraftStatus("autosaved");
    setLocalDraftError(null);
    setHasUserEdited(true);
    setRecoverySnapshot(null);
    setIsRecoveryResolved(true);
    replaceCurrentSnapshot();
  }

  function keepCurrentDraft() {
    deleteStudioDraftSnapshot(draftStorageKey);
    setRecoverySnapshot(null);
    setIsRecoveryResolved(true);
    setLocalDraftStatus("idle");
    setLocalDraftError(null);
  }

  function cancelBlueprintOpen() {
    if (!blueprintOpenWarningSnapshot) {
      return;
    }

    cancelledBlueprintOpenIdRef.current = initialBlueprintOpenKey;
    restoreSnapshot(blueprintOpenWarningSnapshot);
    setBlueprintOpenWarningSnapshot(null);
    void navigate({ to: "/studio", search: {} });
  }

  function continueBlueprintOpen() {
    if (!blueprintOpenWarningSnapshot) {
      return;
    }

    deleteStudioDraftSnapshot(blueprintOpenWarningSnapshot.draftKey);
    confirmedBlueprintOpenIdsRef.current.add(initialBlueprintOpenKey);
    setBlueprintOpenWarningSnapshot(null);
    setRecoverySnapshot(null);
    setIsRecoveryResolved(false);
    setLocalDraftStatus("idle");
    setLocalDraftError(null);
  }

  const resetStudioDraft = useBlueprintDraftResetAction({
    checkedRecoveryDraftKeyRef,
    draftStorageKey,
    loadedBlueprintKeyRef,
    navigate,
    replaceCurrentSnapshot,
    setAuthoringModel,
    setBlueprintDescription,
    setBlueprintName,
    setBlueprintOpenWarningSnapshot,
    setDraftStorageKey,
    setHasUserEdited,
    setIsRecoveryResolved,
    setIsResetConfirmationOpen,
    setLastLocalSavedDraftKey,
    setLastRemoteSaveSnapshotKey,
    setLastSavedDraftKey,
    setLoadError,
    setLoadedBlueprintId,
    setLoadedBlueprintVersionId,
    setLocalDraftError,
    setLocalDraftStatus,
    setRecoverySnapshot,
    setSources,
  });
  const markSaved = useBlueprintDraftMarkSavedAction({
    authoringModel,
    draftStorageKey,
    loadedBlueprintKeyRef,
    navigate,
    replaceCurrentSnapshot,
    setBlueprintDescription,
    setBlueprintName,
    setDraftStorageKey,
    setHasUserEdited,
    setLastLocalSavedDraftKey,
    setLastRemoteSaveSnapshotKey,
    setLastSavedDraftKey,
    setLoadedBlueprintId,
    setLoadedBlueprintVersionId,
    setLocalDraftError,
    setLocalDraftStatus,
    setSources,
  });

  const hasUnsavedChanges = hasUnsavedChangesFromKeys({
    loadedBlueprintId,
    lastSavedDraftKey,
    currentDraftKey,
  });

  return {
    authoringModel,
    blueprintDescription,
    blueprintName,
    currentDraftKey,
    blueprintOpenWarning: {
      open: blueprintOpenWarningSnapshot !== null,
      snapshot: blueprintOpenWarningSnapshot,
      onCancel: cancelBlueprintOpen,
      onContinue: continueBlueprintOpen,
    },
    draftRecovery: {
      open: recoverySnapshot !== null,
      snapshot: recoverySnapshot,
      onDiscard: keepCurrentDraft,
      onKeepCurrent: keepCurrentDraft,
      onRestore: () => {
        if (recoverySnapshot) {
          restoreSnapshot(recoverySnapshot);
        }
      },
    },
    hasUnsavedChanges,
    isLoadingBlueprint: activeLoadedBlueprintQuery.isLoading,
    loadError,
    localDraftError,
    localDraftStatus,
    loadedBlueprint: activeLoadedBlueprintQuery.data?.questionBlueprint ?? null,
    loadedBlueprintId,
    loadedBlueprintVersionId,
    resetConfirmation: {
      open: isResetConfirmationOpen,
      onCancel: () => setIsResetConfirmationOpen(false),
      onConfirm: resetStudioDraft,
    },
    restoredInitialLocalDraft: initialLocalDraft !== null,
    canRedo,
    canUndo,
    sources,
    setAuthoringModel: setEditableAuthoringModel,
    setBlueprintDescription: setEditableBlueprintDescription,
    setBlueprintName: setEditableBlueprintName,
    setSources: setEditableSources,
    requestReset: () => setIsResetConfirmationOpen(true),
    redo: redoHistory,
    undo: undoHistory,
    markSaved,
  };
}

function readInitialLocalDraft() {
  const result = readLatestStudioDraftSnapshot();
  return result.ok ? result.value : null;
}

function createBlueprintOpenKey(
  blueprintId: string,
  blueprintVersionId: string,
) {
  return blueprintVersionId.length > 0
    ? `${blueprintId}:${blueprintVersionId}`
    : blueprintId;
}
