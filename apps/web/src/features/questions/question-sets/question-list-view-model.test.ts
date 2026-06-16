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
          id: "prompt",
          type: "text",
          content: [{ type: "text", text: "What is 2 + 2?" }],
        },
      ]),
    ]);

    expect(items[0]).toEqual({
      id: "question-1",
      title: "Question 1",
      description: "What is 2 + 2?",
      metadata: "Generated Jun 14, 2026, 12:00 AM UTC",
    });
  });

  it("falls back when no block provides summary text", () => {
    expect(getQuestionSummary(question([]))).toBe("Untitled question");
  });
});

function question(blocks: Question["body"]["blocks"]): Question {
  const timestamp = new Date("2026-06-14T00:00:00Z");
  return {
    id: "question-1",
    ownerUserId: "owner",
    createdByUserId: "creator",
    blueprintId: "blueprint-1",
    blueprintVersionId: "version-1",
    generationRunId: "run-1",
    body: {
      schemaVersion: 1,
      blocks,
      responseFields: [],
    },
    producer: {
      schemaVersion: 1,
      compiler: "test",
    },
    source: null,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
