import { describe, expect, it } from "vitest";
import type { Question } from "#/domains/questions";
import { questionToPresentableQuestion } from "./question-player-model";

describe("question player model", () => {
  it("adapts generated question bodies to presentable questions", () => {
    const presentable = questionToPresentableQuestion(question());

    expect(presentable.blocks).toEqual([
      {
        content: [{ text: "Prompt", type: "text" }],
        id: "prompt",
        type: "text",
      },
    ]);
    expect(presentable.responseFields).toEqual([]);
  });
});

function question(): Question {
  const timestamp = new Date("2026-06-14T00:00:00Z");
  return {
    blueprintId: "blueprint-1",
    body: {
      blocks: [
        {
          content: [{ text: "Prompt", type: "text" }],
          id: "prompt",
          type: "text",
        },
      ],
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
