import { Button } from "@lemma/ui/components/button";
import { DialogFooter } from "@lemma/ui/components/dialog";
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
  selectedRange: WorkbookRangeSelection | null;
  selectionValidation: WorkbookSelectionValidationResult;
  onSelectRange(selection: WorkbookRangeSelection): void;
};

export function WorkbookSelectionSummary({
  selectedRange,
  selectionValidation,
  onSelectRange,
}: WorkbookSelectionSummaryProps) {
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
        {!selectionValidation.ok && (
          <p className="mt-1 text-destructive">{selectionValidation.message}</p>
        )}
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                type="button"
                disabled={!selectedRange || !selectionValidation.ok}
                onClick={() => {
                  if (selectedRange && selectionValidation.ok) {
                    onSelectRange(selectedRange);
                  }
                }}
              >
                Use range
              </Button>
            </span>
          </TooltipTrigger>
          {!selectionValidation.ok && (
            <TooltipContent>{selectionValidation.message}</TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </DialogFooter>
  );
}
