import { Button } from "@lemma/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@lemma/ui/components/dialog";
import { Upload } from "lucide-react";
import type { ReactNode } from "react";
import type { Workbook } from "#/domains/workbooks/model";
import { WorkbookUploadForm } from "#/features/workbooks";
import type {
  SavedBlueprintChooserController,
  SourceChooserController,
} from "./create-chooser-controller";
import { CreatePaginatedList } from "./create-paginated-list";

export function SavedBlueprintChooserDialog({
  controller,
}: {
  controller: SavedBlueprintChooserController;
}) {
  return (
    <CreateChooserDialog
      open={controller.open}
      title="Choose blueprint"
      description="Open a saved blueprint in Studio."
      onOpenChange={controller.onOpenChange}
    >
      <CreatePaginatedList
        {...controller}
        emptyMessage="No saved blueprints yet."
      />
    </CreateChooserDialog>
  );
}

export function SourceChooserDialog({
  controller,
}: {
  controller: SourceChooserController;
}) {
  return (
    <CreateChooserDialog
      open={controller.open}
      title="Choose source"
      description="Open Studio with a source selected."
      onOpenChange={controller.onOpenChange}
      footer={
        <Button
          type="button"
          variant="ghost"
          onClick={controller.onUploadSource}
        >
          <Upload />
          Upload source
        </Button>
      }
    >
      <CreatePaginatedList
        {...controller}
        emptyMessage="No ready sources yet."
      />
    </CreateChooserDialog>
  );
}

function CreateChooserDialog({
  open,
  title,
  description,
  children,
  footer,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  onOpenChange(open: boolean): void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60dvh] overflow-y-auto pr-3">{children}</div>
        {footer ? <div className="flex justify-end">{footer}</div> : null}
      </DialogContent>
    </Dialog>
  );
}

export function UploadSourceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  onCreated(source: Workbook): void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload source</DialogTitle>
          <DialogDescription>
            Add a source, then continue in Studio.
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
