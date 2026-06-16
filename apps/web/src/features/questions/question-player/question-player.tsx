import { RichTextQuestionBlock } from "./blocks/rich-text-question-block";
import { ResponseQuestionBlock } from "./blocks/response-question-block";
import { TableQuestionBlock } from "./blocks/table-question-block";
import { TextQuestionBlock } from "./blocks/text-question-block";
import type {
  PresentableQuestionBlock,
  QuestionPlayerProps,
} from "./question-player-types";

export function QuestionPlayer({
  question,
  answer,
  mode,
  feedback,
  referencePreviewCache = {},
  onSelectReference,
  onAnswerChange,
}: QuestionPlayerProps) {
  const disabled = mode === "authoring-preview" || mode === "review";

  return (
    <div className="grid gap-4">
      {question.blocks.map((block) => (
        <QuestionBlock
          key={block.id}
          block={block}
          question={question}
          answer={answer}
          disabled={disabled}
          referencePreviewCache={referencePreviewCache}
          onSelectReference={onSelectReference}
          onAnswerChange={onAnswerChange}
        />
      ))}
      {feedback ? (
        <output className="rounded-lg border bg-muted/30 p-3 text-sm">
          Score: {feedback.earnedPoints} / {feedback.totalPoints}
          {feedback.status === "needs_manual_review"
            ? " - Needs manual review"
            : ""}
        </output>
      ) : null}
    </div>
  );
}

function QuestionBlock({
  block,
  question,
  answer,
  disabled,
  referencePreviewCache,
  onSelectReference,
  onAnswerChange,
}: {
  block: PresentableQuestionBlock;
  question: QuestionPlayerProps["question"];
  answer: QuestionPlayerProps["answer"];
  disabled: boolean;
  referencePreviewCache: NonNullable<
    QuestionPlayerProps["referencePreviewCache"]
  >;
  onSelectReference: QuestionPlayerProps["onSelectReference"];
  onAnswerChange: QuestionPlayerProps["onAnswerChange"];
}) {
  switch (block.type) {
    case "text":
      return (
        <TextQuestionBlock
          content={block.content}
          referencePreviewCache={referencePreviewCache}
          onSelectReference={onSelectReference}
        />
      );
    case "rich_text":
      return (
        <RichTextQuestionBlock
          content={block.content}
          referencePreviewCache={referencePreviewCache}
        />
      );
    case "separator":
      return <hr className="border-border" />;
    case "response":
      return (
        <ResponseQuestionBlock
          block={block}
          question={question}
          answer={answer}
          disabled={disabled}
          onAnswerChange={onAnswerChange}
        />
      );
    case "table":
      return (
        <TableQuestionBlock
          block={block}
          answer={answer}
          disabled={disabled}
          referencePreviewCache={referencePreviewCache}
          onAnswerChange={onAnswerChange}
        />
      );
  }
}
