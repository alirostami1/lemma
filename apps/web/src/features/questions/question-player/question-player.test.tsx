// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyQuestionAnswer, type Question } from "#/domains/questions";
import { QuestionPlayer } from "./question-player";
import { questionToPresentableQuestion } from "./question-player-model";
import type {
  PresentableQuestion,
  QuestionPlayerMode,
} from "./question-player-types";

const question: PresentableQuestion = {
  blocks: [
    {
      content: [{ text: "What is 2 + 2?", type: "text" }],
      id: "prompt",
      type: "text",
    },
    {
      id: "response",
      label: "Answer",
      responseFieldId: "answer",
      type: "response",
    },
  ],
  responseFields: [
    {
      id: "answer",
      label: "Answer",
      type: "number",
    },
  ],
};

const tableQuestion: PresentableQuestion = {
  blocks: [
    {
      id: "table",
      table: {
        cells: [
          {
            blocks: [
              {
                id: "table-input",
                responseFieldId: "table-answer",
                type: "input",
              },
            ],
            columnId: "column",
            id: "cell",
            rowId: "row",
          },
        ],
        columns: [{ id: "column", label: "Value" }],
        prompt: "",
        responseFields: [
          {
            id: "table-answer",
            label: "Table answer",
            type: "number",
          },
        ],
        rows: [{ id: "row", label: "Result" }],
        showColumnNames: true,
        showRowNames: true,
      },
      type: "table",
    },
  ],
  responseFields: [],
};

const selectQuestion: PresentableQuestion = {
  blocks: [
    {
      id: "choice",
      inputState: {
        input: {
          options: [
            { label: "Alpha", value: "a" },
            { label: "Bravo", value: "b" },
          ],
          type: "select",
          validation: { allowedValues: ["a", "b"], required: true },
        },
        status: "materialized",
      },
      label: "Choice",
      responseFieldId: "choice",
      type: "response",
    },
  ],
  responseFields: [
    {
      id: "choice",
      label: "Choice",
      type: "select",
    },
  ],
};

const unresolvedSelectQuestion: PresentableQuestion = {
  blocks: [
    {
      id: "choice",
      inputState: {
        input: {
          optionsSource: { referenceId: "choice_options", type: "reference" },
          type: "select",
          validation: { allowedValues: ["a"], required: true },
        },
        message: "Options are not available in this preview.",
        status: "unresolved_options",
      },
      label: "Choice",
      responseFieldId: "choice",
      type: "response",
    },
  ],
  responseFields: [
    {
      id: "choice",
      label: "Choice",
      type: "select",
    },
  ],
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

  it("renders select inputs and emits selected values", async () => {
    const user = userEvent.setup();

    render(<Harness mode="practice" question={selectQuestion} />);

    expect(screen.getByText("Enter an answer.")).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Choice" }));
    await user.click(screen.getByRole("option", { name: "Bravo" }));

    expect(screen.getByTestId("answer-json").textContent).toContain(
      '"value":"b"',
    );
  });

  it("shows unresolved select options without runtime validation", () => {
    render(
      <Harness mode="authoring-preview" question={unresolvedSelectQuestion} />,
    );

    expect(
      screen.getByText("Options are not available in this preview."),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Choice" })).toBeDisabled();
    expect(screen.queryByText("Answer settings are invalid.")).toBeNull();
    expect(screen.queryByText("Enter an answer.")).toBeNull();
  });

  it("disables authoring preview inputs", () => {
    render(<Harness mode="authoring-preview" />);

    expect(screen.getByRole("textbox", { name: "Answer" })).toBeDisabled();
  });

  it("renders grading feedback without owning grading", () => {
    const onAnswerChange = vi.fn();

    render(
      <QuestionPlayer
        answer={createEmptyQuestionAnswer()}
        feedback={{
          details: [],
          earnedPoints: 1,
          graderVersion: "test",
          schemaVersion: 1,
          status: "graded",
          totalPoints: 1,
        }}
        mode="review"
        onAnswerChange={onAnswerChange}
        question={question}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain("Score: 1 / 1");
    expect(onAnswerChange).not.toHaveBeenCalled();
  });

  it("renders generated rich text heading values through the presentable adapter", () => {
    const presentable = questionToPresentableQuestion(
      generatedRichHeadingQuestion(),
    );
    const { container } = render(
      <QuestionPlayer
        answer={createEmptyQuestionAnswer()}
        mode="authoring-preview"
        onAnswerChange={() => {}}
        question={presentable}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Revenue 1200" }));
    expect(screen.getByRole("heading", { level: 2, name: "Margin 0.32" }));
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();
    expect(container.textContent).not.toContain("revenue");
    expect(container.textContent).not.toContain("margin");
    expect(container.textContent).not.toContain("reference_1");
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
        answer={answer}
        mode={mode}
        onAnswerChange={setAnswer}
        question={harnessQuestion}
      />
      <output data-testid="answer-json">{JSON.stringify(answer)}</output>
    </>
  );
}

function generatedRichHeadingQuestion(): Question {
  const timestamp = new Date("2026-06-14T00:00:00Z");
  return {
    blueprintId: "blueprint-1",
    body: {
      blocks: [
        {
          content: {
            content: [
              {
                attrs: { level: 1 },
                content: [{ text: "Revenue 1200", type: "text" }],
                type: "heading",
              },
              {
                attrs: { level: 2 },
                content: [{ text: "Margin 0.32", type: "text" }],
                type: "heading",
              },
            ],
            type: "doc",
          },
          id: "rich",
          kind: "primitive",
          type: "rich_text",
        },
      ],
      responseFields: [],
      schemaVersion: 2,
    },
    createdAt: timestamp,
    createdByUserId: "creator",
    generationRunId: "run-1",
    id: "question-1",
    ownerUserId: "owner",
    producer: {
      compiler: "test",
      schemaVersion: 1,
    },
    status: "active",
    updatedAt: timestamp,
  };
}
