import { Button } from "@lemma/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@lemma/ui/components/dropdown-menu";
import {
  CircleDot,
  type LucideIcon,
  Minus,
  Pilcrow,
  Plus,
  Table2,
  Type,
} from "lucide-react";
import type { InsertComposedBlockType } from "./composed-editor-operations";

export type InsertBlockType = InsertComposedBlockType;

const blockMenuItems: Array<{
  type: InsertBlockType;
  label: string;
  Icon: LucideIcon;
}> = [
  { Icon: Type, label: "Text", type: "text" },
  { Icon: Pilcrow, label: "Rich text", type: "rich_text" },
  { Icon: CircleDot, label: "Answer", type: "response" },
  { Icon: Table2, label: "Table", type: "table" },
  { Icon: Minus, label: "Divider", type: "separator" },
];

export function InsertBlockMenu({
  disabled,
  onInsert,
  compact,
}: {
  disabled?: boolean;
  onInsert: (type: InsertBlockType) => void;
  compact?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Add block"
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
          size={compact ? "icon" : "sm"}
          title={compact ? "Add block" : undefined}
          type="button"
          variant={compact ? "ghost" : "outline"}
        >
          <Plus />
          {compact ? null : "Add block"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {blockMenuItems.map(({ type, label, Icon }) => (
          <DropdownMenuItem
            className="gap-2"
            key={type}
            onSelect={() => onInsert(type)}
          >
            <Icon className="size-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
