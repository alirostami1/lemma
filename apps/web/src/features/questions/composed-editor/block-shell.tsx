import { Button } from "@lemma/ui/components/button";
import { cn } from "@lemma/ui/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  GripVertical,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { BlockMenu } from "./block-menu";
import { EditorTooltip } from "./editor-tooltip";
import type { SortableRenderControls } from "./sortable-block-list";

export function BlockShell({
  selected,
  editing,
  subdued,
  blockId,
  blockLabel,
  bottomAction,
  settingsAction,
  disabled,
  dragControls,
  canMoveUp,
  canMoveDown,
  onSelect,
  onDelete,
  onDuplicate,
  onEdit,
  onConfirmEdit,
  onCancelEdit,
  onMoveUp,
  onMoveDown,
  children,
}: {
  selected: boolean;
  editing?: boolean;
  subdued?: boolean;
  blockId: string;
  blockLabel: string;
  bottomAction?: ReactNode;
  settingsAction?: ReactNode;
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
  onEdit: () => void;
  onConfirmEdit: () => void;
  onCancelEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-background transition-[border-color,box-shadow,background-color]",
        "outline-none focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        "hover:border-primary/30 hover:bg-background",
        editing
          ? "border-primary shadow-sm ring-2 ring-primary/30"
          : selected
            ? "border-primary shadow-sm ring-2 ring-primary/20"
            : "border-border/70",
        subdued ? "border-border/40 bg-muted/20 shadow-none" : undefined,
        dragControls.isDragging ? "shadow-lg" : undefined,
      )}
      data-editing={editing ? "true" : "false"}
      data-selected={selected ? "true" : "false"}
      data-studio-block-id={blockId}
      data-subdued={subdued ? "true" : "false"}
      onPointerDown={onSelect}
      ref={dragControls.setNodeRef}
      style={dragControls.style}
    >
      <button
        aria-label={`Select ${blockLabel} block`}
        className="sr-only"
        data-studio-block-focus
        data-studio-shortcut-scope="block"
        onClick={onSelect}
        onFocus={onSelect}
        type="button"
      />
      <div className="relative z-10 flex min-h-10 items-center justify-between gap-2 border-b bg-muted/20 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-semibold uppercase text-muted-foreground">
            {blockLabel}
          </span>
          {editing ? (
            <span className="rounded-md bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
              Editing
            </span>
          ) : selected ? (
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-primary"
            />
          ) : null}
        </div>
        <div
          className="flex shrink-0 items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:data-[selected=true]:opacity-100"
          data-selected={selected || editing}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {editing ? (
            <>
              <EditorTooltip label="Done editing">
                <Button
                  aria-label="Done editing"
                  className="size-8 rounded-md"
                  disabled={disabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!disabled) {
                      onConfirmEdit();
                    }
                  }}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Check />
                </Button>
              </EditorTooltip>
              <EditorTooltip label="Cancel changes">
                <Button
                  aria-label="Cancel changes"
                  className="size-8 rounded-md"
                  disabled={disabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!disabled) {
                      onCancelEdit();
                    }
                  }}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X />
                </Button>
              </EditorTooltip>
            </>
          ) : (
            <EditorTooltip label="Edit block">
              <Button
                aria-label="Edit block"
                className="size-8 rounded-md"
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!disabled) {
                    onEdit();
                  }
                }}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Pencil />
              </Button>
            </EditorTooltip>
          )}
          <EditorTooltip label="Move up">
            <Button
              aria-label="Move up"
              className="hidden size-8 rounded-md sm:inline-flex"
              disabled={disabled || !canMoveUp || editing}
              onClick={(event) => {
                event.stopPropagation();
                if (!disabled && !editing && canMoveUp) {
                  onMoveUp();
                }
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <ArrowUp />
            </Button>
          </EditorTooltip>
          <EditorTooltip label="Move down">
            <Button
              aria-label="Move down"
              className="hidden size-8 rounded-md sm:inline-flex"
              disabled={disabled || !canMoveDown || editing}
              onClick={(event) => {
                event.stopPropagation();
                if (!disabled && !editing && canMoveDown) {
                  onMoveDown();
                }
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <ArrowDown />
            </Button>
          </EditorTooltip>
          <EditorTooltip label="Duplicate">
            <Button
              aria-label="Duplicate"
              className="hidden size-8 rounded-md sm:inline-flex"
              disabled={disabled || editing}
              onClick={(event) => {
                event.stopPropagation();
                if (!disabled && !editing) {
                  onDuplicate();
                }
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Copy />
            </Button>
          </EditorTooltip>
          <EditorTooltip label="Delete">
            <Button
              aria-label="Delete"
              className="hidden size-8 rounded-md text-destructive hover:text-destructive sm:inline-flex"
              disabled={disabled || editing}
              onClick={(event) => {
                event.stopPropagation();
                if (!disabled && !editing) {
                  onDelete();
                }
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Trash2 />
            </Button>
          </EditorTooltip>
          <EditorTooltip label="Reorder block">
            <Button
              aria-label="Reorder block"
              className={cn(
                "size-8 rounded-md touch-none cursor-grab active:cursor-grabbing",
                dragControls.isDragging ? "text-primary" : undefined,
              )}
              disabled={disabled || editing}
              onClick={(event) => event.stopPropagation()}
              size="icon"
              type="button"
              variant="ghost"
              {...dragControls.attributes}
              {...dragControls.listeners}
            >
              <GripVertical />
            </Button>
          </EditorTooltip>

          <BlockMenu
            canMoveDown={canMoveDown && !editing}
            canMoveUp={canMoveUp && !editing}
            className="sm:hidden"
            disabled={disabled || editing}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onMoveDown={onMoveDown}
            onMoveUp={onMoveUp}
          />
        </div>
      </div>

      <div
        className="relative z-10 grid gap-3 p-3 sm:p-4"
        data-selected={selected}
        data-studio-block-body
      >
        <div className="min-h-1">{children}</div>
      </div>
      {settingsAction ? (
        <div onPointerDown={(event) => event.stopPropagation()}>
          {settingsAction}
        </div>
      ) : null}
      {bottomAction ? (
        <div
          className={cn(
            "pointer-events-none absolute -bottom-4 left-1/2 z-20 flex -translate-x-1/2 justify-center rounded-full border bg-background/95 opacity-0 shadow-sm transition duration-150",
            "group-hover:pointer-events-auto group-hover:opacity-100",
            "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
            "data-[selected=true]:pointer-events-auto data-[selected=true]:opacity-100",
          )}
          data-selected={selected || editing}
          data-testid="block-bottom-action"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {bottomAction}
        </div>
      ) : null}
    </div>
  );
}
