import { TooltipProvider } from "@lemma/ui/components/tooltip";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import type { TableEditorSelection } from "#/features/questions/table-block-editor";
import { BlockList } from "./block-list";
import {
  deleteComposedBlock,
  duplicateComposedBlock,
  type InsertComposedBlockType,
  insertComposedBlock,
  moveComposedBlockInEditor,
  normalizeComposedEditorSelection,
  selectBlockInComposedEditor,
  selectFirstBlockOrDocument,
} from "./composed-editor-operations";
import {
  type EditorSelection,
  selectedBlockIdFromSelection,
} from "./editor-selection";
import {
  type DocumentReadinessIssue,
  InspectorPanel,
  type ReferenceRecoveryItem,
} from "./inspector";
import {
  canRunStudioEditorCommand,
  getRelativeStudioBlockId,
  getSelectedBlockIdFromStudioMode,
  getStudioEditorCommandAvailability,
  type StudioEditorCommand,
  type StudioEditorMode,
} from "./studio-editor-command-model";
import { StudioEditorCommandPalette } from "./studio-editor-command-palette";
import { StudioShortcutHelpDialog } from "./studio-shortcut-help-dialog";
import {
  focusStudioBlockBody,
  focusStudioBlockShell,
  useStudioEditorKeyboard,
} from "./use-studio-editor-keyboard";

