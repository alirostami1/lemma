import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuestionBlueprintDraftQuery } from "#/domains/questions";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  createDefaultComposedEditorModel,
  normalizeWorkbookReferenceIdsInComposedEditorModel,
} from "#/domains/questions/authoring";
import { questionBlueprintDocumentToComposedEditorModel } from "#/domains/questions/canonical-authoring";
import type { QuestionBlueprintDraft } from "#/domains/questions/model";
import {
  createMissingLocalFileSource,
  createStudioSourceFingerprints,
  DRAFT_STORAGE_RESTORE_ERROR_MESSAGE,
  fromDraftToStudioSources,
  hydrateStudioSourcesFromDraftAssets,
  type StudioSource,
} from "./source/studio-source-model";
import { createDraftSnapshotKey } from "./studio-controller-helpers";
import {
  createStudioDraftKey,
  deleteStudioDraftSnapshot,
  readLatestStudioDraftSnapshot,
  type StudioDraftSnapshot,
} from "./studio-draft-store";
import {
  createDraftKeyFromSnapshot,
  getInitialStudioDraftSnapshot,
  hasUnsavedChangesFromKeys,
  type StudioLocalDraftStatus,
} from "./studio-state";
import {
  useBlueprintDraftResetAction,
  useStudioDraftMarkServerSavedAction,
} from "./use-blueprint-draft-actions";
import { useBlueprintDraftHistory } from "./use-blueprint-draft-history";
import { useStudioLocalDraftEffects } from "./use-studio-local-draft-effects";

