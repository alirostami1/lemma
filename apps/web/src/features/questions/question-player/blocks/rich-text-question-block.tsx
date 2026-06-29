import { RichContentPreview } from "#/features/questions/editor-shared";
import type { QuestionPlayerProps } from "../question-player-types";

export function RichTextQuestionBlock({
  content,
  referencePreviewCache,
}: {
  content: Extract<
    QuestionPlayerProps["question"]["blocks"][number],
    { type: "rich_text" }
  >["content"];
  referencePreviewCache: NonNullable<
    QuestionPlayerProps["referencePreviewCache"]
  >;
}) {
  return (
    <div className="grid gap-2 text-sm leading-6">
      <RichContentPreview
        content={content}
        mode="preview"
        referencePreviewCache={referencePreviewCache}
      />
    </div>
  );
}
