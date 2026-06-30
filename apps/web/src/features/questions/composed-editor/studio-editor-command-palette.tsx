import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@lemma/ui/components/command";
import { Keyboard, MousePointer2 } from "lucide-react";
import {
  INSERT_BLOCK_MENU_ITEMS,
  type InsertBlockType,
} from "./insert-block-menu";
import type { StudioEditorCommandAvailability } from "./studio-editor-command-model";
import { STUDIO_KEYBINDINGS } from "./studio-keybindings";

export function StudioEditorCommandPalette({
  commandAvailability,
  open,
  onOpenChange,
  onCancelEdit,
  onConfirmEdit,
  onEnterEditMode,
  onInsertBlock,
  onOpenShortcuts,
}: {
  commandAvailability: StudioEditorCommandAvailability;
  open: boolean;
  onOpenChange(open: boolean): void;
  onCancelEdit(): void;
  onConfirmEdit(): void;
  onEnterEditMode(): void;
  onInsertBlock(type: InsertBlockType): void;
  onOpenShortcuts(): void;
}) {
  function runCommand(available: boolean, command: () => void) {
    if (!available) {
      return;
    }
    onOpenChange(false);
    command();
  }

  return (
    <CommandDialog
      description="Run Studio editing commands."
      onOpenChange={onOpenChange}
      open={open}
      showCloseButton
      title="Studio commands"
    >
      <Command>
        <CommandInput placeholder="Search commands..." />
        <CommandList>
          <CommandEmpty>No commands found.</CommandEmpty>
          <CommandGroup heading="Insert block">
            {INSERT_BLOCK_MENU_ITEMS.map(({ Icon, label, type }) => (
              <CommandItem
                disabled={!commandAvailability.insert_block}
                key={type}
                onSelect={() =>
                  runCommand(commandAvailability.insert_block, () =>
                    onInsertBlock(type),
                  )
                }
              >
                <Icon />
                Add {label.toLowerCase()}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Editing">
            <CommandItem
              disabled={!commandAvailability.enter_edit_mode}
              onSelect={() =>
                runCommand(commandAvailability.enter_edit_mode, onEnterEditMode)
              }
            >
              <MousePointer2 />
              Edit selected block
              <CommandShortcut>
                {getShortcutLabel("enter_edit_mode")}
              </CommandShortcut>
            </CommandItem>
            <CommandItem
              disabled={!commandAvailability.confirm_edit}
              onSelect={() =>
                runCommand(commandAvailability.confirm_edit, onConfirmEdit)
              }
            >
              Done editing
              <CommandShortcut>
                {getShortcutLabel("confirm_edit")}
              </CommandShortcut>
            </CommandItem>
            <CommandItem
              disabled={!commandAvailability.cancel_edit}
              onSelect={() =>
                runCommand(commandAvailability.cancel_edit, onCancelEdit)
              }
            >
              Cancel changes
              <CommandShortcut>
                {getShortcutLabel("cancel_edit")}
              </CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Help">
            <CommandItem
              disabled={!commandAvailability.open_shortcuts}
              onSelect={() =>
                runCommand(commandAvailability.open_shortcuts, onOpenShortcuts)
              }
            >
              <Keyboard />
              Keyboard shortcuts
              <CommandShortcut>
                {getShortcutLabel("open_shortcuts")}
              </CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

function getShortcutLabel(
  action: (typeof STUDIO_KEYBINDINGS)[number]["action"],
) {
  return (
    STUDIO_KEYBINDINGS.find((binding) => binding.action === action)?.keys[0] ??
    ""
  );
}
