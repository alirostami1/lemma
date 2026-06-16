import { describe, expect, it } from "vitest";
import type { Question } from "#/domains/questions";
import { questionToPresentableQuestion } from "./question-player-model";

describe("question player model", () => {
  it("adapts generated question bodies to presentable questions", () => {
    const presentable = questionToPresentableQuestion(question());

    expect(presentable.blocks).toEqual([
      {
        id: "prompt",
        type: "text",
        content: [{ type: "text", text: "Prompt" }],
      },
    ]);
    expect(presentable.responseFields).toEqual([]);
  });
});

function question(): Question {
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
      blocks: [
        {
          id: "prompt",
          type: "text",
          content: [{ type: "text", text: "Prompt" }],
        },
      ],
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
