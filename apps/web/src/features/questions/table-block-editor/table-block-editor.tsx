import { useEffect, useMemo } from "react";
import type { TableBlockEditorProps as DomainTableBlockEditorProps } from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { TableCanvas } from "./table-canvas";
import type { TableEditorSelection } from "./table-selection";

export type TableBlockEditorFeatureProps = DomainTableBlockEditorProps & {
  referencePreviewCache?: ReferencePreviewCache;
  selection?: TableEditorSelection;
  onSelectionChange?: (selection: TableEditorSelection) => void;
};

export function TableBlockEditor({
  model,
  onModelChange,
  selection,
  onSelectionChange,
  referencePreviewCache,
  disabled,
}: TableBlockEditorFeatureProps) {
  const currentSelection = useMemo<TableEditorSelection>(
    () => selection ?? { type: "table" },
    [selection],
  );

  useEffect(() => {
    if (!selection || isValidTableSelection(model, selection)) {
      return;
    }

    onSelectionChange?.({ type: "table" });
  }, [model, onSelectionChange, selection]);

  return (
    <TableCanvas
      model={model}
      selection={currentSelection}
      referencePreviewCache={referencePreviewCache ?? {}}
      disabled={disabled}
      onModelChange={onModelChange}
      onSelectionChange={(nextSelection) => onSelectionChange?.(nextSelection)}
    />
  );
}

function isValidTableSelection(
  model: DomainTableBlockEditorProps["model"],
  selection: TableEditorSelection,
) {
  if (selection.type === "table") {
    return true;
  }

  if (selection.type === "row") {
    return model.rows.some((row) => row.id === selection.rowId);
  }

  if (selection.type === "column") {
    return model.columns.some((column) => column.id === selection.columnId);
  }

  return model.cells.some((cell) => cell.id === selection.cellId);
}
