import {
  describeTableSelectionFromSummary,
  getSelectedTableCoordinateSummary,
  type TableCellSelection,
  type TableEditorModel,
} from "#/domains/questions/authoring";
import {
  TableSelectionActions,
  type TableSelectionAnswerActionResult,
} from "#/features/questions/table-block-editor";
import { InspectorSection } from "./inspector-section";

export function TableCellSelectionInspector({
  model,
  selection,
  disabled,
  onConvertSelectionToAnswer,
  onModelChange,
}: {
  model: TableEditorModel;
  selection: TableCellSelection;
  disabled?: boolean;
  onConvertSelectionToAnswer?: () =>
    | TableSelectionAnswerActionResult
    | undefined;
  onModelChange(model: TableEditorModel): void;
}) {
  const selectedCoordinateSummary = getSelectedTableCoordinateSummary(
    model,
    selection,
  );

  return (
    <div className="grid gap-5">
      <InspectorSection title="Selected cells">
        <p className="text-xs text-muted-foreground">
          {describeTableSelectionFromSummary(
            selection,
            selectedCoordinateSummary,
          )}
        </p>
        <TableSelectionActions
          disabled={disabled}
          layout="inspector"
          model={model}
          onConvertSelectionToAnswer={onConvertSelectionToAnswer}
          onModelChange={onModelChange}
          selectedCoordinateSummary={selectedCoordinateSummary}
          selection={selection}
        />
      </InspectorSection>
    </div>
  );
}
