import type {
  ComposedEditorBlock,
  ComposedEditorModel,
  ComposedTableEditorBlock,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import type { EditorSelection } from "../editor-selection";
import { BlockInspector } from "./block-inspector";
import { ResponseBlockInspector } from "./response-block-inspector";
import { TableCellInspector } from "./table-cell-inspector";
import { TableColumnInspector } from "./table-column-inspector";
import type { TableEditorSelection } from "./table-editor-selection";
import { TableInspector } from "./table-inspector";
import { TableRowInspector } from "./table-row-inspector";

export function SelectedElementInspector({
  model,
  selection,
  selectedBlock,
  referencePreviewCache,
  workbookEnabled,
  sources,
  previewSourceId,
  disabled,
  onModelChange,
  onSelectionChange,
}: {
  model: ComposedEditorModel;
  selection: EditorSelection;
  selectedBlock: ComposedEditorBlock | null;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  sources: QuestionBlueprintWorkbookSource[];
  previewSourceId: string | null;
  disabled?: boolean;
  onModelChange(model: ComposedEditorModel): void;
  onSelectionChange(selection: EditorSelection): void;
}) {
  if (selection.type === "reference") {
    return (
      <p className="text-sm text-muted-foreground">
        Use References to edit the selected reference.
      </p>
    );
  }

  if (selection.type === "document" || !selectedBlock) {
    return <p className="text-sm text-muted-foreground">Select an element.</p>;
  }

  return (
    <BlockInspector block={selectedBlock}>
      {selectedBlock.type === "table" ? (
        <TableSelectionInspector
          model={model}
          block={selectedBlock}
          selection={selection}
          referencePreviewCache={referencePreviewCache}
          workbookEnabled={workbookEnabled}
          sources={sources}
          previewSourceId={previewSourceId}
          disabled={disabled}
          onModelChange={onModelChange}
          onSelectionChange={onSelectionChange}
        />
      ) : null}
      {selectedBlock.type === "text" ? <NoExtraElementSettings /> : null}
      {selectedBlock.type === "rich_text" ? <NoExtraElementSettings /> : null}
      {selectedBlock.type === "separator" ? <NoExtraElementSettings /> : null}
      {selectedBlock.type === "response" ? (
        <ResponseBlockInspector
          model={model}
          block={selectedBlock}
          referencePreviewCache={referencePreviewCache}
          workbookEnabled={workbookEnabled}
          sources={sources}
          previewSourceId={previewSourceId}
          disabled={disabled}
          onModelChange={onModelChange}
        />
      ) : null}
    </BlockInspector>
  );
}

function NoExtraElementSettings() {
  return (
    <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
      No extra settings.
    </p>
  );
}

function TableSelectionInspector({
  model,
  block,
  selection,
  referencePreviewCache,
  workbookEnabled,
  sources,
  previewSourceId,
  disabled,
  onModelChange,
  onSelectionChange,
}: {
  model: ComposedEditorModel;
  block: ComposedTableEditorBlock;
  selection: EditorSelection;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  sources: QuestionBlueprintWorkbookSource[];
  previewSourceId: string | null;
  disabled?: boolean;
  onModelChange(model: ComposedEditorModel): void;
  onSelectionChange(selection: EditorSelection): void;
}) {
  function updateTable(table: ComposedTableEditorBlock["table"]) {
    onModelChange({
      ...model,
      blocks: model.blocks.map((candidate) =>
        candidate.id === block.id && candidate.type === "table"
          ? { ...candidate, table }
          : candidate,
      ),
    });
  }

  function setTableSelection(tableSelection: TableEditorSelection) {
    if (tableSelection.type === "table") {
      onSelectionChange({ type: "table", blockId: block.id });
      return;
    }
    if (tableSelection.type === "row") {
      onSelectionChange({
        type: "table_row",
        blockId: block.id,
        rowId: tableSelection.rowId,
      });
      return;
    }
    if (tableSelection.type === "column") {
      onSelectionChange({
        type: "table_column",
        blockId: block.id,
        columnId: tableSelection.columnId,
      });
      return;
    }
    onSelectionChange({
      type: "table_cell",
      blockId: block.id,
      cellId: tableSelection.cellId,
    });
  }

  if (selection.type === "table_row" && selection.blockId === block.id) {
    return (
      <div className="grid gap-5">
        <TableInspector
          blockId={block.id}
          model={block.table}
          editorModel={model}
          referencePreviewCache={referencePreviewCache}
          workbookEnabled={workbookEnabled}
          sources={sources}
          previewSourceId={previewSourceId}
          disabled={disabled}
          onModelChange={updateTable}
          onEditorModelChange={onModelChange}
          onSelectionChange={setTableSelection}
        />
        <TableRowInspector
          model={block.table}
          rowId={selection.rowId}
          disabled={disabled}
          onModelChange={updateTable}
          onSelectionChange={setTableSelection}
        />
      </div>
    );
  }

  if (selection.type === "table_column" && selection.blockId === block.id) {
    return (
      <div className="grid gap-5">
        <TableInspector
          blockId={block.id}
          model={block.table}
          editorModel={model}
          referencePreviewCache={referencePreviewCache}
          workbookEnabled={workbookEnabled}
          sources={sources}
          previewSourceId={previewSourceId}
          disabled={disabled}
          onModelChange={updateTable}
          onEditorModelChange={onModelChange}
          onSelectionChange={setTableSelection}
        />
        <TableColumnInspector
          model={block.table}
          columnId={selection.columnId}
          disabled={disabled}
          onModelChange={updateTable}
          onSelectionChange={setTableSelection}
        />
      </div>
    );
  }

  if (selection.type === "table_cell" && selection.blockId === block.id) {
    return (
      <div className="grid gap-5">
        <TableInspector
          blockId={block.id}
          model={block.table}
          editorModel={model}
          referencePreviewCache={referencePreviewCache}
          workbookEnabled={workbookEnabled}
          sources={sources}
          previewSourceId={previewSourceId}
          disabled={disabled}
          onModelChange={updateTable}
          onEditorModelChange={onModelChange}
          onSelectionChange={setTableSelection}
        />
        <TableCellInspector
          model={block.table}
          tableBlockId={block.id}
          cellId={selection.cellId}
          editorModel={model}
          referencePreviewCache={referencePreviewCache}
          workbookEnabled={workbookEnabled}
          sources={sources}
          previewSourceId={previewSourceId}
          disabled={disabled}
          onModelChange={updateTable}
          onEditorModelChange={onModelChange}
        />
      </div>
    );
  }

  return (
    <TableInspector
      blockId={block.id}
      model={block.table}
      editorModel={model}
      referencePreviewCache={referencePreviewCache}
      workbookEnabled={workbookEnabled}
      sources={sources}
      previewSourceId={previewSourceId}
      disabled={disabled}
      onModelChange={updateTable}
      onEditorModelChange={onModelChange}
      onSelectionChange={setTableSelection}
    />
  );
}
