import { useCallback, useMemo } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { StudioSource } from "./source/studio-source-model";
import {
  type StudioHistorySnapshot,
  useStudioHistory,
} from "./use-studio-history";
import { useStudioUndoRedoHotkeys } from "./use-studio-undo-redo-hotkeys";

type UseBlueprintDraftHistoryInput = {
  authoringModel: ComposedEditorModel;
  blueprintDescription: string;
  blueprintName: string;
  sources: StudioSource[];
  setAuthoringModel(model: ComposedEditorModel): void;
  setBlueprintDescription(description: string): void;
  setBlueprintName(name: string): void;
  setHasUserEdited(hasUserEdited: boolean): void;
  setSources(sources: StudioSource[]): void;
};

export function useBlueprintDraftHistory({
  authoringModel,
  blueprintDescription,
  blueprintName,
  sources,
  setAuthoringModel,
  setBlueprintDescription,
  setBlueprintName,
  setHasUserEdited,
  setSources,
}: UseBlueprintDraftHistoryInput) {
  const { canRedo, canUndo, recordChange, redo, replaceCurrentSnapshot, undo } =
    useStudioHistory();

  const currentHistorySnapshot = useMemo(
    () => ({
      authoringModel,
      blueprintDescription,
      blueprintName,
      sources,
    }),
    [authoringModel, blueprintDescription, blueprintName, sources],
  );

  const applyHistorySnapshot = useCallback(
    (snapshot: StudioHistorySnapshot) => {
      setBlueprintName(snapshot.blueprintName);
      setBlueprintDescription(snapshot.blueprintDescription);
      setAuthoringModel(snapshot.authoringModel);
      setSources(snapshot.sources);
    },
    [setAuthoringModel, setBlueprintDescription, setBlueprintName, setSources],
  );

  const undoHistory = useCallback(() => {
    const snapshot = undo(currentHistorySnapshot);
    if (!snapshot) {
      return;
    }

    setHasUserEdited(true);
    applyHistorySnapshot(snapshot);
  }, [applyHistorySnapshot, currentHistorySnapshot, setHasUserEdited, undo]);

  const redoHistory = useCallback(() => {
    const snapshot = redo(currentHistorySnapshot);
    if (!snapshot) {
      return;
    }

    setHasUserEdited(true);
    applyHistorySnapshot(snapshot);
  }, [applyHistorySnapshot, currentHistorySnapshot, redo, setHasUserEdited]);

  useStudioUndoRedoHotkeys({
    canRedo,
    canUndo,
    redo: redoHistory,
    undo: undoHistory,
  });

  const recordAndApplyHistorySnapshot = useCallback(
    (
      snapshot: StudioHistorySnapshot,
      groupKey?: Parameters<typeof recordChange>[2],
    ) => {
      recordChange(currentHistorySnapshot, snapshot, groupKey);
      setHasUserEdited(true);
      applyHistorySnapshot(snapshot);
    },
    [
      applyHistorySnapshot,
      currentHistorySnapshot,
      recordChange,
      setHasUserEdited,
    ],
  );

  const setEditableAuthoringModel = useCallback(
    (model: ComposedEditorModel) => {
      recordAndApplyHistorySnapshot(
        {
          ...currentHistorySnapshot,
          authoringModel: model,
        },
        "authoring_model",
      );
    },
    [currentHistorySnapshot, recordAndApplyHistorySnapshot],
  );

  const setEditableBlueprintDescription = useCallback(
    (description: string) => {
      recordAndApplyHistorySnapshot(
        {
          ...currentHistorySnapshot,
          blueprintDescription: description,
        },
        "blueprint_description",
      );
    },
    [currentHistorySnapshot, recordAndApplyHistorySnapshot],
  );

  const setEditableBlueprintName = useCallback(
    (name: string) => {
      recordAndApplyHistorySnapshot(
        {
          ...currentHistorySnapshot,
          blueprintName: name,
        },
        "blueprint_name",
      );
    },
    [currentHistorySnapshot, recordAndApplyHistorySnapshot],
  );

  const setEditableSources = useCallback(
    (nextSources: StudioSource[]) => {
      recordAndApplyHistorySnapshot(
        {
          ...currentHistorySnapshot,
          sources: nextSources,
        },
        "sources",
      );
    },
    [currentHistorySnapshot, recordAndApplyHistorySnapshot],
  );

  return {
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
  };
}
