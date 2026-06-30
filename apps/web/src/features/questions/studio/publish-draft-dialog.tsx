import { Button } from "@lemma/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@lemma/ui/components/dialog";
import { Send } from "lucide-react";
import { useMemo } from "react";
import { ContextualHelpPopover } from "../shared/contextual-help-popover";

export type PublishDraftDialogState = {
  currentName: string;
  validationIssue: string | null;
};

export type PublishDraftDialogViewModel = {
  description: string;
  disabledIssue: string | null;
  isPublishDisabled: boolean;
  summary: string;
};

type PublishDraftDialogProps = {
  open: boolean;
  state: PublishDraftDialogState;
  isSavingBeforePublish: boolean;
  isPublishing: boolean;
  onOpenChange(open: boolean): void;
  onPublish(): void;
};

export function PublishDraftDialog({
  open,
  state,
  isSavingBeforePublish,
  isPublishing,
  onOpenChange,
  onPublish,
}: PublishDraftDialogProps) {
  const viewModel = useMemo(
    () =>
      createPublishDraftDialogViewModel(
        state,
        isPublishing,
        isSavingBeforePublish,
      ),
    [isPublishing, isSavingBeforePublish, state],
  );
  let publishButtonLabel = "Publish";
  if (isPublishing) {
    publishButtonLabel = "Publishing...";
  } else if (isSavingBeforePublish) {
    publishButtonLabel = "Saving...";
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();

            if (viewModel.isPublishDisabled) {
              return;
            }

            onPublish();
          }}
        >
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <DialogTitle>Publish</DialogTitle>
                <DialogDescription>{viewModel.description}</DialogDescription>
              </div>
              <ContextualHelpPopover
                label="Help for publishing"
                title="Publishing"
              >
                Review the blueprint name, blocks, and added values before
                publishing. Saving happens first.
              </ContextualHelpPopover>
            </div>
          </DialogHeader>

          <p className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
            {viewModel.summary}
          </p>

          {viewModel.disabledIssue ? (
            <p className="text-sm text-destructive">
              {viewModel.disabledIssue}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button disabled={viewModel.isPublishDisabled} type="submit">
              <Send />
              {publishButtonLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function createPublishDraftDialogViewModel(
  state: PublishDraftDialogState,
  isPublishing: boolean,
  isSavingBeforePublish = false,
): PublishDraftDialogViewModel {
  return {
    description: "Review and publish this blueprint.",
    disabledIssue: state.validationIssue,
    isPublishDisabled:
      isPublishing || isSavingBeforePublish || state.validationIssue !== null,
    summary: `"${state.currentName.trim() || "Untitled blueprint"}" will be saved and published.`,
  };
}
