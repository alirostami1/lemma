import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type QuestionInputPrimitive,
  reconstituteQuestion,
} from "../domain/index.js";
import { QuestionGradingService } from "./QuestionGradingService.js";

describe("QuestionGradingService", () => {
  it("uses an input default only when the answer is missing", async () => {
    const result = await grade({
      answer: { responses: [], schemaVersion: 1 },
      correctValue: "fallback",
      input: {
        defaultValue: "fallback",
        schemaVersion: 1,
        type: "text",
        validation: { required: true },
      },
    });

    assert.equal(result.earnedPoints, 1);
    assert.equal(result.details[0]?.userAnswer, "fallback");
  });

  it("does not use an input default for explicit null or empty string", async () => {
    const nullResult = await grade({
      answer: {
        responses: [{ responseFieldId: "answer", value: null }],
        schemaVersion: 1,
      },
      correctValue: "fallback",
      input: {
        defaultValue: "fallback",
        schemaVersion: 1,
        type: "text",
        validation: { required: true },
      },
    });
    const emptyStringResult = await grade({
      answer: {
        responses: [{ responseFieldId: "answer", value: "" }],
        schemaVersion: 1,
      },
      correctValue: "fallback",
      input: {
        defaultValue: "fallback",
        schemaVersion: 1,
        type: "text",
        validation: { required: true },
      },
    });

    assert.equal(nullResult.earnedPoints, 0);
    assert.equal(nullResult.details[0]?.userAnswer, null);
    assert.equal(nullResult.details[0]?.feedback, "Enter an answer.");
    assert.equal(emptyStringResult.earnedPoints, 0);
    assert.equal(emptyStringResult.details[0]?.userAnswer, "");
    assert.equal(emptyStringResult.details[0]?.feedback, "Enter an answer.");
  });

  it("does not use an input default for explicit false or zero", async () => {
    const falseResult = await grade({
      answer: {
        responses: [{ responseFieldId: "answer", value: false }],
        schemaVersion: 1,
      },
      correctValue: "fallback",
      input: {
        defaultValue: "fallback",
        schemaVersion: 1,
        type: "text",
      },
    });
    const zeroResult = await grade({
      answer: {
        responses: [{ responseFieldId: "answer", value: 0 }],
        schemaVersion: 1,
      },
      correctValue: 4,
      input: {
        defaultValue: 4,
        schemaVersion: 1,
        type: "number",
      },
    });

    assert.equal(falseResult.earnedPoints, 0);
    assert.equal(falseResult.details[0]?.userAnswer, false);
    assert.equal(falseResult.details[0]?.feedback, "Enter text.");
    assert.equal(zeroResult.earnedPoints, 0);
    assert.equal(zeroResult.details[0]?.userAnswer, 0);
  });
});

async function grade(input: {
  input: QuestionInputPrimitive;
  correctValue: string | number;
  answer: {
    schemaVersion: 1;
    responses: Array<{
      responseFieldId: string;
      value: string | number | boolean | null;
    }>;
  };
}) {
  const question = reconstituteQuestion({
    blueprintId: "019e8278-6746-768e-b90b-3c6d2fb8267f",
    body: {
      blocks: [
        {
          id: "answer_block",
          input: input.input,
          kind: "primitive",
          responseFieldId: "answer",
          type: "input",
        },
      ],
      responseFields: [
        {
          id: "answer",
          type: input.input.type,
          ...(input.input.validation?.required === undefined
            ? {}
            : { required: input.input.validation.required }),
        },
      ],
      schemaVersion: 2,
    },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    createdByUserId: "019e8278-6746-768e-b90b-3c6d2fb8270f",
    generationRunId: "019e8278-6746-768e-b90b-3c6d2fb8271f",
    id: "019e8278-6746-768e-b90b-3c6d2fb8272f",
    ownerUserId: "019e8278-6746-768e-b90b-3c6d2fb8273f",
    producer: { compiler: "test", schemaVersion: 1 },
    solution: {
      rules: [
        {
          correctValue: input.correctValue,
          points: 1,
          responseFieldId: "answer",
          type: "exact",
        },
      ],
      schemaVersion: 1,
    },
    sourceEvidence: { schemaVersion: 1, sources: [] },
    sourcePlan: { references: [], schemaVersion: 1 },
    status: "active",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  return new QuestionGradingService().grade({ answer: input.answer, question });
}
