import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@lemma/ui/components/alert-dialog";
import type {
  StudioBlueprintOpenWarningState,
  StudioDraftRecoveryState,
  StudioResetConfirmationState,
} from "./use-blueprint-draft-controller";

export function StudioDraftRecoveryDialog({
  open,
  snapshot,
  onDiscard,
  onKeepCurrent,
  onRestore,
}: StudioDraftRecoveryState) {
  const savedAt = snapshot
    ? new Date(snapshot.lastLocalSaveTimestamp).toLocaleString()
    : "";

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Local draft found</AlertDialogTitle>
          <AlertDialogDescription>
            A local draft from {savedAt} is newer than the current blueprint.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDiscard}>
            Discard draft
          </AlertDialogCancel>
          <AlertDialogCancel onClick={onKeepCurrent}>
            Keep current
          </AlertDialogCancel>
          <AlertDialogAction onClick={onRestore}>
            Restore draft
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function StudioBlueprintOpenWarningDialog({
  open,
  snapshot,
  onCancel,
  onContinue,
}: StudioBlueprintOpenWarningState) {
  const savedAt = snapshot
    ? new Date(snapshot.lastLocalSaveTimestamp).toLocaleString()
    : "";

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Open saved blueprint?</AlertDialogTitle>
          <AlertDialogDescription>
            Opening this blueprint replaces the current Studio draft. Local
            changes from {savedAt} will be discarded.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Keep current draft
          </AlertDialogCancel>
          <AlertDialogAction onClick={onContinue}>
            Open blueprint
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function StudioResetConfirmationDialog({
  open,
  onCancel,
  onConfirm,
}: StudioResetConfirmationState) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset Studio?</AlertDialogTitle>
          <AlertDialogDescription>
            This clears the current Studio draft and starts a fresh blueprint.
            Saved blueprints are not deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Reset</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
