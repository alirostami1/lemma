// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ComposedEditorModel,
  createDefaultComposedEditorModel,
  createRichTextBlock,
  createSeparatorBlock,
  createTableBlock,
} from "#/domains/questions/authoring";
import { BlockList } from "./block-list";
import type { EditorSelection } from "./editor-selection";
import type { StudioEditorCommandAvailability } from "./studio-editor-command-model";

vi.mock("./block-editor", () => ({
  BlockEditor: ({ block }: { block: { type: string } }) => (
    <div data-testid="block-editor">{block.type}</div>
  ),
}));

vi.mock("./block-preview", () => ({
  BlockPreview: ({ block }: { block: { type: string } }) => (
    <div data-testid="block-preview">{block.type}</div>
  ),
}));

vi.mock("./block-settings-disclosure", () => ({
  BlockSettingsDisclosure: ({
    block,
    disabled,
  }: {
    block: { id: string; type: string };
    disabled?: boolean;
  }) =>
    block.type === "response" || block.type === "table" ? (
      <button data-testid="block-settings" disabled={disabled} type="button">
        Settings for {block.id}
      </button>
    ) : null,
}));

vi.mock("./block-menu", () => ({
  BlockMenu: () => <div data-testid="block-menu" />,
}));

vi.mock("./insert-block-menu", () => ({
  InsertBlockMenu: () => <div data-testid="insert-block-menu" />,
}));

