import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@lemma/ui/components/dialog";
import type { ReactNode } from "react";
import type { SavedBlueprintChooserController } from "./create-chooser-controller";
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
