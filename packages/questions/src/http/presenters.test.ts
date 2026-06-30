import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createInitialQuestionGenerationRun,
  createQuestion,
  createQuestionBlueprint,
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
import {
  presentQuestion,
  presentQuestionBlueprint,
  presentQuestionGenerationRun,
} from "./presenters.js";

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
            schemaVersion: 2,
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
              schemaVersion: 2,
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

  it("strips private input fields from public blueprint presentation recursively", () => {
    const response = presentQuestionBlueprint({
      questionBlueprint: createQuestionBlueprint(
        {
          createdByUserId: ownerUserId,
          currentVersionId: blueprintVersionId,
          description: questionBlueprintDescription(null),
          document: questionBlueprintDocument({
            blocks: [
              privateInputBlock("top_level_input", "top_answer"),
              {
                blocks: [privateInputBlock("container_input", "nested_answer")],
                id: "step_1",
                kind: "container",
                title: "Step one",
                type: "step",
              },
              {
                cells: [
                  {
                    blocks: [privateInputBlock("table_input", "table_answer")],
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
            ],
            references: [],
            responseFields: [
              { id: "top_answer", type: "text" },
              { id: "nested_answer", type: "text" },
              { id: "table_answer", type: "text" },
            ],
            schemaVersion: 2,
          }),
          id: blueprintId,
          name: questionBlueprintName("Blueprint"),
          ownerUserId,
          sources: [],
          visibility: "private",
        },
        createdAt,
      ),
    });

    const publicOutput = JSON.stringify(response.questionBlueprint.document);

    assert.equal(publicOutput.includes("correctValueSource"), false);
    assert.equal(publicOutput.includes("grading"), false);
    assert.equal(publicOutput.includes("points"), false);
    assert.equal(publicOutput.includes("top_level_input"), true);
    assert.equal(publicOutput.includes("container_input"), true);
    assert.equal(publicOutput.includes("table_input"), true);
  });
});

function privateInputBlock(id: string, responseFieldId: string) {
  return {
    correctValueSource: { schemaVersion: 1, type: "literal", value: "42" },
    grading: { mode: "exact" },
    id,
    kind: "primitive" as const,
    label: "Answer",
    points: 1,
    responseFieldId,
    type: "input" as const,
  };
}
