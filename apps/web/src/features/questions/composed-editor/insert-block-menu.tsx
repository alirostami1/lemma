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
  { type: "text", label: "Text", Icon: Type },
  { type: "rich_text", label: "Rich text", Icon: Pilcrow },
  { type: "response", label: "Answer", Icon: CircleDot },
  { type: "table", label: "Table", Icon: Table2 },
  { type: "separator", label: "Divider", Icon: Minus },
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
          type="button"
          variant={compact ? "ghost" : "outline"}
          size={compact ? "icon" : "sm"}
          disabled={disabled}
          aria-label="Add block"
          title={compact ? "Add block" : undefined}
          onClick={(event) => event.stopPropagation()}
        >
          <Plus />
          {compact ? null : "Add block"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {blockMenuItems.map(({ type, label, Icon }) => (
          <DropdownMenuItem
            key={type}
            className="gap-2"
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
