import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@lemma/ui/components/dialog";
import { InlineError } from "@lemma/ui/components/inline-error";
import { GenerateQuestionsForm } from "./generate-questions-form";
import type { GenerateQuestionsDialogProps } from "./generation-controller-types";
import { GenerationSourceSummary } from "./generation-source-summary";

export function GenerateQuestionsDialog({
  open,
  source,
  questionSets,
  questionSetsLoading,
  questionSetsErrorMessage,
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
  onOpenChange,
  onSubmit,
  onQuestionSetValueChange,
  onNewQuestionSetNameChange,
  onNewQuestionSetDescriptionChange,
  onCountInputChange,
}: GenerateQuestionsDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate questions</DialogTitle>
          <DialogDescription>
            <GenerationSourceSummary source={source} />
          </DialogDescription>
        </DialogHeader>

        {questionSetsLoading ? (
          <p className="text-sm text-muted-foreground">
            Loading question sets...
          </p>
        ) : null}

        {questionSetsErrorMessage ? (
          <InlineError message={questionSetsErrorMessage} />
        ) : null}

        <GenerateQuestionsForm
          countInput={countInput}
          countIssue={countIssue}
          existingQuestionSetIssue={existingQuestionSetIssue}
          isGenerateDisabled={isGenerateDisabled}
          isSubmitting={isSubmitting}
          newQuestionSetDescription={newQuestionSetDescription}
          newQuestionSetName={newQuestionSetName}
          newQuestionSetNameIssue={newQuestionSetNameIssue}
          onCountInputChange={onCountInputChange}
          onNewQuestionSetDescriptionChange={onNewQuestionSetDescriptionChange}
          onNewQuestionSetNameChange={onNewQuestionSetNameChange}
          onQuestionSetValueChange={onQuestionSetValueChange}
          onSubmit={onSubmit}
          questionSetMode={questionSetMode}
          questionSets={questionSets}
          selectedQuestionSetId={selectedQuestionSetId}
          submitError={submitError}
        />
      </DialogContent>
    </Dialog>
  );
}
