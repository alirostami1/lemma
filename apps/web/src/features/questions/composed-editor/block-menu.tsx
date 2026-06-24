import { Button } from "@lemma/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@lemma/ui/components/dropdown-menu";
import { cn } from "@lemma/ui/lib/utils";
import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Trash2 } from "lucide-react";

export function BlockMenu({
  className,
  disabled,
  canMoveUp,
  canMoveDown,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  className?: string;
  disabled?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onDuplicate(): void;
  onMoveUp(): void;
  onMoveDown(): void;
  onDelete(): void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="More block actions"
          className={cn("size-8 rounded-md", className)}
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
          size="icon"
          title="More block actions"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          disabled={disabled || !canMoveUp}
          onSelect={() => {
            if (!disabled && canMoveUp) {
              onMoveUp();
            }
          }}
        >
          <ArrowUp />
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={disabled || !canMoveDown}
          onSelect={() => {
            if (!disabled && canMoveDown) {
              onMoveDown();
            }
          }}
        >
          <ArrowDown />
          Move down
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={disabled}
          onSelect={() => {
            if (!disabled) {
              onDuplicate();
            }
          }}
        >
          <Copy />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={disabled}
          onSelect={() => {
            if (!disabled) {
              onDelete();
            }
          }}
        >
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
