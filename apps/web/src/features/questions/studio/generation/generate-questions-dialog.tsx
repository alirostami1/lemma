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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          questionSets={questionSets}
          questionSetMode={questionSetMode}
          selectedQuestionSetId={selectedQuestionSetId}
          newQuestionSetName={newQuestionSetName}
          newQuestionSetDescription={newQuestionSetDescription}
          countInput={countInput}
          isSubmitting={isSubmitting}
          isGenerateDisabled={isGenerateDisabled}
          countIssue={countIssue}
          existingQuestionSetIssue={existingQuestionSetIssue}
          newQuestionSetNameIssue={newQuestionSetNameIssue}
          submitError={submitError}
          onSubmit={onSubmit}
          onQuestionSetValueChange={onQuestionSetValueChange}
          onNewQuestionSetNameChange={onNewQuestionSetNameChange}
          onNewQuestionSetDescriptionChange={onNewQuestionSetDescriptionChange}
          onCountInputChange={onCountInputChange}
        />
      </DialogContent>
    </Dialog>
  );
}
