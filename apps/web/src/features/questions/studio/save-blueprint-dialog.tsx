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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@lemma/ui/components/field";
import { Input } from "@lemma/ui/components/input";
import { Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type SaveBlueprintMode = "update_existing" | "save_as_new";

export type SaveDialogState = {
  hasExistingBlueprint: boolean;
  isDirty: boolean;
  currentName: string;
  validationIssue: string | null;
};

export type SaveBlueprintDialogInput = {
  mode: SaveBlueprintMode;
  name: string;
};

export type SaveBlueprintDialogViewModel = {
  defaultMode: SaveBlueprintMode;
  description: string;
  disabledIssue: string | null;
  helperText: string;
  isSaveDisabled: boolean;
  shouldShowModeChoice: boolean;
};

type SaveBlueprintDialogProps = {
  open: boolean;
  state: SaveDialogState;
  isSaving: boolean;
  onOpenChange(open: boolean): void;
  onSave(input: SaveBlueprintDialogInput): void;
};

export function SaveBlueprintDialog({
  open,
  state,
  isSaving,
  onOpenChange,
  onSave,
}: SaveBlueprintDialogProps) {
  const viewModel = useMemo(
    () => createSaveBlueprintDialogViewModel(state, isSaving),
    [isSaving, state],
  );
  const [mode, setMode] = useState<SaveBlueprintMode>(viewModel.defaultMode);
  const [name, setName] = useState(state.currentName);

  useEffect(() => {
    if (!open) {
      return;
    }

    setMode(viewModel.defaultMode);
    setName(state.currentName);
  }, [open, state.currentName, viewModel.defaultMode]);

  const trimmedName = name.trim();
  const nameIssue = trimmedName.length === 0 ? "Add a blueprint name." : null;
  const unchangedCopyIssue =
    state.hasExistingBlueprint &&
    !state.isDirty &&
    trimmedName === state.currentName.trim()
      ? "Enter a new name to save a copy."
      : null;
  const disabledIssue =
    viewModel.disabledIssue ?? nameIssue ?? unchangedCopyIssue;
  const isSaveDisabled =
    viewModel.isSaveDisabled ||
    nameIssue !== null ||
    unchangedCopyIssue !== null;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();

            if (isSaveDisabled) {
              return;
            }

            onSave({
              mode,
              name: trimmedName,
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Save blueprint</DialogTitle>
            <DialogDescription>{viewModel.description}</DialogDescription>
          </DialogHeader>

          {viewModel.shouldShowModeChoice ? (
            <SaveModeChoice mode={mode} onModeChange={setMode} />
          ) : null}

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="save-blueprint-name">Name</FieldLabel>
              <Input
                disabled={isSaving}
                id="save-blueprint-name"
                maxLength={160}
                onChange={(event) => setName(event.currentTarget.value)}
                value={name}
              />
              <FieldDescription>{viewModel.helperText}</FieldDescription>
            </Field>
          </FieldGroup>

          {disabledIssue ? (
            <p className="text-sm text-destructive">{disabledIssue}</p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button disabled={isSaveDisabled} type="submit">
              <Save />
              {isSaving
                ? "Saving..."
                : mode === "save_as_new"
                  ? "Save as new"
                  : "Update existing"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function createSaveBlueprintDialogViewModel(
  state: SaveDialogState,
  isSaving: boolean,
): SaveBlueprintDialogViewModel {
  const disabledIssue = state.validationIssue;
  const defaultMode: SaveBlueprintMode =
    state.hasExistingBlueprint && state.isDirty
      ? "update_existing"
      : "save_as_new";

  if (!state.hasExistingBlueprint) {
    return {
      defaultMode,
      description: "This will create a reusable blueprint.",
      disabledIssue,
      helperText: "This name will appear in the saved blueprint list.",
      isSaveDisabled: isSaving || disabledIssue !== null,
      shouldShowModeChoice: false,
    };
  }

  return {
    defaultMode,
    description: state.isDirty
      ? "Choose how to save your changes."
      : "Enter a new name to save a copy.",
    disabledIssue,
    helperText: state.isDirty
      ? "Use the current name or enter a new one."
      : "Use a new name to create a copy.",
    isSaveDisabled: isSaving || disabledIssue !== null,
    shouldShowModeChoice: state.isDirty,
  };
}

function SaveModeChoice({
  mode,
  onModeChange,
}: {
  mode: SaveBlueprintMode;
  onModeChange(mode: SaveBlueprintMode): void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">What do you want to do?</p>

      <label className="flex cursor-pointer gap-3 rounded-md border bg-background p-3 text-sm">
        <input
          checked={mode === "update_existing"}
          name="save-blueprint-mode"
          onChange={() => onModeChange("update_existing")}
          type="radio"
        />
        <span className="grid gap-1">
          <span className="font-medium">Update existing blueprint</span>
          <span className="text-muted-foreground">
            Replace the saved blueprint with these changes.
          </span>
        </span>
      </label>

      <label className="flex cursor-pointer gap-3 rounded-md border bg-background p-3 text-sm">
        <input
          checked={mode === "save_as_new"}
          name="save-blueprint-mode"
          onChange={() => onModeChange("save_as_new")}
          type="radio"
        />
        <span className="grid gap-1">
          <span className="font-medium">Save as new blueprint</span>
          <span className="text-muted-foreground">
            Keep the existing blueprint unchanged and save a copy.
          </span>
        </span>
      </label>
    </div>
  );
}
