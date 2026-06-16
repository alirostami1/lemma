import {
  questionAnswerToTableAnswerState,
  tableAnswerStateToQuestionAnswer,
} from "#/domains/questions";
import { TableBlockPreview } from "#/features/questions/table-block-editor";
import type {
  PresentableQuestionBlock,
  QuestionPlayerProps,
} from "../question-player-types";

export function TableQuestionBlock({
  block,
  answer,
  disabled,
  referencePreviewCache,
  onAnswerChange,
}: {
  block: Extract<PresentableQuestionBlock, { type: "table" }>;
  answer: QuestionPlayerProps["answer"];
  disabled: boolean;
  referencePreviewCache: NonNullable<
    QuestionPlayerProps["referencePreviewCache"]
  >;
  onAnswerChange: QuestionPlayerProps["onAnswerChange"];
}) {
  return (
    <TableBlockPreview
      model={block.table}
      answer={questionAnswerToTableAnswerState(answer)}
      referencePreviewCache={referencePreviewCache}
      disabled={disabled}
      showPrompt={false}
      onAnswerChange={(nextAnswer) =>
        onAnswerChange(tableAnswerStateToQuestionAnswer(nextAnswer))
      }
    />
  );
}
