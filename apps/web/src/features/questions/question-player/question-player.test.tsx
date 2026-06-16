// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyQuestionAnswer } from "#/domains/questions";
import { QuestionPlayer } from "./question-player";
import type {
  PresentableQuestion,
  QuestionPlayerMode,
} from "./question-player-types";

const question: PresentableQuestion = {
  blocks: [
    {
      id: "prompt",
      type: "text",
      content: [{ type: "text", text: "What is 2 + 2?" }],
    },
    {
      id: "response",
      type: "response",
      responseFieldId: "answer",
      label: "Answer",
    },
  ],
  responseFields: [
    {
      id: "answer",
      type: "number",
      label: "Answer",
      required: true,
    },
  ],
};

const tableQuestion: PresentableQuestion = {
  blocks: [
    {
      id: "table",
      type: "table",
      table: {
        prompt: "",
        columns: [{ id: "column", label: "Value" }],
        rows: [{ id: "row", label: "Result" }],
        showColumnNames: true,
        showRowNames: true,
        responseFields: [
          {
            id: "table-answer",
            type: "number",
            label: "Table answer",
          },
        ],
        cells: [
          {
            id: "cell",
            rowId: "row",
            columnId: "column",
            type: "response",
            responseFieldId: "table-answer",
          },
        ],
      },
    },
  ],
  responseFields: [],
};

describe("QuestionPlayer", () => {
  afterEach(() => cleanup());

  it("emits controlled practice answers", async () => {
    const user = userEvent.setup();

    render(<Harness mode="practice" />);

    const input = screen.getByRole("textbox", { name: "Answer" });
    await user.type(input, "4");

    expect(input).toHaveValue("4");
    expect(screen.getByTestId("answer-json").textContent).toContain(
      '"value":4',
    );
  });

  it("emits controlled table answers", async () => {
    const user = userEvent.setup();

    render(<Harness mode="practice" question={tableQuestion} />);

    await user.type(
      screen.getByRole("textbox", {
        name: "Table answer (Result, Value)",
      }),
      "4",
    );

    expect(screen.getByTestId("answer-json").textContent).toContain(
      '"responseFieldId":"table-answer"',
    );
  });

  it("disables authoring preview inputs", () => {
    render(<Harness mode="authoring-preview" />);

    expect(screen.getByRole("textbox", { name: "Answer" })).toBeDisabled();
  });

  it("renders grading feedback without owning grading", () => {
    const onAnswerChange = vi.fn();

    render(
      <QuestionPlayer
        question={question}
        answer={createEmptyQuestionAnswer()}
        mode="review"
        feedback={{
          schemaVersion: 1,
          totalPoints: 1,
          earnedPoints: 1,
          status: "graded",
          details: [],
          graderVersion: "test",
        }}
        onAnswerChange={onAnswerChange}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain("Score: 1 / 1");
    expect(onAnswerChange).not.toHaveBeenCalled();
  });
});

function Harness({
  mode,
  question: harnessQuestion = question,
}: {
  mode: QuestionPlayerMode;
  question?: PresentableQuestion;
}) {
  const [answer, setAnswer] = useState(createEmptyQuestionAnswer);
  return (
    <>
      <QuestionPlayer
        question={harnessQuestion}
        answer={answer}
        mode={mode}
        onAnswerChange={setAnswer}
      />
      <output data-testid="answer-json">{JSON.stringify(answer)}</output>
    </>
  );
}
