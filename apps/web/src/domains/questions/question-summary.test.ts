import { describe, expect, it } from "vitest";
import type { Question } from "./model";
import { getQuestionSummaryText } from "./question-summary";

describe("question summary text", () => {
  it("uses top-level text content", () => {
    expect(
      getQuestionSummaryText(
        question([
          {
            content: [{ text: "What is 2 + 2?", type: "text" }],
            id: "prompt",
            kind: "primitive",
            type: "text",
          },
        ]),
      ),
    ).toBe("What is 2 + 2?");
  });

  it("uses nested container text", () => {
    expect(
      getQuestionSummaryText(
        question([
          {
            blocks: [
              {
                content: [{ text: "Nested prompt", type: "text" }],
                id: "nested_text",
                kind: "primitive",
                type: "text",
              },
            ],
            id: "step_1",
            kind: "container",
            title: "Step one",
            type: "step",
          },
        ]),
      ),
    ).toBe("Nested prompt");
  });

  it("falls back for input blocks", () => {
    expect(
      getQuestionSummaryText(
        question([
          {
            id: "answer_input",
            input: {
              schemaVersion: 1,
              type: "text",
            },
            kind: "primitive",
            responseFieldId: "answer",
            type: "input",
          },
        ]),
      ),
    ).toBe("Answer input");
  });

  it("falls back for table blocks", () => {
    expect(
      getQuestionSummaryText(
        question([
          {
            cells: [
              {
                blocks: [
                  {
                    content: [{ text: "Inside table", type: "text" }],
                    id: "cell_text",
                    kind: "primitive",
                    type: "text",
                  },
                ],
                columnId: "column_1",
                id: "cell_1",
                rowId: "row_1",
              },
            ],
            columns: [{ id: "column_1", label: "Column" }],
            id: "table_1",
            kind: "complex",
            rows: [{ id: "row_1", label: "Row" }],
            showColumnNames: true,
            showRowNames: true,
            type: "table",
          },
        ]),
      ),
    ).toBe("Table question");
  });
});

function question(blocks: Question["body"]["blocks"]): Question {
  const timestamp = new Date("2026-06-14T00:00:00Z");
  return {
    blueprintId: "blueprint-1",
    body: {
      blocks,
      responseFields: [{ id: "answer", type: "text" }],
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
