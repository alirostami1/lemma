import type {
  ComposedEditorBlock,
  ComposedEditorModel,
  ComposedTableEditorBlock,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import type { EditorSelection } from "../editor-selection";
import { BlockInspector } from "./block-inspector";
import {
  DocumentInspector,
  type DocumentReadinessIssue,
} from "./document-inspector";
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
  workbookSheetNamesBySourceId,
  documentIssues,
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
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
  documentIssues?: readonly DocumentReadinessIssue[];
  disabled?: boolean;
  onModelChange(model: ComposedEditorModel): void;
  onSelectionChange(selection: EditorSelection): void;
}) {
  if (selection.type === "reference") {
    return (
      <p className="text-sm text-muted-foreground">
        Select an element to edit its settings.
      </p>
    );
  }

  if (selection.type === "document" || !selectedBlock) {
    return (
      <DocumentInspector
        disabled={disabled}
        documentIssues={documentIssues}
        model={model}
        onModelChange={onModelChange}
        onSelectionChange={onSelectionChange}
      />
    );
  }

  return (
    <BlockInspector block={selectedBlock}>
      {selectedBlock.type === "table" ? (
        <TableSelectionInspector
          block={selectedBlock}
          disabled={disabled}
          model={model}
          onModelChange={onModelChange}
          onSelectionChange={onSelectionChange}
          referencePreviewCache={referencePreviewCache}
          selection={selection}
          sources={sources}
          workbookEnabled={workbookEnabled}
          workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
        />
      ) : null}
      {selectedBlock.type === "text" ? <NoExtraElementSettings /> : null}
      {selectedBlock.type === "rich_text" ? <NoExtraElementSettings /> : null}
      {selectedBlock.type === "separator" ? <NoExtraElementSettings /> : null}
      {selectedBlock.type === "response" ? (
        <ResponseBlockInspector
          block={selectedBlock}
          disabled={disabled}
          model={model}
          onModelChange={onModelChange}
          referencePreviewCache={referencePreviewCache}
          sources={sources}
          workbookEnabled={workbookEnabled}
          workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
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
  workbookSheetNamesBySourceId,
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
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
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
      onSelectionChange({ blockId: block.id, type: "table" });
      return;
    }
    if (tableSelection.type === "row") {
      onSelectionChange({
        blockId: block.id,
        rowId: tableSelection.rowId,
        type: "table_row",
      });
      return;
    }
    if (tableSelection.type === "column") {
      onSelectionChange({
        blockId: block.id,
        columnId: tableSelection.columnId,
        type: "table_column",
      });
      return;
    }
    onSelectionChange({
      blockId: block.id,
      cellId: tableSelection.cellId,
      type: "table_cell",
    });
  }

  if (selection.type === "table_row" && selection.blockId === block.id) {
    return (
      <div className="grid gap-5">
        <TableInspector
          blockId={block.id}
          disabled={disabled}
          editorModel={model}
          model={block.table}
          onEditorModelChange={onModelChange}
          onModelChange={updateTable}
          onSelectionChange={setTableSelection}
          referencePreviewCache={referencePreviewCache}
          sources={sources}
          workbookEnabled={workbookEnabled}
          workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
        />
        <TableRowInspector
          disabled={disabled}
          model={block.table}
          onModelChange={updateTable}
          onSelectionChange={setTableSelection}
          rowId={selection.rowId}
        />
      </div>
    );
  }

  if (selection.type === "table_column" && selection.blockId === block.id) {
    return (
      <div className="grid gap-5">
        <TableInspector
          blockId={block.id}
          disabled={disabled}
          editorModel={model}
          model={block.table}
          onEditorModelChange={onModelChange}
          onModelChange={updateTable}
          onSelectionChange={setTableSelection}
          referencePreviewCache={referencePreviewCache}
          sources={sources}
          workbookEnabled={workbookEnabled}
          workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
        />
        <TableColumnInspector
          columnId={selection.columnId}
          disabled={disabled}
          model={block.table}
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
          disabled={disabled}
          editorModel={model}
          model={block.table}
          onEditorModelChange={onModelChange}
          onModelChange={updateTable}
          onSelectionChange={setTableSelection}
          referencePreviewCache={referencePreviewCache}
          sources={sources}
          workbookEnabled={workbookEnabled}
          workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
        />
        <TableCellInspector
          cellId={selection.cellId}
          disabled={disabled}
          editorModel={model}
          model={block.table}
          onEditorModelChange={onModelChange}
          onModelChange={updateTable}
          referencePreviewCache={referencePreviewCache}
          sources={sources}
          tableBlockId={block.id}
          workbookEnabled={workbookEnabled}
          workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
        />
      </div>
    );
  }

  return (
    <TableInspector
      blockId={block.id}
      disabled={disabled}
      editorModel={model}
      model={block.table}
      onEditorModelChange={onModelChange}
      onModelChange={updateTable}
      onSelectionChange={setTableSelection}
      referencePreviewCache={referencePreviewCache}
      sources={sources}
      workbookEnabled={workbookEnabled}
      workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
    />
  );
}
