import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createInitialQuestionGenerationRun,
  createQuestion,
  createQuestionBlueprintSnapshot,
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintVersionId,
  questionBody,
  questionGenerationRunId,
  questionId,
  questionProducer,
  questionSetId,
  questionSolution,
  questionSourceEvidence,
  questionSourcePlan,
  userId,
} from "../domain/index.js";
import { presentQuestion, presentQuestionGenerationRun } from "./presenters.js";

const ownerUserId = userId("019e9315-6a87-715f-9861-8654df075001");
const createdAt = new Date("2026-06-18T00:00:00.000Z");
const blueprintId = questionBlueprintId("019e9315-6a87-715f-9861-8654df075003");
const blueprintVersionId = questionBlueprintVersionId(
  "019e9315-6a87-715f-9861-8654df075005",
);

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

  it("exposes blueprintVersionId on generation runs", () => {
    const response = presentQuestionGenerationRun({
      questionGenerationRun: createInitialQuestionGenerationRun(
        {
          blueprintId,
          blueprintVersionId,
          blueprintSnapshot: createQuestionBlueprintSnapshot({
            blueprintId,
            blueprintVersionId,
            capturedAt: createdAt,
            description: questionBlueprintDescription(null),
            document: questionBlueprintDocument({
              blocks: [],
              references: [],
              responseFields: [],
              schemaVersion: 1,
            }),
            name: questionBlueprintName("Blueprint"),
            sources: [],
          }),
          createdByUserId: ownerUserId,
          id: questionGenerationRunId("019e9315-6a87-715f-9861-8654df075006"),
          ownerUserId,
          requestedCount: 1,
          targetQuestionSetId: questionSetId(
            "019e9315-6a87-715f-9861-8654df075007",
          ),
        },
        createdAt,
      ),
    });

    assert.equal(
      response.questionGenerationRun.blueprintVersionId,
      blueprintVersionId,
    );
  });
});
