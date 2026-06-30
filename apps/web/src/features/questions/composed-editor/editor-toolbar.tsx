import { Button } from "@lemma/ui/components/button";
import { HelpCircle, Pencil, Plus, SkipBack, SkipForward } from "lucide-react";
import type { ReactNode } from "react";
import { EditorTooltip } from "./editor-tooltip";
import type {
  StudioEditorCommand,
  StudioEditorCommandAvailability,
} from "./studio-editor-command-model";

export function EditorToolbar({
  blockCount,
  commandAvailability,
  onRunCommand,
}: {
  blockCount: number;
  commandAvailability: StudioEditorCommandAvailability;
  onRunCommand(command: StudioEditorCommand): void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold">Canvas</p>
        <p className="text-xs text-muted-foreground">
          {blockCount} {blockCount === 1 ? "block" : "blocks"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <EditorToolbarButton
          disabled={!commandAvailability.navigate_previous_block}
          icon={<SkipBack />}
          label="Previous block"
          onClick={() => onRunCommand("navigate_previous_block")}
        />
        <EditorToolbarButton
          disabled={!commandAvailability.navigate_next_block}
          icon={<SkipForward />}
          label="Next block"
          onClick={() => onRunCommand("navigate_next_block")}
        />
        <EditorToolbarButton
          disabled={!commandAvailability.enter_edit_mode || blockCount === 0}
          icon={<Pencil />}
          label="Edit selected block"
          onClick={() => onRunCommand("enter_edit_mode")}
        />
        <EditorToolbarButton
          disabled={!commandAvailability.insert_block}
          icon={<Plus />}
          label="Insert block"
          onClick={() => onRunCommand("insert_block")}
        />
        <EditorToolbarButton
          disabled={!commandAvailability.open_shortcuts}
          icon={<HelpCircle />}
          label="Keyboard shortcuts"
          onClick={() => onRunCommand("open_shortcuts")}
        />
      </div>
    </div>
  );
}

function EditorToolbarButton({
  disabled,
  icon,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <EditorTooltip label={label}>
      <Button
        aria-label={label}
        className="size-8 rounded-md"
        disabled={disabled}
        onClick={onClick}
        size="icon"
        type="button"
        variant="ghost"
      >
        {icon}
      </Button>
    </EditorTooltip>
  );
}
