import { describe, expect, it } from "vitest";
import type { Question } from "#/domains/questions";
import type { ComposedEditorBlock } from "#/domains/questions/authoring";
import {
  editorBlockToPresentableQuestion,
  questionToPresentableQuestion,
} from "./question-player-model";

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

  it("adapts generated rich text heading values without reference syntax", () => {
    const presentable = questionToPresentableQuestion(
      generatedRichHeadingQuestion(),
    );

    expect(presentable.blocks).toEqual([
      {
        content: {
          content: [
            {
              content: [{ text: "Revenue 1200", type: "text" }],
              level: 1,
              type: "heading",
            },
            {
              content: [{ text: "Margin 0.32", type: "text" }],
              level: 2,
              type: "heading",
            },
          ],
          type: "doc",
        },
        id: "rich",
        type: "rich_text",
      },
    ]);
    expect(JSON.stringify(presentable)).not.toContain("{{");
    expect(JSON.stringify(presentable)).not.toContain("revenue");
    expect(JSON.stringify(presentable)).not.toContain("margin");
    expect(JSON.stringify(presentable)).not.toContain("reference_1");
  });

  it("adapts generated input bodies as materialized input state", () => {
    const presentable = questionToPresentableQuestion(
      generatedSelectQuestion(),
    );

    expect(presentable.blocks[0]).toEqual({
      id: "choice",
      inputState: {
        input: {
          options: [{ label: "Alpha", value: "a" }],
          type: "select",
          validation: { required: true },
        },
        status: "materialized",
      },
      label: undefined,
      placeholder: undefined,
      responseFieldId: "choice",
      type: "response",
    });
  });

  it("adapts editor source-backed select options as unresolved preview state", () => {
    const block: ComposedEditorBlock = {
      correctValueSource: { type: "literal", value: "a" },
      grading: { mode: "exact" },
      id: "choice",
      input: {
        optionsSource: { referenceId: "choice_options", type: "reference" },
        type: "select",
        validation: { required: true },
      },
      points: 1,
      responseFieldId: "choice",
      type: "response",
    };

    expect(editorBlockToPresentableQuestion(block).blocks[0]).toMatchObject({
      inputState: {
        message: "Options are not available in this preview.",
        status: "unresolved_options",
      },
    });
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
          kind: "primitive",
          type: "text",
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

function generatedRichHeadingQuestion(): Question {
  const base = question();
  return {
    ...base,
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
  };
}

function generatedSelectQuestion(): Question {
  const base = question();
  return {
    ...base,
    body: {
      blocks: [
        {
          id: "choice",
          input: {
            options: [{ label: "Alpha", value: "a" }],
            schemaVersion: 1,
            type: "select",
            validation: { required: true },
          },
          kind: "primitive",
          responseFieldId: "choice",
          type: "input",
        },
      ],
      responseFields: [{ id: "choice", label: "Choice", type: "select" }],
      schemaVersion: 2,
    },
  };
}
