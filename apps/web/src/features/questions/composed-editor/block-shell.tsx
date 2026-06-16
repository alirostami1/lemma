import { Button } from "@lemma/ui/components/button";
import { cn } from "@lemma/ui/lib/utils";
import { ArrowDown, ArrowUp, Copy, GripVertical, Trash2 } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { BlockMenu } from "./block-menu";
import { EditorTooltip } from "./editor-tooltip";
import type { SortableRenderControls } from "./sortable-block-list";

export function BlockShell({
  selected,
  blockLabel,
  bottomAction,
  disabled,
  dragControls,
  canMoveUp,
  canMoveDown,
  onSelect,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  children,
}: {
  selected: boolean;
  blockLabel: string;
  bottomAction?: ReactNode;
  disabled?: boolean;
  dragControls: {
    attributes: SortableRenderControls["attributes"];
    listeners: Record<string, unknown> | undefined;
    setNodeRef(node: HTMLElement | null): void;
    style: CSSProperties;
    isDragging: boolean;
  };
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  children: ReactNode;
}) {
  return (
    <div
      ref={dragControls.setNodeRef}
      style={dragControls.style}
      className={cn(
        "group relative rounded-lg border bg-background transition-[border-color,box-shadow,background-color]",
        "hover:border-primary/30 hover:bg-background",
        selected
          ? "border-primary shadow-sm ring-2 ring-primary/20"
          : "border-border/70",
        dragControls.isDragging ? "shadow-lg" : undefined,
      )}
      data-selected={selected}
      onPointerDown={onSelect}
    >
      <button
        type="button"
        className="sr-only"
        aria-label={`Select ${blockLabel} block`}
        onClick={onSelect}
      />
      <div className="relative z-10 flex min-h-10 items-center justify-between gap-2 border-b bg-muted/20 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-semibold uppercase text-muted-foreground">
            {blockLabel}
          </span>
          {selected ? (
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-primary"
            />
          ) : null}
        </div>
        <div
          data-selected={selected}
          className="flex shrink-0 items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:data-[selected=true]:opacity-100"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <EditorTooltip label="Move up">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden size-8 rounded-md sm:inline-flex"
              disabled={disabled || !canMoveUp}
              aria-label="Move up"
              onClick={(event) => {
                event.stopPropagation();
                if (!disabled && canMoveUp) {
                  onMoveUp();
                }
              }}
            >
              <ArrowUp />
            </Button>
          </EditorTooltip>
          <EditorTooltip label="Move down">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden size-8 rounded-md sm:inline-flex"
              disabled={disabled || !canMoveDown}
              aria-label="Move down"
              onClick={(event) => {
                event.stopPropagation();
                if (!disabled && canMoveDown) {
                  onMoveDown();
                }
              }}
            >
              <ArrowDown />
            </Button>
          </EditorTooltip>
          <EditorTooltip label="Duplicate">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden size-8 rounded-md sm:inline-flex"
              disabled={disabled}
              aria-label="Duplicate"
              onClick={(event) => {
                event.stopPropagation();
                if (!disabled) {
                  onDuplicate();
                }
              }}
            >
              <Copy />
            </Button>
          </EditorTooltip>
          <EditorTooltip label="Delete">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden size-8 rounded-md text-destructive hover:text-destructive sm:inline-flex"
              disabled={disabled}
              aria-label="Delete"
              onClick={(event) => {
                event.stopPropagation();
                if (!disabled) {
                  onDelete();
                }
              }}
            >
              <Trash2 />
            </Button>
          </EditorTooltip>
          <EditorTooltip label="Reorder block">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 rounded-md touch-none cursor-grab active:cursor-grabbing",
                dragControls.isDragging ? "text-primary" : undefined,
              )}
              disabled={disabled}
              aria-label="Reorder block"
              onClick={(event) => event.stopPropagation()}
              {...dragControls.attributes}
              {...dragControls.listeners}
            >
              <GripVertical />
            </Button>
          </EditorTooltip>

          <BlockMenu
            className="sm:hidden"
            disabled={disabled}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        </div>
      </div>

      <div
        data-selected={selected}
        className="relative z-10 grid gap-3 p-3 sm:p-4"
      >
        <div className="min-h-1">{children}</div>
      </div>
      {bottomAction ? (
        <div
          data-testid="block-bottom-action"
          data-selected={selected}
          className={cn(
            "pointer-events-none absolute -bottom-4 left-1/2 z-20 flex -translate-x-1/2 justify-center rounded-full border bg-background/95 opacity-0 shadow-sm transition duration-150",
            "group-hover:pointer-events-auto group-hover:opacity-100",
            "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
            "data-[selected=true]:pointer-events-auto data-[selected=true]:opacity-100",
          )}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {bottomAction}
        </div>
      ) : null}
    </div>
  );
}
