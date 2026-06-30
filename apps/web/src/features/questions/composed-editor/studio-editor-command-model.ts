import type { ComposedEditorModel } from "#/domains/questions/authoring";

export type StudioEditorMode =
  | { type: "navigating"; selectedBlockId: string | null }
  | { type: "editing"; blockId: string; baseline: ComposedEditorModel };

export type StudioEditorCommand =
  | "navigate_previous_block"
  | "navigate_next_block"
  | "enter_edit_mode"
  | "exit_edit_mode"
  | "confirm_edit"
  | "cancel_edit"
  | "insert_block"
  | "open_commands"
  | "open_shortcuts";

export type StudioEditorCommandAvailability = Record<
  StudioEditorCommand,
  boolean
>;

export function getStudioEditorCommandAvailability(input: {
  disabled?: boolean;
  mode: StudioEditorMode;
  model: ComposedEditorModel;
}): StudioEditorCommandAvailability {
  const { disabled, mode, model } = input;
  const globallyDisabled = Boolean(disabled);
  const isEditing = mode.type === "editing";
  const selectedIndex =
    mode.type === "navigating" && mode.selectedBlockId
      ? model.blocks.findIndex((block) => block.id === mode.selectedBlockId)
      : -1;
  const hasSelectedBlock = selectedIndex >= 0;

  return {
    cancel_edit: !globallyDisabled && isEditing,
    confirm_edit: !globallyDisabled && isEditing,
    enter_edit_mode: !globallyDisabled && !isEditing && hasSelectedBlock,
    exit_edit_mode: !globallyDisabled && isEditing,
    insert_block: !globallyDisabled && !isEditing,
    navigate_next_block:
      !globallyDisabled &&
      !isEditing &&
      hasSelectedBlock &&
      selectedIndex < model.blocks.length - 1,
    navigate_previous_block:
      !globallyDisabled && !isEditing && hasSelectedBlock && selectedIndex > 0,
    open_commands: !globallyDisabled,
    open_shortcuts: !globallyDisabled,
  };
}

export function canRunStudioEditorCommand(
  command: StudioEditorCommand,
  input: {
    disabled?: boolean;
    mode: StudioEditorMode;
    model: ComposedEditorModel;
  },
) {
  return getStudioEditorCommandAvailability(input)[command];
}

export function getSelectedBlockIdFromStudioMode(mode: StudioEditorMode) {
  return mode.type === "editing" ? mode.blockId : mode.selectedBlockId;
}

export function getRelativeStudioBlockId(input: {
  direction: "previous" | "next";
  mode: StudioEditorMode;
  model: ComposedEditorModel;
}) {
  const selectedBlockId = getSelectedBlockIdFromStudioMode(input.mode);
  if (!selectedBlockId) {
    return null;
  }

  const currentIndex = input.model.blocks.findIndex(
    (block) => block.id === selectedBlockId,
  );
  if (currentIndex < 0) {
    return null;
  }

  const nextIndex =
    input.direction === "previous" ? currentIndex - 1 : currentIndex + 1;
  return input.model.blocks[nextIndex]?.id ?? null;
}
