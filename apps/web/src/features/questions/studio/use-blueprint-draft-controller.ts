import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuestionBlueprintAuthoringQuery } from "#/domains/questions";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { createDefaultComposedEditorModel } from "#/domains/questions/authoring";
import { questionBlueprintDocumentToComposedEditorModel } from "#/domains/questions/canonical-authoring";
import type { QuestionBlueprintAuthoring } from "#/domains/questions/model";
import { createDraftSnapshotKey } from "./studio-controller-helpers";
import {
  createStudioDraftKey,
  createStudioDraftSnapshot,
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
import { useStudioBlueprintOpenWarning } from "./use-studio-blueprint-open-warning";
import {
  type StudioHistoryChangeGroup,
  type StudioHistorySnapshot,
  useStudioHistory,
} from "./use-studio-history";
import { useStudioLocalDraftEffects } from "./use-studio-local-draft-effects";
import { useStudioUndoRedoHotkeys } from "./use-studio-undo-redo-hotkeys";

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
    workbookId: string;
  }): void;
  selectedWorkbookId: string;
  setAuthoringModel(model: ComposedEditorModel): void;
  setBlueprintDescription(description: string): void;
  setBlueprintName(name: string): void;
  setSelectedWorkbookId(workbookId: string): void;
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
  initialWorkbookId: string;
};

