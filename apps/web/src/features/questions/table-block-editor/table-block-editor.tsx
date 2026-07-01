import { useEffect, useMemo } from "react";
import type { TableBlockEditorProps as DomainTableBlockEditorProps } from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { TableCanvas } from "./table-canvas";
import type { TableEditorSelection } from "./table-selection";
import {
  isTableSelectionEqual,
  normalizeTableSelection,
} from "./table-selection";
import type { TableSelectionAnswerActionResult } from "./table-selection-actions";

export type TableBlockEditorFeatureProps = DomainTableBlockEditorProps & {
  referencePreviewCache?: ReferencePreviewCache;
  selection?: TableEditorSelection;
  onSelectionChange?: (selection: TableEditorSelection) => void;
  onConvertSelectionToAnswer?: () =>
    | TableSelectionAnswerActionResult
    | undefined;
};

export function TableBlockEditor({
  model,
  onModelChange,
  selection,
  onSelectionChange,
  onConvertSelectionToAnswer,
  referencePreviewCache,
  disabled,
}: TableBlockEditorFeatureProps) {
  const currentSelection = useMemo<TableEditorSelection>(
    () => selection ?? { type: "table" },
    [selection],
  );

  useEffect(() => {
    if (!selection) {
      return;
    }

    const normalized = normalizeTableSelection(model, selection);
    if (!isTableSelectionEqual(normalized, selection)) {
      onSelectionChange?.(normalized);
    }
  }, [model, onSelectionChange, selection]);

  return (
    <TableCanvas
      disabled={disabled}
      model={model}
      onConvertSelectionToAnswer={onConvertSelectionToAnswer}
      onModelChange={onModelChange}
      onSelectionChange={(nextSelection) => onSelectionChange?.(nextSelection)}
      referencePreviewCache={referencePreviewCache ?? {}}
      selection={currentSelection}
    />
  );
}