export type BlueprintDraftController = {
  authoringModel: ComposedEditorModel;
  blueprintDescription: string;
  blueprintName: string;
  currentDraftKey: string;
  draftStorageKey: string;
  draftLoadState: StudioDraftLoadState;
  draftRecovery: StudioDraftRecoveryState;
  hasUnsavedChanges: boolean;
  isLoadingBlueprint: boolean;
  loadError: string | null;
  localDraftError: string | null;
  localDraftStatus: StudioLocalDraftStatus;
  loadedBlueprintId: string | null;
  serverDraftId: string | null;
  serverDraftRevision: number | null;
  resetConfirmation: StudioResetConfirmationState;
  restoredInitialLocalDraft: boolean;
  canRedo: boolean;
  canUndo: boolean;
  markServerDraftSaved(input: {
    authoringModel: ComposedEditorModel;
    draft: QuestionBlueprintDraft;
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

export type StudioDraftLoadState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "query_error"; message: string }
  | { status: "document_error"; message: string };

export type StudioDraftRecoveryState = {
  open: boolean;
  snapshot: StudioDraftSnapshot | null;
  onDiscard(): void;
  onKeepCurrent(): void;
  onRestore(): void;
};

export type StudioResetConfirmationState = {
  open: boolean;
  onCancel(): void;
  onConfirm(): void;
};

type UseBlueprintDraftControllerInput = {
  initialDraftId?: string;
};

export function useBlueprintDraftController({
  initialDraftId = "",
}: UseBlueprintDraftControllerInput): BlueprintDraftController {
  const navigate = useNavigate();
  const isDraftRouteActive = initialDraftId.length > 0;
  const [initialLocalDraft] = useState(() =>
    normalizeStudioDraftSnapshot(
      getInitialStudioDraftSnapshot({
        latestDraft: readInitialLocalDraft(),
        routeBlueprintId: initialDraftId.length > 0 ? "__studio-route__" : "",
      }),
    ),
  );
  const [serverDraftId, setServerDraftId] = useState<string | null>(
    initialDraftId || null,
  );
  const [serverDraftRevision, setServerDraftRevision] = useState<number | null>(
    null,
  );
  const initialLocalDraftKey = initialLocalDraft
    ? createDraftKeyFromSnapshot(initialLocalDraft)
    : null;
  const [loadedBlueprintId, setLoadedBlueprintId] = useState<string | null>(
    initialLocalDraft?.loadedBlueprintId ?? null,
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
        loadedBlueprintId: null,
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
  const [isRecoveryResolved, setIsRecoveryResolved] = useState(true);
  const [hasUserEdited, setHasUserEdited] = useState(
    initialLocalDraft !== null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftLoadState, setDraftLoadState] = useState<StudioDraftLoadState>(
    () =>
      initialDraftId.length > 0 ? { status: "loading" } : { status: "ready" },
  );
  const sourcesRef = useRef<StudioSource[]>([]);
  const loadedServerDraftQuery = useQuestionBlueprintDraftQuery(
    initialDraftId,
    {
      enabled: initialDraftId.length > 0,
    },
  );
  const loadedServerDraftIdRef = useRef<string | null>(null);

  useEffect(() => {
    setServerDraftId(initialDraftId.length > 0 ? initialDraftId : null);
    setServerDraftRevision(null);
    loadedServerDraftIdRef.current = null;
    setLoadError(null);
    setDraftLoadState(
      initialDraftId.length > 0 ? { status: "loading" } : { status: "ready" },
    );
  }, [initialDraftId]);

  useEffect(() => {
    if (
      initialDraftId.length === 0 ||
      loadedServerDraftIdRef.current === initialDraftId
    ) {
      return;
    }
    if (loadedServerDraftQuery.isError) {
      const message = "Draft could not be loaded.";
      setLoadError(message);
      setDraftLoadState({ message, status: "query_error" });
      return;
    }
    const serverDraft = loadedServerDraftQuery.data?.draft;
    if (!serverDraft || serverDraft.id !== initialDraftId) return;
    let serverDraftAuthoringModel: ComposedEditorModel;
    try {
      serverDraftAuthoringModel =
        normalizeWorkbookReferenceIdsInComposedEditorModel(
          questionBlueprintDocumentToComposedEditorModel(serverDraft.document),
        );
    } catch {
      const message = "Draft could not be loaded.";
      setLoadError(message);
      setDraftLoadState({ message, status: "document_error" });
      return;
    }

    loadedServerDraftIdRef.current = initialDraftId;
    const serverDraftSources = fromDraftToStudioSources(serverDraft.sources);
    const serverDraftSnapshotKey = createDraftSnapshotKey({
      authoringModel: serverDraftAuthoringModel,
      blueprintId: serverDraft.blueprintId ?? "",
      blueprintName: serverDraft.name.trim(),
      description: (serverDraft.description ?? "").trim(),
      sources: serverDraftSources,
    });
    setLoadError(null);
    setDraftLoadState({ status: "ready" });
    setServerDraftId(initialDraftId);
    setServerDraftRevision(serverDraft.revision);
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

  const { checkedRecoveryDraftKeyRef } = useStudioLocalDraftEffects({
    authoringModel,
    blueprintDescription,
    blueprintName,
    currentDraftKey,
    draftStorageKey,
    hasUserEdited,
    isDraftRouteActive,
    isRecoveryResolved,
    isRemoteLoadPending: false,
    lastLocalSavedDraftKey,
    lastRemoteSaveSnapshotKey,
    lastSavedDraftKey,
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

  const resetStudioDraft = useBlueprintDraftResetAction({
    checkedRecoveryDraftKeyRef,
    draftStorageKey,
    navigate,
    replaceCurrentSnapshot,
    setAuthoringModel,
    setBlueprintDescription,
    setBlueprintName,
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
  const markServerDraftSaved = useStudioDraftMarkServerSavedAction({
    draftStorageKey,
    replaceCurrentSnapshot,
    setAuthoringModel,
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
    setServerDraftId,
    setServerDraftRevision,
    setSources,
  });

  const hasUnsavedChanges = hasUnsavedChangesFromKeys({
    currentDraftKey,
    lastSavedDraftKey,
  });

  return {
    authoringModel,
    blueprintDescription,
    blueprintName,
    canRedo,
    canUndo,
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
    draftLoadState,
    hasUnsavedChanges,
    isLoadingBlueprint: loadedServerDraftQuery.isLoading,
    loadError,
    loadedBlueprintId,
    localDraftError,
    localDraftStatus,
    markServerDraftSaved,
    redo: redoHistory,
    requestReset: () => setIsResetConfirmationOpen(true),
    resetConfirmation: {
      onCancel: () => setIsResetConfirmationOpen(false),
      onConfirm: resetStudioDraft,
      open: isResetConfirmationOpen,
    },
    restoredInitialLocalDraft: initialLocalDraft !== null,
    serverDraftId,
    serverDraftRevision,
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
