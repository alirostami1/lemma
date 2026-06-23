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
            disabled={disabled}
            icon={<FolderOpen className="size-4" />}
            key={questionSet.id}
            onClick={() => onSelectQuestionSet(questionSet.id)}
            selected={selected}
            title={questionSet.name}
          />
        );
      })}
    </div>
  );
}
