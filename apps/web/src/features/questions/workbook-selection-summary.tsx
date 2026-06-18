import { Button } from "@lemma/ui/components/button";
import { DialogFooter } from "@lemma/ui/components/dialog";
import { Spinner } from "@lemma/ui/components/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@lemma/ui/components/tooltip";
import type { WorkbookRangeSelection } from "#/features/questions/table-block-editor";
import {
  formatWorkbookRangeDisplayValue,
  type WorkbookSelectionValidationResult,
} from "./workbook-validation";

type WorkbookSelectionSummaryProps = {
  isSelectingRange?: boolean;
  selectedRange: WorkbookRangeSelection | null;
  selectedRangeErrorMessage?: string | null;
  selectionValidation: WorkbookSelectionValidationResult;
  onSelectRange(selection: WorkbookRangeSelection): void;
};

export function WorkbookSelectionSummary({
  isSelectingRange = false,
  selectedRange,
  selectedRangeErrorMessage,
  selectionValidation,
  onSelectRange,
}: WorkbookSelectionSummaryProps) {
  const disabledMessage =
    selectedRangeErrorMessage ??
    (selectionValidation.ok ? null : selectionValidation.message);

  return (
    <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none">
      <div className="min-w-0 flex-1 text-xs text-muted-foreground">
        <span className="font-mono">
          {selectedRange?.reference ?? "No range selected"}
        </span>
        {selectedRange && (
          <span className="ml-2">
            {formatWorkbookRangeDisplayValue(selectedRange.values)}
          </span>
        )}
        {disabledMessage && (
          <p className="mt-1 text-destructive">{disabledMessage}</p>
        )}
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                type="button"
                disabled={
                  isSelectingRange || !selectedRange || !selectionValidation.ok
                }
                onClick={() => {
                  if (selectedRange && selectionValidation.ok) {
                    onSelectRange(selectedRange);
                  }
                }}
              >
                {isSelectingRange && (
                  <Spinner className="size-3 text-current" />
                )}
                Use range
              </Button>
            </span>
          </TooltipTrigger>
          {disabledMessage && (
            <TooltipContent>{disabledMessage}</TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </DialogFooter>
  );
}
