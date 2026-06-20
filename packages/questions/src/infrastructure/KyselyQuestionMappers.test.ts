import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InvalidQuestionBlueprintDocumentError } from "../domain/errors.js";
import { mapQuestionBlueprintVersionRowToDomain } from "./KyselyQuestionMappers.js";

type QuestionBlueprintVersionRow =
  Parameters<typeof mapQuestionBlueprintVersionRowToDomain>[0];

describe("KyselyQuestionMappers", () => {
  it("normalizes legacy missing sourceId to source_1 using legacy workbookId", () => {
    const versionRow = createLegacyVersionRow({
      workbookId: legacyWorkbookId,
      workbookSources: null,
      document: legacyBlueprintDocumentWithoutSourceId(),
    });

    const version = mapQuestionBlueprintVersionRowToDomain(versionRow);

    assert.equal(version.document.references[0]?.source.type, "workbook_cell");
    assert.equal(
      version.document.references[0]?.source.sourceId,
      "source_1",
    );
    assert.deepEqual(version.workbookSources, [
      {
        sourceId: "source_1",
        name: "Source 1",
        workbookId: legacyWorkbookId,
      },
    ]);
  });

  it("rejects missing sourceId when workbook source metadata is explicitly provided", () => {
    const versionRow = createLegacyVersionRow({
      workbookId: legacyWorkbookId,
      workbookSources: [
        {
          sourceId: "source_2",
          name: "Source 2",
          workbookId: legacyWorkbookId,
        },
      ],
      document: legacyBlueprintDocumentWithoutSourceId(),
    });

    assert.throws(
      () => mapQuestionBlueprintVersionRowToDomain(versionRow),
      (error: unknown) => {
        return (
          error instanceof InvalidQuestionBlueprintDocumentError &&
          /sourceId must be a non-empty string/.test(error.message)
        );
      },
      "Expected strict path to reject missing workbook reference sourceId",
    );
  });
});

const legacyBlueprintId = "019e9315-6a87-715f-9861-8654df074010";
const legacyVersionId = "019e9315-6a87-715f-9861-8654df074011";
const legacyBlueprintOwnerId = "019e9315-6a87-715f-9861-8654df074012";
const legacyWorkbookId = "019e9315-6a87-715f-9861-8654df074013";
const legacyVersionCreatedAt = new Date("2026-06-18T00:00:00.000Z");

function createLegacyVersionRow(overrides: {
  workbookId: string | null;
  workbookSources: QuestionBlueprintVersionRow["workbookSources"];
  document: QuestionBlueprintVersionRow["document"];
}): QuestionBlueprintVersionRow {
  return {
    id: legacyVersionId,
    questionBlueprintId: legacyBlueprintId,
    versionNumber: 1,
    document: overrides.document,
    workbookId: overrides.workbookId,
    workbookSources: overrides.workbookSources,
    createdByUserId: legacyBlueprintOwnerId,
    createdAt: legacyVersionCreatedAt,
  };
}

function legacyBlueprintDocumentWithoutSourceId() {
  return {
    schemaVersion: 1,
    responseFields: [],
    blocks: [],
    references: [
      {
        id: "revenue",
        source: {
          schemaVersion: 1,
          type: "workbook_cell",
          ref: "Sheet1!A1",
        },
      },
    ],
  };
}