export function useBlueprintDraftController({
  initialBlueprintId,
  initialWorkbookId,
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
  >(initialLocalDraft?.loadedBlueprintVersionId ?? null);
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
  const [selectedWorkbookId, setSelectedWorkbookId] = useState(
    initialLocalDraft?.selectedWorkbookId ??
      (initialBlueprintId ? "" : initialWorkbookId),
  );
  const [draftStorageKey, setDraftStorageKey] = useState(
    () =>
      initialLocalDraft?.draftKey ??
      createStudioDraftKey({
        loadedBlueprintId: initialBlueprintId || null,
        initialWorkbookId,
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
  const loadedBlueprintKeyRef = useRef<string | null>(null);
  const confirmedBlueprintOpenIdsRef = useRef(new Set<string>());
  const cancelledBlueprintOpenIdRef = useRef<string | null>(null);
  const hasInitializedWorkbookRef = useRef(initialLocalDraft !== null);
  const { canRedo, canUndo, recordChange, redo, replaceCurrentSnapshot, undo } =
    useStudioHistory();

  const loadedBlueprintQuery = useQuestionBlueprintAuthoringQuery(
    { questionBlueprintId: initialBlueprintId },
    { enabled: initialBlueprintId.length > 0 },
  );

  const currentDraftKey = useMemo(
    () =>
      createDraftSnapshotKey({
        blueprintId: loadedBlueprintId ?? "",
        blueprintName: blueprintName.trim(),
        description: blueprintDescription.trim(),
        workbookId: selectedWorkbookId,
        authoringModel,
      }),
    [
      authoringModel,
      blueprintDescription,
      blueprintName,
      loadedBlueprintId,
      selectedWorkbookId,
    ],
  );
  const currentHistorySnapshot = useMemo(
    () => ({
      authoringModel,
      blueprintDescription,
      blueprintName,
      selectedWorkbookId,
    }),
    [authoringModel, blueprintDescription, blueprintName, selectedWorkbookId],
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
    lastRemoteSaveSnapshotKey,
    lastSavedDraftKey,
    loadedBlueprintId,
    loadedBlueprintKeyRef,
    loadedBlueprintVersionId,
    onLocalDraftLoadFailed: handleLocalDraftLoadFailed,
    selectedWorkbookId,
  });

  const applyHistorySnapshot = useCallback(
    (snapshot: StudioHistorySnapshot) => {
      setBlueprintName(snapshot.blueprintName);
      setBlueprintDescription(snapshot.blueprintDescription);
      setAuthoringModel(snapshot.authoringModel);
      setSelectedWorkbookId(snapshot.selectedWorkbookId);
    },
    [],
  );
  const undoHistory = useCallback(() => {
    const snapshot = undo(currentHistorySnapshot);
    if (!snapshot) {
      return;
    }

    setHasUserEdited(true);
    applyHistorySnapshot(snapshot);
  }, [applyHistorySnapshot, currentHistorySnapshot, undo]);
  const redoHistory = useCallback(() => {
    const snapshot = redo(currentHistorySnapshot);
    if (!snapshot) {
      return;
    }

    setHasUserEdited(true);
    applyHistorySnapshot(snapshot);
  }, [applyHistorySnapshot, currentHistorySnapshot, redo]);
  useStudioUndoRedoHotkeys({
    canRedo,
    canUndo,
    redo: redoHistory,
    undo: undoHistory,
  });

  useEffect(() => {
    if (hasInitializedWorkbookRef.current || initialWorkbookId.length === 0) {
      return;
    }

    hasInitializedWorkbookRef.current = true;
    setSelectedWorkbookId(initialWorkbookId);
  }, [initialWorkbookId]);

  useEffect(() => {
    if (
      initialBlueprintId.length === 0 ||
      loadedBlueprintKeyRef.current === initialBlueprintId ||
      !confirmedBlueprintOpenIdsRef.current.has(initialBlueprintId) ||
      cancelledBlueprintOpenIdRef.current === initialBlueprintId
    ) {
      return;
    }

    if (loadedBlueprintQuery.isError) {
      setLoadError("Blueprint could not be loaded.");
      return;
    }

    const loadedBlueprint = loadedBlueprintQuery.data?.questionBlueprint;
    if (!loadedBlueprint) {
      return;
    }

    let nextAuthoringModel: ComposedEditorModel;
    try {
      nextAuthoringModel = questionBlueprintDocumentToComposedEditorModel(
        loadedBlueprint.document,
      );
    } catch {
      setLoadError("Blueprint could not be loaded.");
      return;
    }

    loadedBlueprintKeyRef.current = initialBlueprintId;
    hasInitializedWorkbookRef.current = true;
    const nextDraftStorageKey = createStudioDraftKey({
      loadedBlueprintId: initialBlueprintId,
      initialWorkbookId,
    });
    const nextBlueprintVersionId = loadedBlueprint.currentVersionId ?? null;
    setLoadError(null);
    setBlueprintName(loadedBlueprint.name);
    setBlueprintDescription(loadedBlueprint.description ?? "");
    setAuthoringModel(nextAuthoringModel);
    setSelectedWorkbookId(loadedBlueprint.workbookId ?? "");
    setDraftStorageKey(nextDraftStorageKey);
    setLoadedBlueprintId(initialBlueprintId);
    setLoadedBlueprintVersionId(nextBlueprintVersionId);
    setHasUserEdited(false);
    const remoteSnapshotKey = createDraftSnapshotKey({
      blueprintId: initialBlueprintId,
      blueprintName: loadedBlueprint.name.trim(),
      description: loadedBlueprint.description ?? "",
      workbookId: loadedBlueprint.workbookId ?? "",
      authoringModel: nextAuthoringModel,
    });
    setLastSavedDraftKey(remoteSnapshotKey);
    setLastRemoteSaveSnapshotKey(remoteSnapshotKey);
    const syncedSnapshot = createStudioDraftSnapshot({
      draftKey: nextDraftStorageKey,
      loadedBlueprintId: initialBlueprintId,
      loadedBlueprintVersionId: nextBlueprintVersionId,
      selectedWorkbookId: loadedBlueprint.workbookId ?? "",
      blueprintName: loadedBlueprint.name,
      blueprintDescription: loadedBlueprint.description ?? "",
      authoringModel: nextAuthoringModel,
      lastRemoteSaveSnapshotKey: remoteSnapshotKey,
    });
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
    initialWorkbookId,
    loadedBlueprintQuery.data,
    loadedBlueprintQuery.isError,
    replaceCurrentSnapshot,
  ]);

  const isRemoteLoadPending =
    initialBlueprintId.length > 0 &&
    (loadedBlueprintKeyRef.current !== initialBlueprintId ||
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
    loadedBlueprint: loadedBlueprintQuery.data?.questionBlueprint ?? null,
    loadedBlueprintId,
    loadedBlueprintVersionId,
    selectedWorkbookId,
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
      selectedWorkbookId: snapshot.selectedWorkbookId,
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

    cancelledBlueprintOpenIdRef.current = initialBlueprintId;
    restoreSnapshot(blueprintOpenWarningSnapshot);
    setBlueprintOpenWarningSnapshot(null);
    void navigate({ to: "/studio", search: {} });
  }

  function continueBlueprintOpen() {
    if (!blueprintOpenWarningSnapshot) {
      return;
    }

    deleteStudioDraftSnapshot(blueprintOpenWarningSnapshot.draftKey);
    confirmedBlueprintOpenIdsRef.current.add(initialBlueprintId);
    setBlueprintOpenWarningSnapshot(null);
    setRecoverySnapshot(null);
    setIsRecoveryResolved(false);
    setLocalDraftStatus("idle");
    setLocalDraftError(null);
  }

  function resetStudioDraft() {
    const nextAuthoringModel = createDefaultComposedEditorModel();
    const nextDraftStorageKey = createStudioDraftKey({
      loadedBlueprintId: null,
      initialWorkbookId: "",
    });
    const nextSnapshot = createStudioDraftSnapshot({
      draftKey: nextDraftStorageKey,
      loadedBlueprintId: null,
      loadedBlueprintVersionId: null,
      selectedWorkbookId: "",
      blueprintName: "Question blueprint",
      blueprintDescription: "",
      authoringModel: nextAuthoringModel,
      lastRemoteSaveSnapshotKey: null,
    });
    const nextDraftKey = createDraftKeyFromSnapshot(nextSnapshot);

    if (draftStorageKey !== nextDraftStorageKey) {
      deleteStudioDraftSnapshot(draftStorageKey);
    }

    setBlueprintName(nextSnapshot.blueprintName);
    setBlueprintDescription(nextSnapshot.blueprintDescription);
    setAuthoringModel(nextAuthoringModel);
    setSelectedWorkbookId("");
    setLoadedBlueprintId(null);
    setLoadedBlueprintVersionId(null);
    setDraftStorageKey(nextDraftStorageKey);
    loadedBlueprintKeyRef.current = null;
    hasInitializedWorkbookRef.current = true;
    checkedRecoveryDraftKeyRef.current = nextDraftStorageKey;
    setLastSavedDraftKey(null);
    setLastRemoteSaveSnapshotKey(null);
    setRecoverySnapshot(null);
    setBlueprintOpenWarningSnapshot(null);
    setIsRecoveryResolved(true);
    setHasUserEdited(true);
    setLoadError(null);
    setIsResetConfirmationOpen(false);

    if (writeStudioDraftSnapshot(nextSnapshot).ok) {
      setLastLocalSavedDraftKey(nextDraftKey);
      setLocalDraftStatus("autosaved");
      setLocalDraftError(null);
    } else {
      setLastLocalSavedDraftKey(null);
      setLocalDraftStatus("failed");
      setLocalDraftError("Local draft could not be reset.");
    }

    replaceCurrentSnapshot();
    void navigate({ to: "/studio", search: {} });
  }

  function recordAndApplyHistorySnapshot(
    snapshot: StudioHistorySnapshot,
    groupKey?: StudioHistoryChangeGroup,
  ) {
    recordChange(currentHistorySnapshot, snapshot, groupKey);
    setHasUserEdited(true);
    applyHistorySnapshot(snapshot);
  }

  function setEditableAuthoringModel(model: ComposedEditorModel) {
    recordAndApplyHistorySnapshot(
      {
        ...currentHistorySnapshot,
        authoringModel: model,
      },
      "authoring_model",
    );
  }

  function setEditableBlueprintDescription(description: string) {
    recordAndApplyHistorySnapshot(
      {
        ...currentHistorySnapshot,
        blueprintDescription: description,
      },
      "blueprint_description",
    );
  }

  function setEditableBlueprintName(name: string) {
    recordAndApplyHistorySnapshot(
      {
        ...currentHistorySnapshot,
        blueprintName: name,
      },
      "blueprint_name",
    );
  }

  function setEditableSelectedWorkbookId(workbookId: string) {
    recordAndApplyHistorySnapshot(
      {
        ...currentHistorySnapshot,
        selectedWorkbookId: workbookId,
      },
      "selected_workbook",
    );
  }

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
    isLoadingBlueprint: loadedBlueprintQuery.isLoading,
    loadError,
    localDraftError,
    localDraftStatus,
    loadedBlueprint: loadedBlueprintQuery.data?.questionBlueprint ?? null,
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
    selectedWorkbookId,
    setAuthoringModel: setEditableAuthoringModel,
    setBlueprintDescription: setEditableBlueprintDescription,
    setBlueprintName: setEditableBlueprintName,
    setSelectedWorkbookId: setEditableSelectedWorkbookId,
    requestReset: () => setIsResetConfirmationOpen(true),
    redo: redoHistory,
    undo: undoHistory,
    markSaved: ({
      authoringModel: nextAuthoringModel,
      blueprintDescription: nextBlueprintDescription,
      blueprintId,
      blueprintName: nextBlueprintName,
      blueprintVersionId,
      workbookId,
    }) => {
      const savedAuthoringModel = nextAuthoringModel ?? authoringModel;
      const remoteSnapshotKey = createDraftSnapshotKey({
        blueprintId,
        blueprintName: nextBlueprintName.trim(),
        description: nextBlueprintDescription,
        workbookId,
        authoringModel: savedAuthoringModel,
      });
      const nextDraftKey = createStudioDraftKey({
        loadedBlueprintId: blueprintId,
        initialWorkbookId,
      });
      setBlueprintName(nextBlueprintName);
      setBlueprintDescription(nextBlueprintDescription);
      setSelectedWorkbookId(workbookId);
      setLoadedBlueprintId(blueprintId);
      setLoadedBlueprintVersionId(blueprintVersionId ?? null);
      setDraftStorageKey(nextDraftKey);
      loadedBlueprintKeyRef.current = blueprintId;
      setHasUserEdited(false);
      setLastSavedDraftKey(remoteSnapshotKey);
      setLastRemoteSaveSnapshotKey(remoteSnapshotKey);
      if (nextDraftKey !== draftStorageKey) {
        deleteStudioDraftSnapshot(draftStorageKey);
      }
      const syncedSnapshot = createStudioDraftSnapshot({
        draftKey: nextDraftKey,
        loadedBlueprintId: blueprintId,
        loadedBlueprintVersionId: blueprintVersionId ?? null,
        selectedWorkbookId: workbookId,
        blueprintName: nextBlueprintName,
        blueprintDescription: nextBlueprintDescription,
        authoringModel: savedAuthoringModel,
        lastRemoteSaveSnapshotKey: remoteSnapshotKey,
      });
      if (writeStudioDraftSnapshot(syncedSnapshot).ok) {
        setLastLocalSavedDraftKey(remoteSnapshotKey);
        setLocalDraftStatus("autosaved");
        setLocalDraftError(null);
      } else {
        setLocalDraftStatus("failed");
        setLocalDraftError("Local draft could not be marked as synced.");
      }
      replaceCurrentSnapshot();
    },
  };
}

function readInitialLocalDraft() {
  const result = readLatestStudioDraftSnapshot();
  return result.ok ? result.value : null;
}
