import type { KeyboardEvent } from "react";
import type { StudioEditorCommand } from "./studio-editor-command-model";
import {
  canRunStudioShortcutFromSurface,
  getStudioShortcutSurface,
  isStudioShortcutSuppressedTarget,
  matchStudioKeybinding,
} from "./studio-keybindings";

export function useStudioEditorKeyboard({
  disabled,
  onRunCommand,
}: {
  disabled?: boolean;
  onRunCommand(command: StudioEditorCommand): void;
}) {
  function handleKeyDown(event: KeyboardEvent) {
    if (disabled || event.defaultPrevented) {
      return;
    }

    const action = matchStudioKeybinding(event);
    if (!action) {
      return;
    }

    const surface = getStudioShortcutSurface(event.target);
    if (!canRunStudioShortcutFromSurface({ action, surface })) {
      return;
    }

    if (
      isStudioShortcutSuppressedTarget(event.target) &&
      surface !== "editing"
    ) {
      return;
    }

    event.preventDefault();
    onRunCommand(action);
  }

  return { handleKeyDown };
}

export function focusStudioBlockBody(
  container: HTMLElement | null,
  blockId: string,
) {
  const block = getBlockElement(container, blockId);
  const focusTarget = block?.querySelector<HTMLElement>(
    "[data-studio-primary-editor-focus]",
  );

  (focusTarget ?? getBlockFocusElement(container, blockId))?.focus();
}

export function focusStudioBlockShell(
  container: HTMLElement | null,
  blockId: string,
) {
  getBlockFocusElement(container, blockId)?.focus();
}

function getBlockElement(container: HTMLElement | null, blockId: string) {
  const blocks = container?.querySelectorAll<HTMLElement>(
    "[data-studio-block-id]",
  );
  return (
    Array.from(blocks ?? []).find(
      (block) => block.dataset.studioBlockId === blockId,
    ) ?? null
  );
}

function getBlockFocusElement(container: HTMLElement | null, blockId: string) {
  const block = getBlockElement(container, blockId);
  return (
    block?.querySelector<HTMLElement>("[data-studio-block-focus]") ?? block
  );
}
