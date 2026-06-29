import { ResponseQuestionBlock } from "./blocks/response-question-block";
import { RichTextQuestionBlock } from "./blocks/rich-text-question-block";
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
  onAnswerChange,
}: QuestionPlayerProps) {
  const disabled = mode === "authoring-preview" || mode === "review";

  return (
    <div className="grid gap-4">
      {question.blocks.map((block) => (
        <QuestionBlock
          answer={answer}
          block={block}
          disabled={disabled}
          key={block.id}
          onAnswerChange={onAnswerChange}
          question={question}
          referencePreviewCache={referencePreviewCache}
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
  onAnswerChange,
}: {
  block: PresentableQuestionBlock;
  question: QuestionPlayerProps["question"];
  answer: QuestionPlayerProps["answer"];
  disabled: boolean;
  referencePreviewCache: NonNullable<
    QuestionPlayerProps["referencePreviewCache"]
  >;
  onAnswerChange: QuestionPlayerProps["onAnswerChange"];
}) {
  switch (block.type) {
    case "text":
      return (
        <TextQuestionBlock
          content={block.content}
          referencePreviewCache={referencePreviewCache}
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
          answer={answer}
          block={block}
          disabled={disabled}
          onAnswerChange={onAnswerChange}
          question={question}
        />
      );
    case "table":
      return (
        <TableQuestionBlock
          answer={answer}
          block={block}
          disabled={disabled}
          onAnswerChange={onAnswerChange}
          referencePreviewCache={referencePreviewCache}
        />
      );
  }
}
