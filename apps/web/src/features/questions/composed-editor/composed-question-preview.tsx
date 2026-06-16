import type { ComposedPreviewModel } from "#/domains/questions/authoring";
import { createEmptyQuestionAnswer } from "#/domains/questions";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import {
  composedPreviewToPresentableQuestion,
  QuestionPlayer,
} from "#/features/questions/question-player";

export function ComposedQuestionPreview({
  model,
  referencePreviewCache = {},
}: {
  model: ComposedPreviewModel;
  referencePreviewCache?: ReferencePreviewCache;
}) {
  return (
    <QuestionPlayer
      question={composedPreviewToPresentableQuestion(model)}
      answer={createEmptyQuestionAnswer()}
      mode="authoring-preview"
      referencePreviewCache={referencePreviewCache}
      onAnswerChange={() => {}}
    />
  );
}
