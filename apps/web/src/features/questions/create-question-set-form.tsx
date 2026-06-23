import { Button } from "@lemma/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@lemma/ui/components/field";
import { Input } from "@lemma/ui/components/input";
import type { FormEvent, ReactNode } from "react";

export type CreateQuestionSetFormProps = {
  submitLabel?: string;
  cancelLabel?: string;
  submitIcon?: ReactNode;
  cancelIcon?: ReactNode;
  autoFocus?: boolean;
  disabled?: boolean;
  name: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  onNameChange(name: string): void;
  onSubmit(): void;
  onCancel?(): void;
};

export function CreateQuestionSetForm({
  submitLabel = "Create question set",
  cancelLabel = "Cancel",
  submitIcon,
  cancelIcon,
  autoFocus,
  disabled,
  name,
  errorMessage,
  isSubmitting,
  onNameChange,
  onSubmit,
  onCancel,
}: CreateQuestionSetFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="question-set-name">Name</FieldLabel>
          <Input
            autoFocus={autoFocus}
            disabled={disabled || isSubmitting}
            id="question-set-name"
            name="name"
            onChange={(event) => onNameChange(event.currentTarget.value)}
            placeholder="Question set name"
            value={name}
          />
        </Field>
      </FieldGroup>
      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel ? (
          <Button
            className="gap-2"
            disabled={disabled || isSubmitting}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            {cancelIcon}
            {cancelLabel}
          </Button>
        ) : null}
        <Button
          className="gap-2"
          disabled={disabled || isSubmitting}
          type="submit"
        >
          {submitIcon}
          {isSubmitting ? "Creating..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
