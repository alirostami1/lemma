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
        getTableSelectionForBlock={() => ({ type: "table" })}
        model={model}
        onDeleteBlock={() => {}}
        onDuplicateBlock={() => {}}
        onInsertBlock={() => {}}
        onModelChange={() => {}}
        onMoveBlock={() => {}}
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

  it("edits the selected block inline and previews the rest", () => {
    const model = createDefaultComposedEditorModel();
    const firstBlock = model.blocks[0];
    if (!firstBlock) {
      throw new Error("Expected default composed model to contain blocks.");
    }

    render(
      <BlockList
        getTableSelectionForBlock={() => ({ type: "table" })}
        model={model}
        onDeleteBlock={() => {}}
        onDuplicateBlock={() => {}}
        onInsertBlock={() => {}}
        onModelChange={() => {}}
        onMoveBlock={() => {}}
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
    const secondBlock = model.blocks[1];
    if (!secondBlock) {
      throw new Error("Expected default composed model to contain blocks.");
    }
    expect(screen.getByTestId("block-preview").textContent).toBe(
      secondBlock.type,
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
        getTableSelectionForBlock={() => ({ type: "table" })}
        model={model}
        onDeleteBlock={() => {}}
        onDuplicateBlock={() => {}}
        onInsertBlock={() => {}}
        onModelChange={() => {}}
        onMoveBlock={() => {}}
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
        getTableSelectionForBlock={() => ({ type: "table" })}
        model={model}
        onDeleteBlock={() => {}}
        onDuplicateBlock={() => {}}
        onInsertBlock={() => {}}
        onModelChange={() => {}}
        onMoveBlock={() => {}}
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
