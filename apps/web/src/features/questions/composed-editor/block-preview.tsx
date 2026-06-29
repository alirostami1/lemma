import { createEmptyQuestionAnswer } from "#/domains/questions";
import type { ComposedEditorBlock } from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import {
  editorBlockToPresentableQuestion,
  QuestionPlayer,
} from "#/features/questions/question-player";

export function BlockPreview({
  block,
  referencePreviewCache,
}: {
  block: ComposedEditorBlock;
  referencePreviewCache: ReferencePreviewCache;
}) {
  return (
    <QuestionPlayer
      answer={createEmptyQuestionAnswer()}
      mode="authoring-preview"
      onAnswerChange={() => {}}
      question={editorBlockToPresentableQuestion(block)}
      referencePreviewCache={referencePreviewCache}
    />
  );
}
