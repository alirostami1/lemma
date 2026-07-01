import { Input } from "@lemma/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lemma/ui/components/select";
import {
  coerceInputPrimitiveValue,
  createDefaultPreviewInputPrimitive,
  getInputPrimitiveEffectiveValue,
  validateInputPrimitiveValue,
} from "#/domains/questions/authoring";
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
  const inputState = block.inputState ?? {
    input: createDefaultPreviewInputPrimitive({
      required: true,
      type: field?.type ?? "text",
    }),
    status: "materialized",
  };
  if (inputState.status === "unresolved_options") {
    const messageId = `${block.responseFieldId}-options-message`;
    return (
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor={block.responseFieldId}>
          {block.label ?? field?.label ?? "Answer"}
        </label>
        <Select disabled value={undefined}>
          <SelectTrigger
            aria-describedby={messageId}
            id={block.responseFieldId}
          >
            <SelectValue
              placeholder={block.placeholder ?? "Choose an option"}
            />
          </SelectTrigger>
          <SelectContent />
        </Select>
        <p className="text-xs text-muted-foreground" id={messageId}>
          {inputState.message}
        </p>
      </div>
    );
  }
  const input = inputState.input;
  const effectiveValue = getInputPrimitiveEffectiveValue(input, value);
  const validation = validateInputPrimitiveValue(input, effectiveValue);
  const errorId = `${block.responseFieldId}-error`;

  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium" htmlFor={block.responseFieldId}>
        {block.label ?? field?.label ?? "Answer"}
      </label>
      {input.type === "select" ? (
        <Select
          disabled={disabled}
          onValueChange={(nextValue) =>
            onAnswerChange(
              setQuestionAnswerResponse(
                answer,
                block.responseFieldId,
                nextValue,
              ),
            )
          }
          value={
            typeof effectiveValue === "string" && effectiveValue.length > 0
              ? effectiveValue
              : undefined
          }
        >
          <SelectTrigger
            aria-describedby={validation.valid ? undefined : errorId}
            aria-invalid={!validation.valid}
            id={block.responseFieldId}
          >
            <SelectValue placeholder={block.placeholder ?? "Answer"} />
          </SelectTrigger>
          <SelectContent>
            {(input.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label ?? option.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          aria-describedby={validation.valid ? undefined : errorId}
          aria-invalid={!validation.valid}
          disabled={disabled}
          id={block.responseFieldId}
          inputMode={input.type === "number" ? "decimal" : undefined}
          name={block.responseFieldId}
          onChange={(event) =>
            onAnswerChange(
              setQuestionAnswerResponse(
                answer,
                block.responseFieldId,
                coerceInputPrimitiveValue(event.currentTarget.value, input),
              ),
            )
          }
          placeholder={block.placeholder ?? "Answer"}
          value={formatQuestionAnswerValue(effectiveValue)}
        />
      )}
      {!validation.valid ? (
        <p className="text-xs text-destructive" id={errorId}>
          {validation.errors[0].message}
        </p>
      ) : null}
    </div>
  );
}
