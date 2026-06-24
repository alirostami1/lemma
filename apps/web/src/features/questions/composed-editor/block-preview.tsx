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
      answer={createEmptyQuestionAnswer()}
      mode="authoring-preview"
      onAnswerChange={() => {}}
      onSelectReference={onSelectReference}
      question={editorBlockToPresentableQuestion(block)}
      referencePreviewCache={referencePreviewCache}
    />
  );
}