vi.mock("./editor-tooltip", () => ({
  EditorTooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const testCommandAvailability: StudioEditorCommandAvailability = {
  cancel_edit: false,
  confirm_edit: false,
  enter_edit_mode: true,
  exit_edit_mode: false,
  insert_block: true,
  navigate_next_block: true,
  navigate_previous_block: true,
  open_commands: true,
  open_shortcuts: true,
};

describe("BlockList", () => {
  afterEach(() => cleanup());

  it("renders product labels for every composed block", () => {
    const model = createDefaultComposedEditorModel();
    const textBlock = model.blocks[0];
    const answerBlock = model.blocks[1];
    if (!textBlock || !answerBlock) {
      throw new Error("Expected default composed model to contain blocks.");
    }
    model.blocks = [
      textBlock,
      createRichTextBlock("rich_text_1"),
      answerBlock,
      createSeparatorBlock("separator_1"),
      createTableBlock("table_1"),
    ];

    renderBlockList({ model, selectedBlockId: "text_1" });

    expect(screen.getByText("Text")).toBeTruthy();
    expect(screen.getByText("Rich text")).toBeTruthy();
    expect(screen.getByText("Answer")).toBeTruthy();
    expect(screen.getByText("Table")).toBeTruthy();
    expect(screen.getByText("Divider")).toBeTruthy();
  });

  it("does not render the old canvas toolbar or global block library", () => {
    renderBlockList();

    expect(screen.queryByText("Canvas")).toBeNull();
    expect(screen.queryByLabelText("Insert block")).toBeNull();
    expect(screen.queryByTestId("block-library")).toBeNull();
  });

  it("previews the selected block until editing starts", () => {
    const model = createDefaultComposedEditorModel();
    const firstBlock = model.blocks[0];
    if (!firstBlock) {
      throw new Error("Expected default composed model to contain blocks.");
    }

    renderBlockList({ model, selectedBlockId: firstBlock.id });

    expect(screen.getAllByTestId("block-preview")).toHaveLength(2);
  });

  it("edits the active editing block and quiets surrounding blocks", () => {
    const model = createDefaultComposedEditorModel();
    const firstBlock = model.blocks[0];
    const secondBlock = model.blocks[1];
    if (!firstBlock || !secondBlock) {
      throw new Error("Expected default composed model to contain blocks.");
    }

    renderBlockList({
      editingBlockId: firstBlock.id,
      model,
      selectedBlockId: firstBlock.id,
    });

    expect(screen.getByTestId("block-editor").textContent).toBe(
      firstBlock.type,
    );
    expect(getBlockShell(firstBlock.id)).toHaveAttribute(
      "data-subdued",
      "false",
    );
    expect(getBlockShell(secondBlock.id)).toHaveAttribute(
      "data-subdued",
      "true",
    );
    expect(screen.getByText(secondBlock.type)).toBeVisible();
  });

  it("renders a local settings surface for the selected block", () => {
    const model = createDefaultComposedEditorModel();
    const answerBlock = model.blocks[1];
    if (!answerBlock) {
      throw new Error("Expected default composed model to contain blocks.");
    }

    renderBlockList({
      model,
      selectedBlockId: answerBlock.id,
      selection: { blockId: answerBlock.id, type: "block" },
    });

    expect(screen.getByTestId("block-settings")).toHaveTextContent(
      `Settings for ${answerBlock.id}`,
    );
  });

  it("does not render empty settings for blocks without local options", () => {
    const model = createDefaultComposedEditorModel();
    const textBlock = model.blocks[0];
    if (!textBlock) {
      throw new Error("Expected default composed model to contain blocks.");
    }

    renderBlockList({
      model,
      selectedBlockId: textBlock.id,
      selection: { blockId: textBlock.id, type: "block" },
    });

    expect(screen.queryByTestId("block-settings")).toBeNull();
  });

  it("renders a bottom insert menu for each block regardless of selection", () => {
    const model = createDefaultComposedEditorModel();
    const firstBlock = model.blocks[0];
    if (!firstBlock) {
      throw new Error("Expected default composed model to contain blocks.");
    }

    const { rerender } = renderBlockList({
      model,
      selectedBlockId: null,
      selection: { type: "document" },
    });

    expect(screen.getAllByTestId("insert-block-menu")).toHaveLength(
      model.blocks.length,
    );

    rerender(
      <TestBlockList
        model={model}
        selectedBlockId={firstBlock.id}
        selection={{ blockId: firstBlock.id, type: "block" }}
      />,
    );

    expect(screen.getAllByTestId("insert-block-menu")).toHaveLength(
      model.blocks.length,
    );
  });
});

function renderBlockList(input: Partial<TestBlockListProps> = {}) {
  return render(<TestBlockList {...input} />);
}

type TestBlockListProps = {
  model: ComposedEditorModel;
  selectedBlockId: string | null;
  editingBlockId: string | null;
  selection: EditorSelection;
};

function TestBlockList({
  model = createDefaultComposedEditorModel(),
  selectedBlockId = model.blocks[0]?.id ?? null,
  editingBlockId = null,
  selection = selectedBlockId
    ? { blockId: selectedBlockId, type: "block" }
    : { type: "document" },
}: Partial<TestBlockListProps>) {
  return (
    <BlockList
      commandAvailability={testCommandAvailability}
      editingBlockId={editingBlockId}
      getTableSelectionForBlock={() => ({ type: "table" })}
      model={model}
      onCancelEdit={() => {}}
      onConfirmEdit={() => {}}
      onDeleteBlock={() => {}}
      onDuplicateBlock={() => {}}
      onEditBlock={() => {}}
      onInsertBlock={() => {}}
      onModelChange={() => {}}
      onMoveBlock={() => {}}
      onSelectBlock={() => {}}
      onSelectionChange={() => {}}
      onSelectReference={() => {}}
      onTableSelectionChange={() => {}}
      referencePreviewCache={{}}
      selectedBlockId={selectedBlockId}
      selection={selection}
      sources={[]}
      workbookEnabled={false}
      workbookSheetNamesBySourceId={{}}
    />
  );
}

function getBlockShell(blockId: string) {
  const block = document.querySelector(`[data-studio-block-id="${blockId}"]`);
  if (!block) {
    throw new Error(`Expected block shell for ${blockId}.`);
  }
  return block;
}
