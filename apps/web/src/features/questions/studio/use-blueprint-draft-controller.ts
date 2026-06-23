import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useQuestionBlueprintAuthoringQuery,
  useQuestionBlueprintDraftQuery,
} from "#/domains/questions";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  createDefaultComposedEditorModel,
  normalizeWorkbookReferenceIdsInComposedEditorModel,
} from "#/domains/questions/authoring";
import { questionBlueprintDocumentToComposedEditorModel } from "#/domains/questions/canonical-authoring";
import type { QuestionBlueprintAuthoring } from "#/domains/questions/model";
import { createLoadedBlueprintDraftSnapshotState } from "./blueprint-draft-snapshots";
import {
  createMissingLocalFileSource,
  createStudioSourceFingerprints,
  DRAFT_STORAGE_RESTORE_ERROR_MESSAGE,
  fromDraftToStudioSources,
  hydrateStudioSourcesFromDraftAssets,
  type StudioSource,
  toStudioSourcesFromSavedBlueprint,
} from "./source/studio-source-model";
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
  draftStorageKey: string;
  blueprintOpenWarning: StudioBlueprintOpenWarningState;
  draftRecovery: StudioDraftRecoveryState;
  hasUnsavedChanges: boolean;
  isLoadingBlueprint: boolean;
  loadError: string | null;
  localDraftError: string | null;
  localDraftStatus: StudioLocalDraftStatus;
  loadedBlueprint: QuestionBlueprintAuthoring | null;
  loadedBlueprintId: string | null;
  serverDraftId: string | null;
  clearServerDraftId(): void;
  resetConfirmation: StudioResetConfirmationState;
  restoredInitialLocalDraft: boolean;
  canRedo: boolean;
  canUndo: boolean;
  markSaved(input: {
    authoringModel?: ComposedEditorModel;
    blueprintDescription: string;
    blueprintId: string;
    blueprintName: string;
    sources: StudioSource[];
  }): void;
  sources: StudioSource[];
  setAuthoringModel(model: ComposedEditorModel): void;
  setBlueprintDescription(description: string): void;
  setBlueprintName(name: string): void;
  setSources(sources: StudioSource[]): void;
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
  initialDraftId?: string;
};

