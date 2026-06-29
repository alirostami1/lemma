import { InlineContentRenderer } from "#/features/questions/editor-shared";
import type { QuestionPlayerProps } from "../question-player-types";

export function TextQuestionBlock({
  content,
  referencePreviewCache,
}: {
  content: Extract<
    QuestionPlayerProps["question"]["blocks"][number],
    { type: "text" }
  >["content"];
  referencePreviewCache: NonNullable<
    QuestionPlayerProps["referencePreviewCache"]
  >;
}) {
  return (
    <p className="whitespace-pre-wrap text-sm leading-6">
      <InlineContentRenderer
        content={content}
        mode="preview"
        referencePreviewValues={referencePreviewCache}
      />
    </p>
  );
}
