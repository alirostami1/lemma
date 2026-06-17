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
  onSelectReference,
}: {
  block: ComposedEditorBlock;
  referencePreviewCache: ReferencePreviewCache;
  onSelectReference(referenceId: string): void;
}) {
  return (
    <QuestionPlayer
      question={editorBlockToPresentableQuestion(block)}
      answer={createEmptyQuestionAnswer()}
      mode="authoring-preview"
      referencePreviewCache={referencePreviewCache}
      onSelectReference={onSelectReference}
      onAnswerChange={() => {}}
    />
  );
}
