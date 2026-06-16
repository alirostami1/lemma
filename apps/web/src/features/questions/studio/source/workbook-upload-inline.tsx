import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@lemma/ui/components/dialog";
import type { Workbook } from "#/domains/workbooks/model";
import { WorkbookUploadForm } from "#/features/workbooks";

export function WorkbookUploadInline({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  onCreated(workbook: Workbook): void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload source</DialogTitle>
          <DialogDescription>
            Add a source and keep working in Studio.
          </DialogDescription>
        </DialogHeader>
        <WorkbookUploadForm
          onCreated={onCreated}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
