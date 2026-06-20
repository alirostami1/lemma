import { TooltipProvider } from "@lemma/ui/components/tooltip";
import { useEffect, useState } from "react";
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
import { InspectorPanel } from "./inspector";

export function ComposedQuestionEditor({
  model,
  onModelChange,
  sources,
  previewSourceId,
  referencePreviewCache = {},
  disabled,
  inspectorStickyOffset,
}: {
  model: ComposedEditorModel;
  onModelChange(model: ComposedEditorModel): void;
  sources: QuestionBlueprintWorkbookSource[];
  previewSourceId: string | null;
  referencePreviewCache?: ReferencePreviewCache;
  disabled?: boolean;
  inspectorStickyOffset?: number;
}) {
  const [selection, setSelection] = useState<EditorSelection>(() =>
    selectFirstBlockOrDocument(model),
  );
  const selectedBlockId = selectedBlockIdFromSelection(selection);
  const workbookEnabled = sources.length > 0;

  useEffect(() => {
    setSelection((current) => normalizeComposedEditorSelection(model, current));
  }, [model]);

  const workbookToolsEnabled = workbookEnabled;

  function selectBlock(blockId: string) {
    setSelection(selectBlockInComposedEditor(model, blockId));
  }

  function selectReference(referenceId: string) {
    setSelection({ type: "reference", referenceId });
  }

  function setTableSelection(
    blockId: string,
    tableSelection: TableEditorSelection,
  ) {
    if (tableSelection.type === "table")
      return setSelection({ type: "table", blockId });
    if (tableSelection.type === "row")
      return setSelection({
        type: "table_row",
        blockId,
        rowId: tableSelection.rowId,
      });
    if (tableSelection.type === "column")
      return setSelection({
        type: "table_column",
        blockId,
        columnId: tableSelection.columnId,
      });
    setSelection({
      type: "table_cell",
      blockId,
      cellId: tableSelection.cellId,
    });
  }

  function getTableSelectionForBlock(blockId: string): TableEditorSelection {
    if (selection.type === "table" && selection.blockId === blockId)
      return { type: "table" };
    if (selection.type === "table_row" && selection.blockId === blockId)
      return { type: "row", rowId: selection.rowId };
    if (selection.type === "table_column" && selection.blockId === blockId)
      return { type: "column", columnId: selection.columnId };
    if (selection.type === "table_cell" && selection.blockId === blockId)
      return { type: "cell", cellId: selection.cellId };
    return { type: "table" };
  }

  function insertBlock(type: InsertComposedBlockType, index: number) {
    const afterBlockId = model.blocks[index - 1]?.id ?? null;
    const next = insertComposedBlock({
      model,
      type,
      afterBlockId,
    });
    onModelChange(next.model);
    setSelection(next.selection);
  }

  function duplicateBlock(blockId: string) {
    const next = duplicateComposedBlock(model, blockId);
    onModelChange(next.model);
    setSelection(next.selection);
  }

  function deleteBlock(blockId: string) {
    const next = deleteComposedBlock(model, blockId);
    onModelChange(next.model);
    setSelection(next.selection);
  }

  function moveBlock(blockId: string, direction: "up" | "down") {
    const next = moveComposedBlockInEditor({
      model,
      blockId,
      direction,
    });
    onModelChange(next.model);
    setSelection(next.selection);
  }

  return (
    <TooltipProvider>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <BlockList
          model={model}
          selectedBlockId={selectedBlockId}
          disabled={disabled}
          referencePreviewCache={referencePreviewCache}
          workbookEnabled={workbookToolsEnabled}
          sources={sources}
          previewSourceId={previewSourceId}
          onModelChange={onModelChange}
          onSelectBlock={selectBlock}
          onSelectReference={selectReference}
          onTableSelectionChange={setTableSelection}
          getTableSelectionForBlock={getTableSelectionForBlock}
          onInsertBlock={insertBlock}
          onDuplicateBlock={duplicateBlock}
          onDeleteBlock={deleteBlock}
          onMoveBlock={moveBlock}
        />
        <InspectorPanel
          model={model}
          selection={selection}
          referencePreviewCache={referencePreviewCache}
          workbookEnabled={workbookEnabled}
          sources={sources}
          previewSourceId={previewSourceId}
          disabled={disabled}
          onModelChange={onModelChange}
          onSelectionChange={setSelection}
          stickyOffset={inspectorStickyOffset}
        />
      </div>
    </TooltipProvider>
  );
}