export function ComposedQuestionEditor({
  model,
  onModelChange,
  sources,
  workbookSheetNamesBySourceId,
  referencePreviewCache = {},
  documentIssues,
  referenceRecoveryItems,
  disabled,
  inspectorStickyOffset,
}: {
  model: ComposedEditorModel;
  onModelChange(model: ComposedEditorModel): void;
  sources: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
  referencePreviewCache?: ReferencePreviewCache;
  documentIssues?: readonly DocumentReadinessIssue[];
  referenceRecoveryItems?: readonly ReferenceRecoveryItem[];
  disabled?: boolean;
  inspectorStickyOffset?: number;
}) {
  const [selection, setSelection] = useState<EditorSelection>(() =>
    selectFirstBlockOrDocument(model),
  );
  const [editingMode, setEditingMode] = useState<Extract<
    StudioEditorMode,
    { type: "editing" }
  > | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const editorShellRef = useRef<HTMLElement>(null);
  const selectedBlockId = selectedBlockIdFromSelection(selection);
  const editorMode: StudioEditorMode = editingMode ?? {
    selectedBlockId,
    type: "navigating",
  };
  const editingBlockId =
    editorMode.type === "editing" ? editorMode.blockId : null;
  const commandAvailability = useMemo(
    () =>
      getStudioEditorCommandAvailability({
        disabled,
        mode: editorMode,
        model,
      }),
    [disabled, editorMode, model],
  );
  const workbookEnabled = sources.length > 0;

  useEffect(() => {
    setSelection((current) => normalizeComposedEditorSelection(model, current));
  }, [model]);

  useEffect(() => {
    if (
      editingMode &&
      !model.blocks.some((block) => block.id === editingMode.blockId)
    ) {
      setEditingMode(null);
    }
  }, [editingMode, model.blocks]);

  const workbookToolsEnabled = workbookEnabled;

  function selectBlock(blockId: string) {
    if (editingMode && editingMode.blockId !== blockId) {
      return;
    }
    setSelection(selectBlockInComposedEditor(model, blockId));
  }

  function selectReference(referenceId: string) {
    if (editingMode) {
      return;
    }
    setSelection({ referenceId, type: "reference" });
  }

  function setTableSelection(
    blockId: string,
    tableSelection: TableEditorSelection,
  ) {
    if (tableSelection.type === "table")
      return setSelection({ blockId, type: "table" });
    if (tableSelection.type === "row")
      return setSelection({
        blockId,
        rowId: tableSelection.rowId,
        type: "table_row",
      });
    if (tableSelection.type === "column")
      return setSelection({
        blockId,
        columnId: tableSelection.columnId,
        type: "table_column",
      });
    setSelection({
      blockId,
      cellId: tableSelection.cellId,
      type: "table_cell",
    });
  }

  function getTableSelectionForBlock(blockId: string): TableEditorSelection {
    if (selection.type === "table" && selection.blockId === blockId)
      return { type: "table" };
    if (selection.type === "table_row" && selection.blockId === blockId)
      return { rowId: selection.rowId, type: "row" };
    if (selection.type === "table_column" && selection.blockId === blockId)
      return { columnId: selection.columnId, type: "column" };
    if (selection.type === "table_cell" && selection.blockId === blockId)
      return { cellId: selection.cellId, type: "cell" };
    return { type: "table" };
  }

  function insertBlock(type: InsertComposedBlockType, index: number) {
    if (!canRun("insert_block")) {
      return;
    }
    const afterBlockId = model.blocks[index - 1]?.id ?? null;
    const next = insertComposedBlock({
      afterBlockId,
      model,
      type,
    });
    const nextBlockId = selectedBlockIdFromSelection(next.selection);
    onModelChange(next.model);
    setSelection(next.selection);
    if (nextBlockId) {
      setEditingMode({
        baseline: next.model,
        blockId: nextBlockId,
        type: "editing",
      });
      scheduleStudioFocus(() =>
        focusStudioBlockBody(editorShellRef.current, nextBlockId),
      );
    }
  }

  function duplicateBlock(blockId: string) {
    if (editingMode) {
      return;
    }
    const next = duplicateComposedBlock(model, blockId);
    onModelChange(next.model);
    setSelection(next.selection);
  }

  function deleteBlock(blockId: string) {
    if (editingMode) {
      return;
    }
    const next = deleteComposedBlock(model, blockId);
    onModelChange(next.model);
    setSelection(next.selection);
  }

  function moveBlock(blockId: string, direction: "up" | "down") {
    if (editingMode) {
      return;
    }
    const next = moveComposedBlockInEditor({
      blockId,
      direction,
      model,
    });
    onModelChange(next.model);
    setSelection(next.selection);
  }

  function enterEditMode(blockId: string) {
    if (
      !canRun("enter_edit_mode") ||
      !model.blocks.some((block) => block.id === blockId)
    ) {
      return;
    }
    setSelection(selectBlockInComposedEditor(model, blockId));
    setEditingMode({
      baseline: structuredClone(model),
      blockId,
      type: "editing",
    });
    scheduleStudioFocus(() =>
      focusStudioBlockBody(editorShellRef.current, blockId),
    );
  }

  function confirmEditMode() {
    if (!canRun("confirm_edit")) {
      return;
    }
    const blockId = editingMode?.blockId;
    setEditingMode(null);
    if (blockId) {
      scheduleStudioFocus(() =>
        focusStudioBlockShell(editorShellRef.current, blockId),
      );
    }
  }

  function exitEditMode() {
    if (!canRun("exit_edit_mode")) {
      return;
    }
    confirmEditMode();
  }

  function cancelEditMode() {
    if (!canRun("cancel_edit") || !editingMode) {
      return;
    }
    const { baseline, blockId } = editingMode;
    setEditingMode(null);
    onModelChange(baseline);
    setSelection(selectBlockInComposedEditor(baseline, blockId));
    if (blockId) {
      scheduleStudioFocus(() =>
        focusStudioBlockShell(editorShellRef.current, blockId),
      );
    }
  }

  function insertBlockFromPalette(type: InsertComposedBlockType) {
    const selectedIndex = selectedBlockId
      ? model.blocks.findIndex((block) => block.id === selectedBlockId)
      : -1;
    insertBlock(
      type,
      selectedIndex >= 0 ? selectedIndex + 1 : model.blocks.length,
    );
  }

  function canRun(command: StudioEditorCommand) {
    return canRunStudioEditorCommand(command, {
      disabled,
      mode: editorMode,
      model,
    });
  }

  function runStudioCommand(command: StudioEditorCommand) {
    if (!canRun(command)) {
      return;
    }

    switch (command) {
      case "navigate_previous_block":
      case "navigate_next_block": {
        const blockId = getRelativeStudioBlockId({
          direction:
            command === "navigate_previous_block" ? "previous" : "next",
          mode: editorMode,
          model,
        });
        if (!blockId) {
          return;
        }
        setSelection(selectBlockInComposedEditor(model, blockId));
        scheduleStudioFocus(() =>
          focusStudioBlockShell(editorShellRef.current, blockId),
        );
        return;
      }
      case "enter_edit_mode": {
        const blockId = getSelectedBlockIdFromStudioMode(editorMode);
        if (blockId) {
          enterEditMode(blockId);
        }
        return;
      }
      case "exit_edit_mode":
        exitEditMode();
        return;
      case "confirm_edit":
        confirmEditMode();
        return;
      case "cancel_edit":
        cancelEditMode();
        return;
      case "insert_block":
      case "open_commands":
        setCommandPaletteOpen(true);
        return;
      case "open_shortcuts":
        setShortcutHelpOpen(true);
        return;
    }
  }

  const keyboard = useStudioEditorKeyboard({
    disabled: disabled || commandPaletteOpen || shortcutHelpOpen,
    onRunCommand: runStudioCommand,
  });

  return (
    <TooltipProvider>
      <section
        aria-label="Question editor"
        className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]"
        onKeyDown={keyboard.handleKeyDown}
        ref={editorShellRef}
      >
        <BlockList
          commandAvailability={commandAvailability}
          disabled={disabled}
          editingBlockId={editingBlockId}
          getTableSelectionForBlock={getTableSelectionForBlock}
          model={model}
          onCancelEdit={cancelEditMode}
          onConfirmEdit={confirmEditMode}
          onDeleteBlock={deleteBlock}
          onDuplicateBlock={duplicateBlock}
          onEditBlock={enterEditMode}
          onInsertBlock={insertBlock}
          onModelChange={onModelChange}
          onMoveBlock={moveBlock}
          onRunCommand={runStudioCommand}
          onSelectBlock={selectBlock}
          onSelectReference={selectReference}
          onTableSelectionChange={setTableSelection}
          referencePreviewCache={referencePreviewCache}
          selectedBlockId={selectedBlockId}
          sources={sources}
          workbookEnabled={workbookToolsEnabled}
          workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
        />
        <InspectorPanel
          disabled={disabled || editingMode !== null}
          documentIssues={documentIssues}
          model={model}
          onModelChange={(nextModel) => {
            if (!editingMode) {
              onModelChange(nextModel);
            }
          }}
          onSelectionChange={(nextSelection) => {
            if (!editingMode) {
              setSelection(nextSelection);
            }
          }}
          referencePreviewCache={referencePreviewCache}
          referenceRecoveryItems={referenceRecoveryItems}
          selection={selection}
          sources={sources}
          stickyOffset={inspectorStickyOffset}
          workbookEnabled={workbookEnabled}
          workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
        />
        <StudioEditorCommandPalette
          commandAvailability={commandAvailability}
          onCancelEdit={() => runStudioCommand("cancel_edit")}
          onConfirmEdit={() => runStudioCommand("confirm_edit")}
          onEnterEditMode={() => runStudioCommand("enter_edit_mode")}
          onInsertBlock={insertBlockFromPalette}
          onOpenChange={setCommandPaletteOpen}
          onOpenShortcuts={() => runStudioCommand("open_shortcuts")}
          open={commandPaletteOpen}
        />
        <StudioShortcutHelpDialog
          onOpenChange={setShortcutHelpOpen}
          open={shortcutHelpOpen}
        />
      </section>
    </TooltipProvider>
  );
}

function scheduleStudioFocus(focus: () => void) {
  window.requestAnimationFrame(focus);
}
