import { useEffect } from "react";

export type StudioHistoryShortcut = "undo" | "redo";

export function getStudioHistoryShortcut(
  event: Pick<
    KeyboardEvent,
    | "altKey"
    | "ctrlKey"
    | "defaultPrevented"
    | "isComposing"
    | "key"
    | "metaKey"
    | "shiftKey"
    | "target"
  >,
): StudioHistoryShortcut | null {
  if (event.defaultPrevented || event.isComposing) {
    return null;
  }
  if (!event.metaKey && !event.ctrlKey) {
    return null;
  }
  if (event.altKey) {
    return null;
  }
  if (
    typeof Element !== "undefined" &&
    event.target instanceof Element &&
    event.target.closest("[role='dialog']")
  ) {
    return null;
  }

  const key = event.key.toLowerCase();
  if (key === "z" && !event.shiftKey) {
    return "undo";
  }
  if ((key === "z" && event.shiftKey) || (key === "y" && !event.shiftKey)) {
    return "redo";
  }
  return null;
}

export function useStudioUndoRedoHotkeys({
  canRedo,
  canUndo,
  redo,
  undo,
}: {
  canRedo: boolean;
  canUndo: boolean;
  redo(): void;
  undo(): void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const shortcut = getStudioHistoryShortcut(event);
      if (shortcut === "undo" && canUndo) {
        event.preventDefault();
        undo();
        return;
      }

      if (shortcut === "redo" && canRedo) {
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canRedo, canUndo, redo, undo]);
}
