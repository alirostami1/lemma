import { describe, expect, it, vi } from "vitest";
import type { Question } from "#/domains/questions";
import { getQuestionSummaryText } from "#/domains/questions";
import { buildQuestionListViewModel } from "./question-list-view-model";

vi.mock("#/domains/questions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#/domains/questions")>();
  return {
    ...actual,
    getQuestionSummaryText: vi.fn(() => "Domain summary"),
  };
});

describe("question list view model", () => {
  it("builds compact question rows from the domain summary", () => {
    const items = buildQuestionListViewModel([
      question([
        {
          content: [{ text: "What is 2 + 2?", type: "text" }],
          id: "prompt",
          kind: "primitive",
          type: "text",
        },
      ]),
    ]);

    expect(items[0]).toEqual({
      description: "Domain summary",
      id: "question-1",
      metadata: "Generated Jun 14, 2026, 12:00 AM UTC",
      title: "Question 1",
    });
    expect(getQuestionSummaryText).toHaveBeenCalledOnce();
  });
});

function question(blocks: Question["body"]["blocks"]): Question {
  const timestamp = new Date("2026-06-14T00:00:00Z");
  return {
    blueprintId: "blueprint-1",
    body: {
      blocks,
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