export function useBlueprintDraftController({
  initialBlueprintId,
  initialDraftId = "",
}: UseBlueprintDraftControllerInput): BlueprintDraftController {
  const navigate = useNavigate();
  const isDraftRouteActive = initialDraftId.length > 0;
  const activeBlueprintId = isDraftRouteActive ? "" : initialBlueprintId;
  const shouldLoadBlueprint = initialDraftId.length === 0;
  const hasIncomingEntity =
    initialBlueprintId.length > 0 || initialDraftId.length > 0;
  const [initialLocalDraft] = useState(() =>
    normalizeStudioDraftSnapshot(
      getInitialStudioDraftSnapshot({
        latestDraft: readInitialLocalDraft(),
        routeBlueprintId: hasIncomingEntity ? "__studio-route__" : "",
      }),
    ),
  );
  const [serverDraftId, setServerDraftId] = useState<string | null>(
    initialDraftId || null,
  );
  const initialLocalDraftKey = initialLocalDraft
    ? createDraftKeyFromSnapshot(initialLocalDraft)
    : null;
  const [loadedBlueprintId, setLoadedBlueprintId] = useState<string | null>(
    initialLocalDraft?.loadedBlueprintId ?? (activeBlueprintId || null),
  );
  const [blueprintName, setBlueprintName] = useState(
    initialLocalDraft?.blueprintName ?? "Question blueprint",
  );
  const [blueprintDescription, setBlueprintDescription] = useState(
    initialLocalDraft?.blueprintDescription ?? "",
  );
  const [authoringModel, setAuthoringModel] = useState<ComposedEditorModel>(
    () =>
      initialLocalDraft
        ? normalizeWorkbookReferenceIdsInComposedEditorModel(
            initialLocalDraft.authoringModel,
          )
        : createDefaultComposedEditorModel(),
  );
  const [sources, setSources] = useState<StudioSource[]>(
    () => initialLocalDraft?.sources ?? [],
  );
  const [draftStorageKey, setDraftStorageKey] = useState(
    () =>
      initialLocalDraft?.draftKey ??
      createStudioDraftKey({
        loadedBlueprintId: activeBlueprintId || null,
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
    activeBlueprintId.length === 0,
  );
  const [hasUserEdited, setHasUserEdited] = useState(
    initialLocalDraft !== null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const initialBlueprintOpenKey = createBlueprintOpenKey(activeBlueprintId);
  const loadedBlueprintKeyRef = useRef<string | null>(null);
  const confirmedBlueprintOpenIdsRef = useRef(new Set<string>());
  const cancelledBlueprintOpenIdRef = useRef<string | null>(null);
  const sourcesRef = useRef<StudioSource[]>([]);
  const loadedBlueprintQuery = useQuestionBlueprintAuthoringQuery(
    { questionBlueprintId: activeBlueprintId },
    {
      enabled: shouldLoadBlueprint && activeBlueprintId.length > 0,
    },
  );
  const loadedServerDraftQuery = useQuestionBlueprintDraftQuery(
    initialDraftId,
    {
      enabled: initialDraftId.length > 0,
    },
  );
  const loadedServerDraftIdRef = useRef<string | null>(null);

  useEffect(() => {
    setServerDraftId(initialDraftId.length > 0 ? initialDraftId : null);
    loadedServerDraftIdRef.current = null;
    setLoadError(null);
  }, [initialDraftId]);

  useEffect(() => {
    if (
      initialDraftId.length === 0 ||
      loadedServerDraftIdRef.current === initialDraftId
    ) {
      return;
    }
    if (loadedServerDraftQuery.isError) {
      setLoadError("Draft could not be loaded.");
      return;
    }
    const serverDraft = loadedServerDraftQuery.data?.draft;
    if (!serverDraft || serverDraft.id !== initialDraftId) return;
    loadedServerDraftIdRef.current = initialDraftId;
    const serverDraftAuthoringModel =
      normalizeWorkbookReferenceIdsInComposedEditorModel(
        questionBlueprintDocumentToComposedEditorModel(serverDraft.document),
      );
    const serverDraftSources = fromDraftToStudioSources(serverDraft.sources);
    const serverDraftSnapshotKey = createDraftSnapshotKey({
      authoringModel: serverDraftAuthoringModel,
      blueprintId: serverDraft.blueprintId ?? "",
      blueprintName: serverDraft.name.trim(),
      description: (serverDraft.description ?? "").trim(),
      sources: serverDraftSources,
    });
    setLoadError(null);
    setServerDraftId(initialDraftId);
    setBlueprintName(serverDraft.name);
    setBlueprintDescription(serverDraft.description ?? "");
    setAuthoringModel(serverDraftAuthoringModel);
    setSources(serverDraftSources);
    setLoadedBlueprintId(serverDraft.blueprintId);
    setHasUserEdited(false);
    setLastSavedDraftKey(serverDraftSnapshotKey);
    setLastRemoteSaveSnapshotKey(serverDraftSnapshotKey);
    setIsRecoveryResolved(true);
  }, [
    initialDraftId,
    loadedServerDraftQuery.data,
    loadedServerDraftQuery.isError,
  ]);

  const currentDraftKey = useMemo(
    () =>
      createDraftSnapshotKey({
        authoringModel,
        blueprintId: loadedBlueprintId ?? "",
        blueprintName: blueprintName.trim(),
        description: blueprintDescription.trim(),
        sources,
      }),
    [
      authoringModel,
      blueprintDescription,
      blueprintName,
      loadedBlueprintId,
      sources,
    ],
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
    initialBlueprintId: activeBlueprintId,
    initialBlueprintOpenKey,
    lastRemoteSaveSnapshotKey,
    lastSavedDraftKey,
    loadedBlueprintId,
    loadedBlueprintKeyRef,
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
    setAuthoringModel,
    setBlueprintDescription,
    setBlueprintName,
    setHasUserEdited,
    setSources,
    sources,
  });
  const restoringSourceFingerprintKey = useMemo(
    () =>
      JSON.stringify(
        sources
          .map(toRestoringSourceFingerprint)
          .filter((fingerprint) => fingerprint !== null),
      ),
    [sources],
  );

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  useEffect(() => {
    if (restoringSourceFingerprintKey === "[]") {
      return;
    }

    let cancelled = false;
    const sourcesAtStart = sourcesRef.current;
    void hydrateStudioSourcesFromDraftAssets({
      draftKey: draftStorageKey,
      sources: sourcesAtStart,
    })
      .then((hydratedSources) => {
        if (cancelled) {
          return;
        }

        const currentSources = sourcesRef.current;
        const nextSources = mergeHydratedStudioSourcesBySourceId({
          currentSources,
          hydratedSources,
        });
        if (studioSourcesEqualForHydration(currentSources, nextSources)) {
          return;
        }

        setSources(nextSources);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setSources(
          sourcesRef.current.map((source) =>
            createMissingLocalFileSource(
              source,
              DRAFT_STORAGE_RESTORE_ERROR_MESSAGE,
            ),
          ),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [draftStorageKey, restoringSourceFingerprintKey, setSources]);

  useEffect(() => {
    if (
      activeBlueprintId.length === 0 ||
      loadedBlueprintKeyRef.current === initialBlueprintOpenKey ||
      !confirmedBlueprintOpenIdsRef.current.has(initialBlueprintOpenKey) ||
      cancelledBlueprintOpenIdRef.current === initialBlueprintOpenKey
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

    const nextDraftState = createLoadedBlueprintDraftSnapshotState({
      blueprint: loadedBlueprint,
      blueprintId: activeBlueprintId,
    });
    if (!nextDraftState.ok) {
      setLoadError("Blueprint could not be loaded.");
      return;
    }
    const {
      authoringModel: nextAuthoringModel,
      draftStorageKey: nextDraftStorageKey,
      remoteSnapshotKey,
      syncedSnapshot,
    } = nextDraftState.value;

    const normalizedSyncedSnapshot =
      normalizeStudioDraftSnapshot(syncedSnapshot);
    const normalizedRemoteSnapshotKey = normalizedSyncedSnapshot
      ? createDraftKeyFromSnapshot(normalizedSyncedSnapshot)
      : remoteSnapshotKey;

    loadedBlueprintKeyRef.current = initialBlueprintOpenKey;
    setLoadError(null);
    setBlueprintName(loadedBlueprint.name);
    setBlueprintDescription(loadedBlueprint.description ?? "");
    setAuthoringModel(
      normalizeWorkbookReferenceIdsInComposedEditorModel(nextAuthoringModel),
    );
    setSources(toStudioSourcesFromSavedBlueprint(loadedBlueprint.sources));
    setDraftStorageKey(nextDraftStorageKey);
    setLoadedBlueprintId(activeBlueprintId);
    setHasUserEdited(false);
    setLastSavedDraftKey(normalizedRemoteSnapshotKey);
    setLastRemoteSaveSnapshotKey(normalizedRemoteSnapshotKey);
    if (
      normalizedSyncedSnapshot &&
      writeStudioDraftSnapshot(normalizedSyncedSnapshot).ok
    ) {
      setLastLocalSavedDraftKey(normalizedRemoteSnapshotKey);
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
    activeBlueprintId,
    loadedBlueprintQuery.data,
    loadedBlueprintQuery.isError,
    replaceCurrentSnapshot,
    initialBlueprintOpenKey,
  ]);

  const isRemoteLoadPending =
    activeBlueprintId.length > 0 &&
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
    isDraftRouteActive,
    isRecoveryResolved,
    isRemoteLoadPending,
    lastLocalSavedDraftKey,
    lastRemoteSaveSnapshotKey,
    lastSavedDraftKey,
    loadedBlueprint: loadedBlueprintQuery.data?.questionBlueprint ?? null,
    loadedBlueprintId,
    setIsRecoveryResolved,
    setLastLocalSavedDraftKey,
    setLocalDraftError,
    setLocalDraftStatus,
    setRecoverySnapshot,
    serverDraftId,
    sources,
  });

  function restoreSnapshot(snapshot: StudioDraftSnapshot) {
    const normalizedSnapshot =
      normalizeStudioDraftSnapshot(snapshot) ?? snapshot;
    applyHistorySnapshot({
      authoringModel: normalizeWorkbookReferenceIdsInComposedEditorModel(
        normalizedSnapshot.authoringModel,
      ),
      blueprintDescription: normalizedSnapshot.blueprintDescription,
      blueprintName: normalizedSnapshot.blueprintName,
      sources: normalizedSnapshot.sources,
    });
    setLoadedBlueprintId(normalizedSnapshot.loadedBlueprintId);
    setDraftStorageKey(normalizedSnapshot.draftKey);
    setLastLocalSavedDraftKey(createDraftKeyFromSnapshot(normalizedSnapshot));
    setLastRemoteSaveSnapshotKey(normalizedSnapshot.lastRemoteSaveSnapshotKey);
    setLastSavedDraftKey(normalizedSnapshot.lastRemoteSaveSnapshotKey);
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
    void navigate({ search: {}, to: "/studio" });
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
    setLocalDraftError,
    setLocalDraftStatus,
    setRecoverySnapshot,
    setSources,
  });
  const markSaved = useBlueprintDraftMarkSavedAction({
    authoringModel,
    draftStorageKey,
    loadedBlueprintKeyRef,
    replaceCurrentSnapshot,
    setBlueprintDescription,
    setBlueprintName,
    setDraftStorageKey,
    setHasUserEdited,
    setLastLocalSavedDraftKey,
    setLastRemoteSaveSnapshotKey,
    setLastSavedDraftKey,
    setLoadedBlueprintId,
    setLocalDraftError,
    setLocalDraftStatus,
    setSources,
  });

  const hasUnsavedChanges = hasUnsavedChangesFromKeys({
    currentDraftKey,
    lastSavedDraftKey,
    loadedBlueprintId,
  });

  return {
    authoringModel,
    blueprintDescription,
    blueprintName,
    blueprintOpenWarning: {
      onCancel: cancelBlueprintOpen,
      onContinue: continueBlueprintOpen,
      open: blueprintOpenWarningSnapshot !== null,
      snapshot: blueprintOpenWarningSnapshot,
    },
    canRedo,
    canUndo,
    clearServerDraftId() {
      setServerDraftId(null);
    },
    currentDraftKey,
    draftRecovery: {
      onDiscard: keepCurrentDraft,
      onKeepCurrent: keepCurrentDraft,
      onRestore: () => {
        if (recoverySnapshot) {
          restoreSnapshot(recoverySnapshot);
        }
      },
      open: recoverySnapshot !== null,
      snapshot: recoverySnapshot,
    },
    draftStorageKey,
    hasUnsavedChanges,
    isLoadingBlueprint:
      loadedBlueprintQuery.isLoading || loadedServerDraftQuery.isLoading,
    loadError,
    loadedBlueprint: loadedBlueprintQuery.data?.questionBlueprint ?? null,
    loadedBlueprintId,
    localDraftError,
    localDraftStatus,
    markSaved,
    redo: redoHistory,
    requestReset: () => setIsResetConfirmationOpen(true),
    resetConfirmation: {
      onCancel: () => setIsResetConfirmationOpen(false),
      onConfirm: resetStudioDraft,
      open: isResetConfirmationOpen,
    },
    restoredInitialLocalDraft: initialLocalDraft !== null,
    serverDraftId,
    setAuthoringModel: setEditableAuthoringModel,
    setBlueprintDescription: setEditableBlueprintDescription,
    setBlueprintName: setEditableBlueprintName,
    setSources: setEditableSources,
    sources,
    undo: undoHistory,
  };
}

function normalizeStudioDraftSnapshot(
  snapshot: StudioDraftSnapshot | null,
): StudioDraftSnapshot | null {
  if (!snapshot) {
    return null;
  }

  return {
    ...snapshot,
    authoringModel: normalizeWorkbookReferenceIdsInComposedEditorModel(
      snapshot.authoringModel,
    ),
    sources: snapshot.sources.filter(
      (source) =>
        source.backing.kind === "draft_file" ||
        source.backing.kind === "persisted_workbook",
    ),
  };
}

function readInitialLocalDraft() {
  const result = readLatestStudioDraftSnapshot();
  return result.ok ? result.value : null;
}

function createBlueprintOpenKey(blueprintId: string) {
  return blueprintId;
}

export function mergeHydratedStudioSourcesBySourceId(input: {
  currentSources: readonly StudioSource[];
  hydratedSources: readonly StudioSource[];
}): StudioSource[] {
  const hydratedBySourceId = new Map(
    input.hydratedSources.map((source) => [source.sourceId, source]),
  );

  return input.currentSources.map((source) => {
    if (source.backing.kind !== "restoring_local_file") {
      return source;
    }

    return hydratedBySourceId.get(source.sourceId) ?? source;
  });
}

function studioSourcesEqualForHydration(
  left: readonly StudioSource[],
  right: readonly StudioSource[],
): boolean {
  return (
    JSON.stringify(createStudioSourceFingerprints(left)) ===
    JSON.stringify(createStudioSourceFingerprints(right))
  );
}

function toRestoringSourceFingerprint(source: StudioSource) {
  const { backing } = source;
  if (backing.kind !== "restoring_local_file") {
    return null;
  }

  return {
    byteSize: backing.byteSize,
    lastModified: backing.lastModified,
    originalName: backing.originalName,
    sourceId: source.sourceId,
  };
}
