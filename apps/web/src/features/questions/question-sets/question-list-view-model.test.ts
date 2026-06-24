import { describe, expect, it } from "vitest";
import type { Question } from "#/domains/questions";
import {
  buildQuestionListViewModel,
  getQuestionSummary,
} from "./question-list-view-model";

describe("question list view model", () => {
  it("builds compact question rows from question content", () => {
    const items = buildQuestionListViewModel([
      question([
        {
          content: [{ text: "What is 2 + 2?", type: "text" }],
          id: "prompt",
          type: "text",
        },
      ]),
    ]);

    expect(items[0]).toEqual({
      description: "What is 2 + 2?",
      id: "question-1",
      metadata: "Generated Jun 14, 2026, 12:00 AM UTC",
      title: "Question 1",
    });
  });

  it("falls back when no block provides summary text", () => {
    expect(getQuestionSummary(question([]))).toBe("Untitled question");
  });
});

function question(blocks: Question["body"]["blocks"]): Question {
  const timestamp = new Date("2026-06-14T00:00:00Z");
  return {
    blueprintId: "blueprint-1",
    body: {
      blocks,
      responseFields: [],
      schemaVersion: 1,
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
