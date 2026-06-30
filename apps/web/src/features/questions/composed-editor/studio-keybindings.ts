import type { KeyboardEvent } from "react";

export type StudioKeybindingAction =
  | "navigate_previous_block"
  | "navigate_next_block"
  | "enter_edit_mode"
  | "exit_edit_mode"
  | "confirm_edit"
  | "cancel_edit"
  | "open_commands"
  | "insert_block"
  | "open_shortcuts";

export type StudioShortcutSurface = "block" | "editing";

export type StudioKeybinding = {
  action: StudioKeybindingAction;
  label: string;
  keys: string[];
  reservedForTableSelection?: boolean;
};

export const STUDIO_KEYBINDINGS: StudioKeybinding[] = [
  {
    action: "navigate_previous_block",
    keys: ["ArrowUp"],
    label: "Previous block",
  },
  {
    action: "navigate_next_block",
    keys: ["ArrowDown"],
    label: "Next block",
  },
  {
    action: "enter_edit_mode",
    keys: ["Enter"],
    label: "Edit selected block",
  },
  {
    action: "exit_edit_mode",
    keys: ["Esc"],
    label: "Leave editing",
  },
  {
    action: "confirm_edit",
    keys: ["Ctrl/⌘ Enter"],
    label: "Done editing",
  },
  {
    action: "cancel_edit",
    keys: ["Ctrl/⌘ ."],
    label: "Cancel changes",
  },
  {
    action: "open_commands",
    keys: ["Ctrl/⌘ K"],
    label: "Open commands",
  },
  {
    action: "insert_block",
    keys: ["/"],
    label: "Insert block",
  },
  {
    action: "open_shortcuts",
    keys: ["?", "F1"],
    label: "Keyboard shortcuts",
  },
];

export const STUDIO_SHORTCUT_HELP_NOTES = [
  "Shortcuts work when a block is selected.",
  "Shortcuts pause while you type or use menus.",
  "Some key combinations are left free for table editing.",
] as const;

export function matchStudioKeybinding(
  event: KeyboardEvent,
): StudioKeybindingAction | null {
  const usesModifier = event.metaKey || event.ctrlKey;
  const noModifier =
    !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;

  if (usesModifier && !event.altKey && !event.shiftKey) {
    const key = event.key.toLowerCase();
    if (key === "k") return "open_commands";
    if (event.key === "Enter") return "confirm_edit";
    if (event.key === ".") return "cancel_edit";
  }

  if (noModifier) {
    if (event.key === "ArrowUp") return "navigate_previous_block";
    if (event.key === "ArrowDown") return "navigate_next_block";
    if (event.key === "Enter") return "enter_edit_mode";
    if (event.key === "Escape") return "exit_edit_mode";
    if (event.key === "/") return "insert_block";
    if (event.key === "F1") return "open_shortcuts";
  }

  if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key === "?") {
    return "open_shortcuts";
  }

  return null;
}

export function isStudioShortcutSuppressedTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (
    target.closest(
      [
        "input",
        "textarea",
        "select",
        "[contenteditable]",
        "[aria-modal='true']",
        "[cmdk-input]",
        "[role='cell']",
        "[role='combobox']",
        "[role='dialog']",
        "[role='grid']",
        "[role='listbox']",
        "[role='menu']",
        "[role='menuitem']",
        "[role='textbox']",
        "[data-slot='combobox-content']",
        "[data-slot='command']",
        "[data-slot='command-input']",
        "[data-slot='command-list']",
        "[data-slot='context-menu-content']",
        "[data-slot='dialog-content']",
        "[data-slot='dropdown-menu-content']",
        "[data-slot='popover-content']",
        "[data-slot='select-content']",
      ].join(","),
    )
  ) {
    return true;
  }

  return Boolean(
    target.closest("[aria-haspopup='dialog'][aria-expanded='true']"),
  );
}

export function getStudioShortcutSurface(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  const scopeElement = target.closest<HTMLElement>(
    "[data-studio-shortcut-scope]",
  );
  const scope = scopeElement?.dataset.studioShortcutScope;
  return scope === "block" || scope === "editing" ? scope : null;
}

export function canRunStudioShortcutFromSurface(input: {
  action: StudioKeybindingAction;
  surface: StudioShortcutSurface | null;
}) {
  if (input.surface === "block") {
    return true;
  }

  if (input.surface === "editing") {
    return (
      input.action === "exit_edit_mode" ||
      input.action === "confirm_edit" ||
      input.action === "cancel_edit"
    );
  }

  return false;
}
