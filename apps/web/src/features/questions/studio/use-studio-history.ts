import { useCallback, useRef, useState } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";

const MAX_HISTORY_ENTRIES = 100;
const GROUP_WINDOW_MS = 900;

export type StudioHistorySnapshot = {
  authoringModel: ComposedEditorModel;
  blueprintDescription: string;
  blueprintName: string;
  sources: QuestionBlueprintWorkbookSource[];
};

export type StudioHistoryChangeGroup =
  | "authoring_model"
  | "blueprint_description"
  | "blueprint_name"
  | "sources";

export function useStudioHistory() {
  const [past, setPast] = useState<StudioHistorySnapshot[]>([]);
  const [future, setFuture] = useState<StudioHistorySnapshot[]>([]);
  const activeGroupRef = useRef<{
    key: StudioHistoryChangeGroup;
    lastRecordedAt: number;
  } | null>(null);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const recordChange = useCallback(
    (
      previous: StudioHistorySnapshot,
      next: StudioHistorySnapshot,
      groupKey?: StudioHistoryChangeGroup,
    ) => {
      if (areHistorySnapshotsEqual(previous, next)) {
        return;
      }

      const now = Date.now();
      const shouldCoalesce =
        groupKey &&
        activeGroupRef.current?.key === groupKey &&
        now - activeGroupRef.current.lastRecordedAt <= GROUP_WINDOW_MS;

      activeGroupRef.current = groupKey
        ? { key: groupKey, lastRecordedAt: now }
        : null;
      setFuture([]);

      if (shouldCoalesce) {
        return;
      }

      setPast((current) => [...current, previous].slice(-MAX_HISTORY_ENTRIES));
    },
    [],
  );

  const undo = useCallback(
    (current: StudioHistorySnapshot): StudioHistorySnapshot | null => {
      const previous = past[past.length - 1];
      if (!previous) {
        return null;
      }

      activeGroupRef.current = null;
      setPast((entries) => entries.slice(0, -1));
      setFuture((entries) =>
        [current, ...entries].slice(0, MAX_HISTORY_ENTRIES),
      );
      return previous;
    },
    [past],
  );

  const redo = useCallback(
    (current: StudioHistorySnapshot): StudioHistorySnapshot | null => {
      const next = future[0];
      if (!next) {
        return null;
      }

      activeGroupRef.current = null;
      setPast((entries) => [...entries, current].slice(-MAX_HISTORY_ENTRIES));
      setFuture((entries) => entries.slice(1));
      return next;
    },
    [future],
  );

  const replaceCurrentSnapshot = useCallback(() => {
    activeGroupRef.current = null;
    setPast([]);
    setFuture([]);
  }, []);

  return {
    canRedo,
    canUndo,
    recordChange,
    redo,
    replaceCurrentSnapshot,
    undo,
  };
}

function areHistorySnapshotsEqual(
  left: StudioHistorySnapshot,
  right: StudioHistorySnapshot,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}
