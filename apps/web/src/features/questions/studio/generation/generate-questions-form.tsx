import type { FormEvent } from "react";
import { Button } from "@lemma/ui/components/button";
import { DialogClose, DialogFooter } from "@lemma/ui/components/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@lemma/ui/components/field";
import { Input } from "@lemma/ui/components/input";
import { InlineError } from "@lemma/ui/components/inline-error";
import type { QuestionSet } from "#/domains/questions/model";
import { GenerationTargetSection } from "./generation-target-section";

export function GenerateQuestionsForm({
  questionSets,
  questionSetMode,
  selectedQuestionSetId,
  newQuestionSetName,
  newQuestionSetDescription,
  countInput,
  isSubmitting,
  isGenerateDisabled,
  countIssue,
  existingQuestionSetIssue,
  newQuestionSetNameIssue,
  submitError,
  onSubmit,
  onQuestionSetValueChange,
  onNewQuestionSetNameChange,
  onNewQuestionSetDescriptionChange,
  onCountInputChange,
}: {
  questionSets: QuestionSet[];
  questionSetMode: "existing" | "create_new";
  selectedQuestionSetId: string;
  newQuestionSetName: string;
  newQuestionSetDescription: string;
  countInput: string;
  isSubmitting: boolean;
  isGenerateDisabled: boolean;
  countIssue: string | null;
  existingQuestionSetIssue: string | null;
  newQuestionSetNameIssue: string | null;
  submitError: string | null;
  onSubmit(): void;
  onQuestionSetValueChange(value: string): void;
  onNewQuestionSetNameChange(value: string): void;
  onNewQuestionSetDescriptionChange(value: string): void;
  onCountInputChange(value: string): void;
}) {
  return (
    <form
      className="grid gap-4"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <FieldGroup>
        <GenerationTargetSection
          questionSets={questionSets}
          questionSetMode={questionSetMode}
          selectedQuestionSetId={selectedQuestionSetId}
          newQuestionSetName={newQuestionSetName}
          newQuestionSetDescription={newQuestionSetDescription}
          isSubmitting={isSubmitting}
          existingQuestionSetIssue={existingQuestionSetIssue}
          newQuestionSetNameIssue={newQuestionSetNameIssue}
          onQuestionSetValueChange={onQuestionSetValueChange}
          onNewQuestionSetNameChange={onNewQuestionSetNameChange}
          onNewQuestionSetDescriptionChange={onNewQuestionSetDescriptionChange}
        />

        <Field>
          <FieldLabel htmlFor="generate-question-count">
            Number of questions
          </FieldLabel>
          <Input
            id="generate-question-count"
            type="number"
            min={1}
            max={100}
            value={countInput}
            disabled={isSubmitting}
            onChange={(event) => onCountInputChange(event.currentTarget.value)}
          />
          <FieldDescription>Choose between 1 and 100 questions.</FieldDescription>
          {countIssue ? (
            <p className="text-xs text-destructive">{countIssue}</p>
          ) : null}
        </Field>
      </FieldGroup>

      {submitError ? <InlineError message={submitError} /> : null}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={isSubmitting}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={isGenerateDisabled}>
          {isSubmitting ? "Generating..." : "Generate"}
        </Button>
      </DialogFooter>
    </form>
  );
}
