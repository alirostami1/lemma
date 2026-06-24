import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DraggableAttributes,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";

export type SortableRenderControls = {
  attributes: DraggableAttributes;
  listeners: Record<string, unknown> | undefined;
  setNodeRef(node: HTMLElement | null): void;
  style: CSSProperties;
  isDragging: boolean;
};

export function SortableBlockList<T extends { id: string }>({
  items,
  disabled,
  onReorder,
  renderItem,
  renderOverlay,
}: {
  items: T[];
  disabled?: boolean;
  onReorder(items: T[]): void;
  renderItem(item: T, controls: SortableRenderControls): ReactNode;
  renderOverlay?(item: T, style: CSSProperties): ReactNode;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeOverlayStyle, setActiveOverlayStyle] = useState<CSSProperties>(
    {},
  );
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const activeItem = activeId
    ? items.find((item) => item.id === activeId)
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setActiveOverlayStyle({
      width: event.active.rect.current.initial?.width,
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    setActiveOverlayStyle({});
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  function handleDragCancel() {
    setActiveId(null);
    setActiveOverlayStyle({});
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {items.map((item) => (
            <SortableBlockListItem
              disabled={disabled}
              item={item}
              key={item.id}
              renderItem={renderItem}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 180 }}>
        {activeItem && renderOverlay
          ? renderOverlay(activeItem, activeOverlayStyle)
          : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableBlockListItem<T extends { id: string }>({
  item,
  disabled,
  renderItem,
}: {
  item: T;
  disabled?: boolean;
  renderItem(item: T, controls: SortableRenderControls): ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    disabled,
    id: item.id,
  });

  return renderItem(item, {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    style: {
      opacity: isDragging ? 0.35 : 1,
      position: "relative",
      transform: CSS.Translate.toString(transform),
      transition,
      willChange: isDragging ? "transform" : undefined,
      zIndex: isDragging ? 10 : undefined,
    },
  });
}
