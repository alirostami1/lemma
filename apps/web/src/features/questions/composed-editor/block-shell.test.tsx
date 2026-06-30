// @vitest-environment jsdom

import type { DraggableAttributes } from "@dnd-kit/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BlockShell } from "./block-shell";
import type { SortableRenderControls } from "./sortable-block-list";

vi.mock("./block-menu", () => ({
  BlockMenu: () => <div data-testid="block-menu" />,
}));

vi.mock("./editor-tooltip", () => ({
  EditorTooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("BlockShell", () => {
  afterEach(() => cleanup());

  const testDragAttributes = {
    "aria-describedby": "dnd-instructions",
    "aria-disabled": false,
    "aria-pressed": false,
    "aria-roledescription": "sortable",
    role: "button",
    tabIndex: 0,
  } satisfies DraggableAttributes;

  function createTestDragControls(
    overrides: Partial<SortableRenderControls> = {},
  ): SortableRenderControls {
    return {
      attributes: testDragAttributes,
      isDragging: false,
      listeners: {},
      setNodeRef: () => {},
      style: {},
      ...overrides,
    };
  }

  it("renders the bottom action slot with hover and focus visibility classes", () => {
    render(
      <BlockShell
        blockId="answer_1"
        blockLabel="Answer"
        bottomAction={<button type="button">Add block</button>}
        canMoveDown
        canMoveUp
        dragControls={createTestDragControls()}
        onCancelEdit={() => {}}
        onConfirmEdit={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onEdit={() => {}}
        onMoveDown={() => {}}
        onMoveUp={() => {}}
        onSelect={() => {}}
        selected={false}
      >
        <div>Content</div>
      </BlockShell>,
    );

    const bottomAction = screen.getByTestId("block-bottom-action");
    expect(bottomAction).toBeTruthy();
    expect(bottomAction.className).toContain("opacity-0");
    expect(bottomAction.className).toContain("group-hover:opacity-100");
    expect(bottomAction.className).toContain("group-focus-within:opacity-100");
    expect(bottomAction.className).toContain("data-[selected=true]");
  });

  it("renders the block label in the shell header", () => {
    render(
      <BlockShell
        blockId="answer_1"
        blockLabel="Answer"
        canMoveDown
        canMoveUp
        dragControls={createTestDragControls()}
        onCancelEdit={() => {}}
        onConfirmEdit={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onEdit={() => {}}
        onMoveDown={() => {}}
        onMoveUp={() => {}}
        onSelect={() => {}}
        selected={false}
      >
        <div>Content</div>
      </BlockShell>,
    );

    expect(screen.getByText("Answer")).toBeTruthy();
  });

  it("selects the block from visible content pointer input", () => {
    const onSelect = vi.fn();

    render(
      <BlockShell
        blockId="answer_1"
        blockLabel="Answer"
        canMoveDown
        canMoveUp
        dragControls={createTestDragControls()}
        onCancelEdit={() => {}}
        onConfirmEdit={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onEdit={() => {}}
        onMoveDown={() => {}}
        onMoveUp={() => {}}
        onSelect={onSelect}
        selected={false}
      >
        <div>Content</div>
      </BlockShell>,
    );

    fireEvent.pointerDown(screen.getByText("Content"));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("keeps shell actions from selecting the block", () => {
    const onSelect = vi.fn();
    const onDuplicate = vi.fn();

    render(
      <BlockShell
        blockId="answer_1"
        blockLabel="Answer"
        canMoveDown
        canMoveUp
        dragControls={createTestDragControls()}
        onCancelEdit={() => {}}
        onConfirmEdit={() => {}}
        onDelete={() => {}}
        onDuplicate={onDuplicate}
        onEdit={() => {}}
        onMoveDown={() => {}}
        onMoveUp={() => {}}
        onSelect={onSelect}
        selected={false}
      >
        <div>Content</div>
      </BlockShell>,
    );

    fireEvent.click(screen.getByLabelText("Duplicate"));

    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows selected state and the block menu", () => {
    render(
      <BlockShell
        blockId="answer_1"
        blockLabel="Answer"
        canMoveDown
        canMoveUp
        dragControls={createTestDragControls()}
        onCancelEdit={() => {}}
        onConfirmEdit={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onEdit={() => {}}
        onMoveDown={() => {}}
        onMoveUp={() => {}}
        onSelect={() => {}}
        selected
      >
        <div>Content</div>
      </BlockShell>,
    );

    expect(screen.getByText("Answer")).toBeTruthy();
    expect(screen.getByTestId("block-menu")).toBeTruthy();
  });
});
