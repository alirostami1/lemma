import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createQuestionBlueprintVersion,
  questionBlueprintDocument,
  questionBlueprintId,
  questionBlueprintVersionId,
  userId as toUserId,
  workbookId as toWorkbookId,
  type WorkbookId,
  workbookQuestionSource,
} from "../domain/index.js";
import { InvalidQuestionBlueprintError } from "./errors.js";
import type { WorkbookAccessPort } from "./ports.js";
import { QuestionGenerationSourceResolver } from "./QuestionGenerationSourceResolver.js";

const workbookIdInput = "019e9315-6a87-715f-9861-8654df070c51";
const workbookId = toWorkbookId(workbookIdInput);
const otherWorkbookIdInput = "019e9315-6a87-715f-9861-8654df070c52";
const createdByUserId = toUserId("019e9315-6a87-715f-9861-8654df070c50");

describe("QuestionGenerationSourceResolver", () => {
  it("derives a workbook source from the selected blueprint version", () => {
    const resolver = createResolver();
    const version = createVersion({ workbookId });

    const source = resolver.resolve({ version, explicitSource: null });

    assert.equal(source?.workbookId, workbookId);
    assert.equal(source?.workbookSnapshotId, null);
    assert.equal(source?.workbookCalculationId, null);
  });

  it("rejects an explicit workbook source that differs from the version workbook", () => {
    const resolver = createResolver();
    const version = createVersion({ workbookId });
    const explicitSource = workbookQuestionSource({
      type: "workbook_snapshot",
      workbookId: otherWorkbookIdInput,
    });

    assert.throws(
      () =>
        resolver.assertExplicitSourceIsAllowed({
          version,
          explicitSource,
        }),
      InvalidQuestionBlueprintError,
    );
  });

  it("requires a source when the blueprint document references workbook data", () => {
    const resolver = createResolver();
    const version = createVersion({ workbookId: null });

    assert.throws(
      () => resolver.assertRequiredSourcePresent({ version, source: null }),
      InvalidQuestionBlueprintError,
    );
  });
});

function createResolver() {
  return new QuestionGenerationSourceResolver({
    workbookAccessPort: {
      async canUserAccessWorkbook() {
        return true;
      },
    } satisfies WorkbookAccessPort,
  });
}

function createVersion(input: { workbookId: WorkbookId | null }) {
  return createQuestionBlueprintVersion(
    {
      id: questionBlueprintVersionId("019e9315-6a87-715f-9861-8654df070c5a"),
      questionBlueprintId: questionBlueprintId(
        "019e9315-6a87-715f-9861-8654df070c59",
      ),
      versionNumber: 1,
      document: questionBlueprintDocument({
        schemaVersion: 1,
        references: [
          {
            id: "revenue",
            source: {
              schemaVersion: 1,
              type: "workbook_cell",
              sourceId: "source_1",
              ref: "Sheet1!A1",
            },
          },
        ],
        responseFields: [{ id: "answer", type: "number" }],
        blocks: [
          {
            id: "prompt",
            type: "text",
            content: [{ type: "reference", referenceId: "revenue" }],
          },
        ],
      }),
      workbookId: input.workbookId,
      createdByUserId,
    },
    new Date("2026-01-01T00:00:00.000Z"),
  );
}
