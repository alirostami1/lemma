import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@lemma/ui/components/field";
import { Input } from "@lemma/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lemma/ui/components/select";
import type { QuestionSet } from "#/domains/questions/model";

export const CREATE_NEW_VALUE = "__create_new__";

export function GenerationTargetSection({
  questionSets,
  questionSetMode,
  selectedQuestionSetId,
  newQuestionSetName,
  newQuestionSetDescription,
  isSubmitting,
  existingQuestionSetIssue,
  newQuestionSetNameIssue,
  onQuestionSetValueChange,
  onNewQuestionSetNameChange,
  onNewQuestionSetDescriptionChange,
}: {
  questionSets: QuestionSet[];
  questionSetMode: "existing" | "create_new";
  selectedQuestionSetId: string;
  newQuestionSetName: string;
  newQuestionSetDescription: string;
  isSubmitting: boolean;
  existingQuestionSetIssue: string | null;
  newQuestionSetNameIssue: string | null;
  onQuestionSetValueChange(value: string): void;
  onNewQuestionSetNameChange(value: string): void;
  onNewQuestionSetDescriptionChange(value: string): void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor="generate-question-set">Question set</FieldLabel>
      <Select
        disabled={isSubmitting}
        onValueChange={onQuestionSetValueChange}
        value={
          questionSetMode === "create_new"
            ? CREATE_NEW_VALUE
            : selectedQuestionSetId
        }
      >
        <SelectTrigger id="generate-question-set">
          <SelectValue placeholder="Select question set" />
        </SelectTrigger>
        <SelectContent>
          {questionSets.map((questionSet) => (
            <SelectItem key={questionSet.id} value={questionSet.id}>
              {questionSet.name}
            </SelectItem>
          ))}
          <SelectItem value={CREATE_NEW_VALUE}>
            Create new question set
          </SelectItem>
        </SelectContent>
      </Select>
      {existingQuestionSetIssue ? (
        <p className="text-xs text-destructive">{existingQuestionSetIssue}</p>
      ) : null}

      {questionSetMode === "create_new" ? (
        <div className="mt-3 grid gap-3 rounded-lg border bg-muted/20 p-3">
          <Field>
            <FieldLabel htmlFor="generate-question-set-name">
              New question set name
            </FieldLabel>
            <Input
              disabled={isSubmitting}
              id="generate-question-set-name"
              onChange={(event) =>
                onNewQuestionSetNameChange(event.currentTarget.value)
              }
              value={newQuestionSetName}
            />
            {newQuestionSetNameIssue ? (
              <p className="text-xs text-destructive">
                {newQuestionSetNameIssue}
              </p>
            ) : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="generate-question-set-description">
              Description
            </FieldLabel>
            <Input
              disabled={isSubmitting}
              id="generate-question-set-description"
              onChange={(event) =>
                onNewQuestionSetDescriptionChange(event.currentTarget.value)
              }
              value={newQuestionSetDescription}
            />
            <FieldDescription>
              Optional. Helps identify question set later.
            </FieldDescription>
          </Field>
        </div>
      ) : null}
    </Field>
  );
}
