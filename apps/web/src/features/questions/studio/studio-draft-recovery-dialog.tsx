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
          <AlertDialogTitle>Saved changes found</AlertDialogTitle>
          <AlertDialogDescription>
            Saved changes from {savedAt} are newer than the current blueprint.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDiscard}>
            Discard changes
          </AlertDialogCancel>
          <AlertDialogCancel onClick={onKeepCurrent}>
            Keep current
          </AlertDialogCancel>
          <AlertDialogAction onClick={onRestore}>
            Restore changes
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
            This clears the current work and starts a fresh blueprint. Saved
            blueprints are not deleted.
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
