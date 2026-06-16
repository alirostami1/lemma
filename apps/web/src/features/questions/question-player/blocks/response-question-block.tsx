import { Input } from "@lemma/ui/components/input";
import { coerceAnswerValue } from "#/domains/questions/authoring";
import {
  formatQuestionAnswerValue,
  setQuestionAnswerResponse,
} from "../answer-state";
import type {
  PresentableQuestionBlock,
  QuestionPlayerProps,
} from "../question-player-types";

export function ResponseQuestionBlock({
  block,
  question,
  answer,
  disabled,
  onAnswerChange,
}: {
  block: Extract<PresentableQuestionBlock, { type: "response" }>;
  question: QuestionPlayerProps["question"];
  answer: QuestionPlayerProps["answer"];
  disabled: boolean;
  onAnswerChange: QuestionPlayerProps["onAnswerChange"];
}) {
  const field = question.responseFields.find(
    (candidate) => candidate.id === block.responseFieldId,
  );
  const value = answer.responses.find(
    (response) => response.responseFieldId === block.responseFieldId,
  )?.value;

  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium" htmlFor={block.responseFieldId}>
        {block.label ?? field?.label ?? "Answer"}
      </label>
      <Input
        id={block.responseFieldId}
        name={block.responseFieldId}
        disabled={disabled}
        inputMode={field?.type === "number" ? "decimal" : undefined}
        placeholder={block.placeholder ?? "Answer"}
        value={formatQuestionAnswerValue(value)}
        onChange={(event) =>
          onAnswerChange(
            setQuestionAnswerResponse(
              answer,
              block.responseFieldId,
              coerceAnswerValue(event.currentTarget.value, field),
            ),
          )
        }
      />
    </div>
  );
}
