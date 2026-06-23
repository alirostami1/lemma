import { Button } from "@lemma/ui/components/button";
import { DialogClose, DialogFooter } from "@lemma/ui/components/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@lemma/ui/components/field";
import { InlineError } from "@lemma/ui/components/inline-error";
import { Input } from "@lemma/ui/components/input";
import type { FormEvent } from "react";
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
          existingQuestionSetIssue={existingQuestionSetIssue}
          isSubmitting={isSubmitting}
          newQuestionSetDescription={newQuestionSetDescription}
          newQuestionSetName={newQuestionSetName}
          newQuestionSetNameIssue={newQuestionSetNameIssue}
          onNewQuestionSetDescriptionChange={onNewQuestionSetDescriptionChange}
          onNewQuestionSetNameChange={onNewQuestionSetNameChange}
          onQuestionSetValueChange={onQuestionSetValueChange}
          questionSetMode={questionSetMode}
          questionSets={questionSets}
          selectedQuestionSetId={selectedQuestionSetId}
        />

        <Field>
          <FieldLabel htmlFor="generate-question-count">
            Number of questions
          </FieldLabel>
          <Input
            disabled={isSubmitting}
            id="generate-question-count"
            max={100}
            min={1}
            onChange={(event) => onCountInputChange(event.currentTarget.value)}
            type="number"
            value={countInput}
          />
          <FieldDescription>
            Choose between 1 and 100 questions.
          </FieldDescription>
          {countIssue ? (
            <p className="text-xs text-destructive">{countIssue}</p>
          ) : null}
        </Field>
      </FieldGroup>

      {submitError ? <InlineError message={submitError} /> : null}

      <DialogFooter>
        <DialogClose asChild>
          <Button disabled={isSubmitting} type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button disabled={isGenerateDisabled} type="submit">
          {isSubmitting ? "Generating..." : "Generate"}
        </Button>
      </DialogFooter>
    </form>
  );
}
