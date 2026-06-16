import { FolderOpen } from "lucide-react";
import type { QuestionSet } from "#/domains/questions/model";
import { ToolbarPopoverChoice } from "./shared/toolbar-popover-choice";

export type QuestionSetSelectListProps = {
  questionSets: QuestionSet[];
  selectedQuestionSetId: string;
  onSelectQuestionSet(questionSetId: string): void;
  disabled?: boolean;
};

export function QuestionSetSelectList({
  questionSets,
  selectedQuestionSetId,
  onSelectQuestionSet,
  disabled,
}: QuestionSetSelectListProps) {
  return (
    <div className="grid gap-2">
      {questionSets.map((questionSet) => {
        const selected = questionSet.id === selectedQuestionSetId;
        return (
          <ToolbarPopoverChoice
            key={questionSet.id}
            selected={selected}
            disabled={disabled}
            icon={<FolderOpen className="size-4" />}
            title={questionSet.name}
            onClick={() => onSelectQuestionSet(questionSet.id)}
          />
        );
      })}
    </div>
  );
}
