import { Button } from "@lemma/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@lemma/ui/components/dialog";
import { Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { QuestionSet } from "#/domains/questions/model";
import { CreateQuestionSetForm } from "./create-question-set-form";
import { useCreateQuestionSetController } from "./use-create-question-set-controller";

export type CreateQuestionSetDialogProps = {
  open: boolean;
  name: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  trigger?: ReactNode;
  onNameChange(name: string): void;
  onOpenChange(open: boolean): void;
  onSubmit(): void;
  onCancel(): void;
};

export function CreateQuestionSetDialog({
  open,
  name,
  errorMessage,
  isSubmitting,
  trigger,
  onNameChange,
  onOpenChange,
  onSubmit,
  onCancel,
}: CreateQuestionSetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button type="button" variant="default">
            <Plus />
            Create question set
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-sm">
        <div className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Create question set</DialogTitle>
            <DialogDescription>
              Add a question set to organize generated questions.
            </DialogDescription>
          </DialogHeader>
          <CreateQuestionSetForm
            name={name}
            errorMessage={errorMessage}
            isSubmitting={isSubmitting}
            onNameChange={onNameChange}
            onSubmit={onSubmit}
            onCancel={onCancel}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type CreateQuestionSetDialogControllerProps = {
  onCreated?(questionSet: QuestionSet): void;
  trigger?: ReactNode;
};

export function CreateQuestionSetDialogController({
  onCreated,
  trigger,
}: CreateQuestionSetDialogControllerProps) {
  const [open, setOpen] = useState(false);
  const controller = useCreateQuestionSetController();

  function onOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      controller.reset();
    }
  }

  return (
    <CreateQuestionSetDialog
      open={open}
      name={controller.name}
      errorMessage={controller.errorMessage}
      isSubmitting={controller.isSubmitting}
      trigger={trigger}
      onNameChange={controller.onNameChange}
      onOpenChange={onOpenChange}
      onSubmit={() => {
        void controller.onSubmit().then((questionSet) => {
          if (!questionSet) {
            return;
          }
          onCreated?.(questionSet);
          setOpen(false);
        });
      }}
      onCancel={() => onOpenChange(false)}
    />
  );
}
