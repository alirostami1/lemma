// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, type ReactNode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ComposedEditorModel,
  createDefaultComposedEditorModel,
  createDefaultTableEditorModel,
  createRichTextBlock,
  createTableBlock,
} from "#/domains/questions/authoring";
import { ComposedQuestionEditor } from "./composed-question-editor";

vi.mock("./editor-tooltip", () => ({
  EditorTooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("ComposedQuestionEditor keyboard workflows", () => {
  afterEach(() => cleanup());

  it("uses a full-width sequential editor without a persistent settings side panel", () => {
    renderEditor();

    const editor = screen.getByRole("region", { name: "Question editor" });

    expect(editor).toHaveClass("grid");
    expect(editor).not.toHaveClass("xl:grid-cols-[minmax(0,1fr)_22rem]");
    expect(
      screen.queryByRole("complementary", { name: "Element settings" }),
    ).toBeNull();
  });

  it("shows local settings only for blocks that have them", async () => {
    const user = userEvent.setup();
    const model = createDefaultComposedEditorModel();
    model.blocks.push(createTableBlock("table_1"));
    renderEditor(model);

    expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();

    getBlockFocus("Answer").focus();
    await user.click(await screen.findByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { name: "Answer" })).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Value mode" }),
    ).toBeInTheDocument();

    const tableBlock = getBlockFocus("Table");
    tableBlock.focus();
    await waitFor(() =>
      expect(getBlockShell(tableBlock)).toHaveAttribute(
        "data-selected",
        "true",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(
      screen.getByRole("button", { name: "Add reference" }),
    ).toBeInTheDocument();
  });

  it("moves focus and selection between blocks from block focus surfaces", async () => {
    const user = userEvent.setup();
    renderEditor();

    const textBlock = getBlockFocus("Text");
    textBlock.focus();
    await user.keyboard("{ArrowDown}");

    const answerBlock = getBlockFocus("Answer");
    await waitFor(() => expect(answerBlock).toHaveFocus());
    expect(getBlockShell(answerBlock)).toHaveAttribute("data-selected", "true");

    fireEvent.keyDown(answerBlock, { key: "ArrowUp", shiftKey: true });
    expect(answerBlock).toHaveFocus();
    expect(getBlockShell(answerBlock)).toHaveAttribute("data-selected", "true");

    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(textBlock).toHaveFocus());
    expect(getBlockShell(textBlock)).toHaveAttribute("data-selected", "true");
  });

  it("enters, exits, confirms, and cancels edit mode predictably", async () => {
    const user = userEvent.setup();
    const editor = renderEditor();
    const textBlock = getBlockFocus("Text");

    textBlock.focus();
    await user.keyboard("{Enter}");
    const textarea = await screen.findByLabelText("Text segment 1");
    await waitFor(() => expect(textarea).toHaveFocus());

    await user.clear(textarea);
    await user.type(textarea, "Changed prompt");
    fireEvent.keyDown(textarea, { key: "Escape" });
    await waitFor(() =>
      expect(getBlockShell(textBlock)).toHaveAttribute("data-editing", "false"),
    );
    expect(getFirstText(editor.getModel())).toBe("Changed prompt");

    textBlock.focus();
    await user.keyboard("{Enter}");
    await user.clear(await screen.findByLabelText("Text segment 1"));
    await user.type(screen.getByLabelText("Text segment 1"), "Confirmed");
    fireEvent.keyDown(screen.getByLabelText("Text segment 1"), {
      ctrlKey: true,
      key: "Enter",
    });
    await waitFor(() => expect(textBlock).toHaveFocus());
    expect(getFirstText(editor.getModel())).toBe("Confirmed");

    await user.keyboard("{Enter}");
    await user.clear(await screen.findByLabelText("Text segment 1"));
    await user.type(screen.getByLabelText("Text segment 1"), "Discard me");
    fireEvent.keyDown(screen.getByLabelText("Text segment 1"), {
      ctrlKey: true,
      key: ".",
    });
    await waitFor(() => expect(textBlock).toHaveFocus());
    expect(getFirstText(editor.getModel())).toBe("Confirmed");
  });

  it("runs table edit lifecycle shortcuts from the named table editor surface", async () => {
    const user = userEvent.setup();
    const defaultModel = createDefaultComposedEditorModel();
    const firstBlock = defaultModel.blocks[0];
    const lastBlock = defaultModel.blocks[1];
    if (!firstBlock || !lastBlock) {
      throw new Error("Expected default model blocks.");
    }
    const editor = renderEditor({
      ...defaultModel,
      blocks: [
        firstBlock,
        createTableBlock("table_1", {
          ...createDefaultTableEditorModel(),
          cells: [],
        }),
        lastBlock,
      ],
    });
    const tableBlock = getBlockFocus("Table");

    await user.click(tableBlock);
    await user.keyboard("{Enter}");
    const tableEditor = await screen.findByRole("group", {
      name: "Table block editor",
    });
    await waitFor(() => expect(tableEditor).toHaveFocus());

    fireEvent.keyDown(tableEditor, { key: "Escape" });
    await waitFor(() =>
      expect(getBlockShell(tableBlock)).toHaveAttribute(
        "data-editing",
        "false",
      ),
    );

    await user.click(tableBlock);
    await user.keyboard("{Enter}");
    fireEvent.keyDown(
      screen.getByRole("group", { name: "Table block editor" }),
      { ctrlKey: true, key: "Enter" },
    );
    await waitFor(() => expect(tableBlock).toHaveFocus());

    await user.keyboard("{Enter}");
    const editingTable = screen.getByRole("group", {
      name: "Table block editor",
    });
    await user.click(screen.getAllByRole("button", { name: "Empty" })[0]);
    expect(getTableCellCount(editor.getModel())).toBe(1);
    fireEvent.keyDown(editingTable, { ctrlKey: true, key: "." });
    await waitFor(() => expect(tableBlock).toHaveFocus());
    expect(getTableCellCount(editor.getModel())).toBe(0);
  });

  it("opens insert commands from a safe block focus surface and focuses the inserted editor", async () => {
    const user = userEvent.setup();
    const editor = renderEditor();

    getBlockFocus("Text").focus();
    await user.keyboard("/");
    expect(
      screen.getByRole("dialog", { name: "Studio commands" }),
    ).toBeTruthy();

    await user.keyboard("text{Enter}");

    await waitFor(() => expect(editor.getModel().blocks).toHaveLength(3));
    expect(editor.getModel().blocks[1]?.type).toBe("text");
    await waitFor(() =>
      expect(screen.getByLabelText("Text segment 1")).toHaveFocus(),
    );
  });

  it("blocks insertion while editing across shortcuts, palette, and inline insert controls", async () => {
    const user = userEvent.setup();
    const editor = renderEditor();
    const textBlock = getBlockFocus("Text");

    textBlock.focus();
    await user.keyboard("{Enter}");
    const textarea = await screen.findByLabelText("Text segment 1");
    fireEvent.keyDown(textarea, { key: "/" });
    expect(
      screen.queryByRole("dialog", { name: "Studio commands" }),
    ).toBeNull();

    fireEvent.keyDown(textarea, { ctrlKey: true, key: "k" });
    expect(
      screen.queryByRole("dialog", { name: "Studio commands" }),
    ).toBeNull();

    textBlock.focus();
    fireEvent.keyDown(textBlock, { ctrlKey: true, key: "k" });
    const palette = await screen.findByRole("dialog", {
      name: "Studio commands",
    });
    expect(palette).toBeTruthy();
    expect(getCommandItem("Add text")).toHaveAttribute("data-disabled", "true");
    fireEvent.click(getCommandItem("Add text"));
    expect(editor.getModel().blocks).toHaveLength(2);
    await user.keyboard("{Escape}");

    for (const addBlock of screen.getAllByRole("button", {
      name: "Add block",
    })) {
      expect(addBlock).toBeDisabled();
    }
  });

  it("does not run Studio shortcuts from text entry, local controls, menu, or table controls", async () => {
    const user = userEvent.setup();
    const defaultModel = createDefaultComposedEditorModel();
    const firstBlock = defaultModel.blocks[0];
    const lastBlock = defaultModel.blocks[1];
    if (!firstBlock || !lastBlock) {
      throw new Error("Expected default model blocks.");
    }
    renderEditor({
      ...defaultModel,
      blocks: [
        firstBlock,
        createRichTextBlock("rich_text_1"),
        createTableBlock("table_1"),
        lastBlock,
      ],
    });

    getBlockFocus("Text").focus();
    await user.keyboard("{Enter}");
    const textarea = await screen.findByLabelText("Text segment 1");
    fireEvent.keyDown(textarea, { key: "ArrowDown" });
    fireEvent.keyDown(textarea, { key: "/" });
    fireEvent.keyDown(textarea, { key: "?" });
    fireEvent.keyDown(textarea, { ctrlKey: true, key: "k" });
    expect(getBlockShell(getBlockFocus("Text"))).toHaveAttribute(
      "data-editing",
      "true",
    );
    expect(
      screen.queryByRole("dialog", { name: "Studio commands" }),
    ).toBeNull();
    expect(
      screen.queryByRole("dialog", { name: "Keyboard shortcuts" }),
    ).toBeNull();
    fireEvent.keyDown(textarea, { ctrlKey: true, key: "Enter" });
    await waitFor(() =>
      expect(getBlockShell(getBlockFocus("Text"))).toHaveAttribute(
        "data-editing",
        "false",
      ),
    );

    await editBlockByButton(user, "Rich text");
    const richTextarea = document.querySelector(
      "textarea[data-studio-primary-editor-focus]",
    );
    if (!(richTextarea instanceof HTMLElement)) {
      throw new Error("Expected rich text editor focus target.");
    }
    fireEvent.keyDown(richTextarea, { key: "/" });
    fireEvent.keyDown(richTextarea, { ctrlKey: true, key: "k" });
    fireEvent.keyDown(richTextarea, { key: "F1" });
    expect(
      screen.queryByRole("dialog", { name: "Studio commands" }),
    ).toBeNull();
    expect(
      screen.queryByRole("dialog", { name: "Keyboard shortcuts" }),
    ).toBeNull();
    fireEvent.keyDown(richTextarea, { ctrlKey: true, key: "Enter" });
    await waitFor(() =>
      expect(getBlockShell(getBlockFocus("Rich text"))).toHaveAttribute(
        "data-editing",
        "false",
      ),
    );

    await editBlockByButton(user, "Answer");
    const responseLabelInput = await findPrimaryInput();
    if (!(responseLabelInput instanceof HTMLElement)) {
      throw new Error("Expected response label focus target.");
    }
    fireEvent.keyDown(responseLabelInput, { ctrlKey: true, key: "k" });
    fireEvent.keyDown(responseLabelInput, { key: "?" });
    expect(
      screen.queryByRole("dialog", { name: "Studio commands" }),
    ).toBeNull();
    expect(
      screen.queryByRole("dialog", { name: "Keyboard shortcuts" }),
    ).toBeNull();
    fireEvent.keyDown(responseLabelInput, { ctrlKey: true, key: "Enter" });
    await waitFor(() =>
      expect(getBlockShell(getBlockFocus("Answer"))).toHaveAttribute(
        "data-editing",
        "false",
      ),
    );

    await user.click(screen.getAllByRole("button", { name: "Add block" })[0]);
    const textMenuItem = await screen.findByRole("menuitem", { name: "Text" });
    fireEvent.keyDown(textMenuItem, { key: "/" });
    expect(
      screen.queryByRole("dialog", { name: "Studio commands" }),
    ).toBeNull();
    await user.keyboard("{Escape}");

    await editBlockByButton(user, "Table");
    const tableSurface = screen.getByRole("group", {
      name: "Table block editor",
    });
    fireEvent.keyDown(tableSurface, { key: "/" });
    fireEvent.keyDown(tableSurface, { ctrlKey: true, key: "k" });
    fireEvent.keyDown(tableSurface, { key: "F1" });
    expect(
      screen.queryByRole("dialog", { name: "Studio commands" }),
    ).toBeNull();
    expect(
      screen.queryByRole("dialog", { name: "Keyboard shortcuts" }),
    ).toBeNull();
    fireEvent.keyDown(tableSurface, { ctrlKey: true, key: "Enter" });

    getBlockFocus("Text").focus();
    fireEvent.keyDown(getBlockFocus("Text"), { ctrlKey: true, key: "k" });
    expect(
      screen.getByRole("dialog", { name: "Studio commands" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(screen.getByPlaceholderText("Search commands..."), {
      ctrlKey: true,
      key: "k",
    });
    expect(
      screen.queryByRole("dialog", { name: "Keyboard shortcuts" }),
    ).toBeNull();
  });

  it("opens shortcut help from safe shortcut keys", async () => {
    const user = userEvent.setup();
    renderEditor();

    getBlockFocus("Text").focus();
    await user.keyboard("?");
    expect(
      screen.getByRole("dialog", { name: "Keyboard shortcuts" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Shortcuts work when a block is selected.").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/editor shell/i)).toBeNull();
    expect(screen.queryByText(/reserved keys/i)).toBeNull();
    expect(screen.queryByText(/^Scope$/i)).toBeNull();
    await user.keyboard("{Escape}");

    getBlockFocus("Text").focus();
    await user.keyboard("{F1}");
    expect(
      screen.getByRole("dialog", { name: "Keyboard shortcuts" }),
    ).toBeInTheDocument();
  });

  it("keeps mobile and touch block controls visible and named", async () => {
    const user = userEvent.setup();
    renderEditor();

    expect(
      screen.getAllByRole("button", { name: "Edit block" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Add block" }).length,
    ).toBeGreaterThan(0);

    getBlockFocus("Text").focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("button", { name: "Done editing" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel changes" })).toBeTruthy();
  });

  it("disables local settings changes while editing so cancel keeps unrelated state intact", async () => {
    const user = userEvent.setup();
    const editor = renderEditor();

    getBlockFocus("Answer").focus();
    await user.keyboard("{Enter}");
    const blockLabelInput = document.querySelector(
      "input[data-studio-primary-editor-focus]",
    );
    if (!(blockLabelInput instanceof HTMLInputElement)) {
      throw new Error("Expected answer label focus target.");
    }
    await user.clear(blockLabelInput);
    await user.type(blockLabelInput, "Edited answer");

    expect(screen.getByRole("button", { name: "Settings" })).toBeDisabled();
    expect(editor.getModel().blocks).toHaveLength(2);

    fireEvent.keyDown(blockLabelInput, { ctrlKey: true, key: "." });
    await waitFor(() => expect(getAnswerLabel(editor.getModel())).toBeNull());
    expect(editor.getModel().blocks).toHaveLength(2);
  });

  it("disables recovery actions while a block edit is active", async () => {
    const user = userEvent.setup();
    const model = createDefaultComposedEditorModel();
    const textBlock = model.blocks[0];
    if (textBlock?.type !== "text") {
      throw new Error("Expected the first block to be text.");
    }
    textBlock.content = [
      { referenceId: "reference_internal_1", type: "reference" },
    ];
    model.references = [
      {
        id: "reference_internal_1",
        source: {
          ref: "Sheet1!A1",
          sourceId: "source_internal_1",
          type: "workbook_cell",
        },
      },
    ];
    const editor = renderEditor(model, {
      referenceRecoveryItems: [
        {
          id: "recovery_1",
          referenceId: "reference_internal_1",
          status: "unavailable",
          usage: {
            blockId: textBlock.id,
            inlineContentIndex: 0,
            type: "text_block",
          },
        },
      ],
    });

    getBlockFocus("Text").focus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Review" }));

    const reviewArea = screen.getByRole("button", { name: "Review area" });
    const removeValue = screen.getByRole("button", {
      name: "Remove inserted value",
    });
    expect(reviewArea).toBeDisabled();
    expect(removeValue).toBeDisabled();

    fireEvent.click(reviewArea);
    fireEvent.click(removeValue);
    expect(getBlockShell(getBlockFocus("Text"))).toHaveAttribute(
      "data-editing",
      "true",
    );
    expect(editor.getModel()).toEqual(model);
  });
});

type TestEditorProps = Pick<
  ComponentProps<typeof ComposedQuestionEditor>,
  "documentIssues" | "referenceRecoveryItems"
>;

function renderEditor(
  initialModel = createDefaultComposedEditorModel(),
  props: TestEditorProps = {},
) {
  let currentModel = initialModel;

  function Harness() {
    const [model, setModel] = useState(initialModel);
    currentModel = model;
    return (
      <ComposedQuestionEditor
        {...props}
        model={model}
        onModelChange={setModel}
        sources={[]}
        workbookSheetNamesBySourceId={{}}
      />
    );
  }

  render(<Harness />);

  return {
    getModel: () => currentModel,
  };
}

function getBlockFocus(label: string) {
  return screen.getByRole("button", { name: `Select ${label} block` });
}

function getCommandItem(label: string) {
  const item = screen.getByText(label).closest("[data-slot='command-item']");
  if (!(item instanceof HTMLElement)) {
    throw new Error(`Expected command item ${label}.`);
  }
  return item;
}

function getFirstText(model: ComposedEditorModel) {
  const block = model.blocks[0];
  if (block?.type !== "text") {
    throw new Error("Expected first block to be text.");
  }
  const item = block.content[0];
  return item?.type === "text" ? item.text : "";
}

function getAnswerLabel(model: ComposedEditorModel) {
  const block = model.blocks.find((candidate) => candidate.type === "response");
  if (block?.type !== "response") {
    throw new Error("Expected answer block.");
  }
  return block.label ?? null;
}

async function findPrimaryInput() {
  await waitFor(() =>
    expect(
      document.querySelector("input[data-studio-primary-editor-focus]"),
    ).toBeInstanceOf(HTMLElement),
  );
  return document.querySelector("input[data-studio-primary-editor-focus]");
}

async function editBlockByButton(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) {
  await user.click(
    within(getBlockShell(getBlockFocus(label))).getByRole("button", {
      name: "Edit block",
    }),
  );
}

function getTableCellCount(model: ComposedEditorModel) {
  const block = model.blocks.find((candidate) => candidate.type === "table");
  if (block?.type !== "table") {
    throw new Error("Expected table block.");
  }
  return block.table.cells.length;
}

function getBlockShell(element: HTMLElement) {
  const shell = element.closest("[data-studio-block-id]");
  if (!(shell instanceof HTMLElement)) {
    throw new Error("Expected block shell.");
  }
  return shell;
}
