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
  workbookSheetNamesBySourceId,
  referencePreviewCache = {},
  disabled,
  inspectorStickyOffset,
}: {
  model: ComposedEditorModel;
  onModelChange(model: ComposedEditorModel): void;
  sources: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
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
    const afterBlockId = model.blocks[index - 1]?.id ?? null;
    const next = insertComposedBlock({
      afterBlockId,
      model,
      type,
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
      blockId,
      direction,
      model,
    });
    onModelChange(next.model);
    setSelection(next.selection);
  }

  return (
    <TooltipProvider>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <BlockList
          disabled={disabled}
          getTableSelectionForBlock={getTableSelectionForBlock}
          model={model}
          onDeleteBlock={deleteBlock}
          onDuplicateBlock={duplicateBlock}
          onInsertBlock={insertBlock}
          onModelChange={onModelChange}
          onMoveBlock={moveBlock}
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
          disabled={disabled}
          model={model}
          onModelChange={onModelChange}
          onSelectionChange={setSelection}
          referencePreviewCache={referencePreviewCache}
          selection={selection}
          sources={sources}
          stickyOffset={inspectorStickyOffset}
          workbookEnabled={workbookEnabled}
          workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
        />
      </div>
    </TooltipProvider>
  );
}
