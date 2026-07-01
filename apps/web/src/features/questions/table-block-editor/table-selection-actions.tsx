import { Button } from "@lemma/ui/components/button";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  FileInput,
  Highlighter,
  Type,
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
  SelectedTableCoordinateSummary,
  TableEditorModel,
} from "#/domains/questions/authoring";
import {
  applyFormattingToSelectedCells,
  clearFormattingFromSelectedCells,
  getSelectedTableCoordinateSummary,
  makeSelectedCellsContent,
  makeSelectedCellsResponse,
} from "./table-editor-operations";
import type { TableEditorSelection } from "./table-selection";

export type TableSelectionActionLayout = "toolbar" | "inspector";

export type TableSelectionActionState = {
  actionDisabled: boolean;
  hasRangeBackedReferences: boolean;
  hasSelectedCells: boolean;
};

export type TableSelectionAnswerActionResult = {
  blockedRangeBackedCellCount: number;
};

export function getTableSelectionActionState({
  model,
  selection,
  disabled,
  selectedCoordinateSummary,
}: {
  model: TableEditorModel;
  selection: TableEditorSelection;
  disabled?: boolean;
  selectedCoordinateSummary?: SelectedTableCoordinateSummary;
}): TableSelectionActionState {
  const summary =
    selectedCoordinateSummary ??
    getSelectedTableCoordinateSummary(model, selection);
  const hasSelectedCells = summary.count > 0;
  return {
    actionDisabled: Boolean(disabled) || !hasSelectedCells,
    hasRangeBackedReferences: summary.hasRangeBackedReferences,
    hasSelectedCells,
  };
}

export function TableSelectionActions({
  model,
  selection,
  disabled,
  layout = "toolbar",
  selectedCoordinateSummary,
  onConvertSelectionToAnswer,
  onModelChange,
}: {
  model: TableEditorModel;
  selection: TableEditorSelection;
  disabled?: boolean;
  layout?: TableSelectionActionLayout;
  selectedCoordinateSummary?: SelectedTableCoordinateSummary;
  onConvertSelectionToAnswer?: () =>
    | TableSelectionAnswerActionResult
    | undefined;
  onModelChange(model: TableEditorModel): void;
}) {
  const [blockedRangeBackedCellCount, setBlockedRangeBackedCellCount] =
    useState(0);
  const state = getTableSelectionActionState({
    disabled,
    model,
    selectedCoordinateSummary,
    selection,
  });
  const actionGroupClassName =
    layout === "toolbar"
      ? "flex flex-wrap items-center gap-1"
      : "grid grid-cols-2 gap-2";
  const formattingGroupClassName =
    layout === "toolbar"
      ? "flex flex-wrap items-center gap-1"
      : "flex flex-wrap gap-2";
  const answerDisabled =
    state.actionDisabled ||
    (state.hasRangeBackedReferences && !onConvertSelectionToAnswer);

  useEffect(() => {
    setBlockedRangeBackedCellCount(0);
  }, [model, selection]);

  function convertSelectionToAnswer() {
    if (onConvertSelectionToAnswer) {
      const result = onConvertSelectionToAnswer();
      setBlockedRangeBackedCellCount(result?.blockedRangeBackedCellCount ?? 0);
      return;
    }
    setBlockedRangeBackedCellCount(0);
    onModelChange(makeSelectedCellsResponse(model, selection));
  }

  return (
    <>
      <div className={actionGroupClassName}>
        <Button
          disabled={state.actionDisabled}
          onClick={() =>
            onModelChange(makeSelectedCellsContent(model, selection))
          }
          size={layout === "toolbar" ? "sm" : undefined}
          type="button"
          variant="outline"
        >
          <Type />
          Content
        </Button>
        <Button
          disabled={answerDisabled}
          onClick={convertSelectionToAnswer}
          size={layout === "toolbar" ? "sm" : undefined}
          type="button"
          variant="outline"
        >
          <FileInput />
          Answer
        </Button>
      </div>
      <div className={formattingGroupClassName}>
        <Button
          aria-label="Align left"
          disabled={state.actionDisabled}
          onClick={() =>
            onModelChange(
              applyFormattingToSelectedCells(model, selection, {
                textAlign: "left",
              }),
            )
          }
          size="icon-sm"
          title="Align left"
          type="button"
          variant="outline"
        >
          <AlignLeft />
        </Button>
        <Button
          aria-label="Align center"
          disabled={state.actionDisabled}
          onClick={() =>
            onModelChange(
              applyFormattingToSelectedCells(model, selection, {
                textAlign: "center",
              }),
            )
          }
          size="icon-sm"
          title="Align center"
          type="button"
          variant="outline"
        >
          <AlignCenter />
        </Button>
        <Button
          aria-label="Align right"
          disabled={state.actionDisabled}
          onClick={() =>
            onModelChange(
              applyFormattingToSelectedCells(model, selection, {
                textAlign: "right",
              }),
            )
          }
          size="icon-sm"
          title="Align right"
          type="button"
          variant="outline"
        >
          <AlignRight />
        </Button>
        <Button
          aria-label="Bold"
          disabled={state.actionDisabled}
          onClick={() =>
            onModelChange(
              applyFormattingToSelectedCells(model, selection, {
                emphasis: "strong",
              }),
            )
          }
          size="icon-sm"
          title="Bold"
          type="button"
          variant="outline"
        >
          <Bold />
        </Button>
        <Button
          aria-label="Highlight"
          disabled={state.actionDisabled}
          onClick={() =>
            onModelChange(
              applyFormattingToSelectedCells(model, selection, {
                tone: "highlight",
              }),
            )
          }
          size="icon-sm"
          title="Highlight"
          type="button"
          variant="outline"
        >
          <Highlighter />
        </Button>
        <Button
          aria-label="Clear formatting"
          disabled={state.actionDisabled}
          onClick={() =>
            onModelChange(clearFormattingFromSelectedCells(model, selection))
          }
          size="icon-sm"
          title="Clear formatting"
          type="button"
          variant="outline"
        >
          <Eraser />
        </Button>
      </div>
      {blockedRangeBackedCellCount > 0 ? (
        <p className="basis-full text-xs text-amber-700" role="alert">
          {blockedRangeBackedCellCount === 1
            ? "One range-backed inserted value could not be converted. It was left as content."
            : "Some range-backed inserted values could not be converted. Those cells were left as content."}
        </p>
      ) : state.hasRangeBackedReferences ? (
        <p className="basis-full text-xs text-amber-700" role="note">
          {onConvertSelectionToAnswer
            ? "Range-backed inserted values convert to direct workbook answer sources."
            : "Range-backed inserted values need workbook context before they can become answers."}
        </p>
      ) : null}
    </>
  );
}
