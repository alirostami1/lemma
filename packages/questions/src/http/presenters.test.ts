import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createQuestion,
  questionBlueprintId,
  questionBody,
  questionGenerationRunId,
  questionId,
  questionProducer,
  questionSolution,
  questionSourceEvidence,
  questionSourcePlan,
  userId,
} from "../domain/index.js";
import { presentQuestion } from "./presenters.js";

const ownerUserId = userId("019e9315-6a87-715f-9861-8654df075001");
const createdAt = new Date("2026-06-18T00:00:00.000Z");

describe("question presenters", () => {
  it("does not expose private solution, source plan, or source evidence", () => {
    const response = presentQuestion({
      question: createQuestion(
        {
          blueprintId: questionBlueprintId(
            "019e9315-6a87-715f-9861-8654df075003",
          ),
          body: questionBody({
            blocks: [],
            responseFields: [],
            schemaVersion: 1,
          }),
          createdByUserId: ownerUserId,
          generationRunId: questionGenerationRunId(
            "019e9315-6a87-715f-9861-8654df075004",
          ),
          id: questionId("019e9315-6a87-715f-9861-8654df075002"),
          ownerUserId,
          producer: questionProducer({
            compiler: "test",
            schemaVersion: 1,
          }),
          solution: questionSolution({ rules: [], schemaVersion: 1 }),
          sourceEvidence: questionSourceEvidence({
            schemaVersion: 1,
            sources: [],
          }),
          sourcePlan: questionSourcePlan({
            references: [],
            schemaVersion: 1,
          }),
        },
        createdAt,
      ),
    });

    assert.equal("solution" in response.question, false);
    assert.equal("sourcePlan" in response.question, false);
    assert.equal("sourceEvidence" in response.question, false);
  });
});
