// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultComposedEditorModel,
  createRichTextBlock,
  createSeparatorBlock,
  createTableBlock,
} from "#/domains/questions/authoring";
import { BlockList } from "./block-list";
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

vi.mock("./block-library", () => ({
  BlockLibrary: () => <div data-testid="block-library" />,
}));

vi.mock("./editor-toolbar", () => ({
  EditorToolbar: () => <div data-testid="editor-toolbar" />,
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

    render(
      <BlockList
        commandAvailability={testCommandAvailability}
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
        onRunCommand={() => {}}
        onSelectBlock={() => {}}
        onSelectReference={() => {}}
        onTableSelectionChange={() => {}}
        referencePreviewCache={{}}
        selectedBlockId="text_1"
        sources={[]}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    expect(screen.getByText("Text")).toBeTruthy();
    expect(screen.getByText("Rich text")).toBeTruthy();
    expect(screen.getByText("Answer")).toBeTruthy();
    expect(screen.getByText("Table")).toBeTruthy();
    expect(screen.getByText("Divider")).toBeTruthy();
  });

  it("previews the selected block until editing starts", () => {
    const model = createDefaultComposedEditorModel();
    const firstBlock = model.blocks[0];
    if (!firstBlock) {
      throw new Error("Expected default composed model to contain blocks.");
    }

    render(
      <BlockList
        commandAvailability={testCommandAvailability}
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
        onRunCommand={() => {}}
        onSelectBlock={() => {}}
        onSelectReference={() => {}}
        onTableSelectionChange={() => {}}
        referencePreviewCache={{}}
        selectedBlockId={firstBlock.id}
        sources={[]}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    expect(screen.getAllByTestId("block-preview")).toHaveLength(2);
  });

  it("edits the active editing block", () => {
    const model = createDefaultComposedEditorModel();
    const firstBlock = model.blocks[0];
    if (!firstBlock) {
      throw new Error("Expected default composed model to contain blocks.");
    }

    render(
      <BlockList
        commandAvailability={testCommandAvailability}
        editingBlockId={firstBlock.id}
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
        onRunCommand={() => {}}
        onSelectBlock={() => {}}
        onSelectReference={() => {}}
        onTableSelectionChange={() => {}}
        referencePreviewCache={{}}
        selectedBlockId={firstBlock.id}
        sources={[]}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    expect(screen.getByTestId("block-editor").textContent).toBe(
      firstBlock.type,
    );
  });

  it("renders a bottom insert menu for each block regardless of selection", () => {
    const model = createDefaultComposedEditorModel();
    const firstBlock = model.blocks[0];
    if (!firstBlock) {
      throw new Error("Expected default composed model to contain blocks.");
    }

    const { rerender } = render(
      <BlockList
        commandAvailability={testCommandAvailability}
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
        onRunCommand={() => {}}
        onSelectBlock={() => {}}
        onSelectReference={() => {}}
        onTableSelectionChange={() => {}}
        referencePreviewCache={{}}
        selectedBlockId={null}
        sources={[]}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    expect(screen.getAllByTestId("insert-block-menu")).toHaveLength(
      model.blocks.length,
    );

    rerender(
      <BlockList
        commandAvailability={testCommandAvailability}
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
        onRunCommand={() => {}}
        onSelectBlock={() => {}}
        onSelectReference={() => {}}
        onTableSelectionChange={() => {}}
        referencePreviewCache={{}}
        selectedBlockId={firstBlock.id}
        sources={[]}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    expect(screen.getAllByTestId("insert-block-menu")).toHaveLength(
      model.blocks.length,
    );
  });
});
