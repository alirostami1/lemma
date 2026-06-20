import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  InvalidQuestionBlueprintDocumentError,
  InvalidQuestionFieldError,
} from "../domain/errors.js";
import {
  mapQuestionBlueprintVersionRowToDomain,
  mapQuestionRowToDomain,
} from "./KyselyQuestionMappers.js";

type QuestionBlueprintVersionRow = Parameters<
  typeof mapQuestionBlueprintVersionRowToDomain
>[0];

describe("KyselyQuestionMappers", () => {
  it("normalizes legacy rows with null sources", () => {
    const versionRow = createLegacyVersionRow({
      sources: null,
      document: legacyBlueprintDocumentWithSourceId("source_2"),
    });

    assert.deepEqual(mapQuestionBlueprintVersionRowToDomain(versionRow).sources, []);
  });

  it("normalizes legacy rows missing sources", () => {
    const versionRow = createLegacyVersionRow({
      sources: undefined,
      document: legacyBlueprintDocumentWithSourceId("source_2"),
    });

    assert.deepEqual(mapQuestionBlueprintVersionRowToDomain(versionRow).sources, []);
  });

  it("rejects missing sourceId when workbook source metadata is explicitly provided", () => {
    const versionRow = createLegacyVersionRow({
      sources: [
        {
          type: "workbook",
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

  it("normalizes legacy question rows with empty workbook source ids", () => {
    const questionRow = {
      id: legacyVersionId,
      ownerUserId: legacyBlueprintOwnerId,
      createdByUserId: legacyBlueprintOwnerId,
      blueprintId: legacyBlueprintId,
      blueprintVersionId: legacyVersionId,
      generationRunId: legacyVersionId,
      body: {
        schemaVersion: 1,
        responseFields: [],
        blocks: [],
      },
      solution: { schemaVersion: 1, rules: [] },
      sourcePlan: {
        schemaVersion: 1,
        references: [
          {
            id: "revenue",
            source: {
              schemaVersion: 1,
              type: "workbook_cell",
              sourceId: "",
              ref: "Sheet1!A1",
            },
            resolved: true,
          },
        ],
      },
      producer: { schemaVersion: 1, compiler: "test" },
      source: null,
      status: "active",
      createdAt: legacyVersionCreatedAt,
      updatedAt: legacyVersionCreatedAt,
    } as Parameters<typeof mapQuestionRowToDomain>[0];

    assert.equal(
      mapQuestionRowToDomain(questionRow).sourcePlan.references[0]?.source.sourceId,
      "",
    );
  });
});

const legacyBlueprintId = "019e9315-6a87-715f-9861-8654df074010";
const legacyVersionId = "019e9315-6a87-715f-9861-8654df074011";
const legacyBlueprintOwnerId = "019e9315-6a87-715f-9861-8654df074012";
const legacyWorkbookId = "019e9315-6a87-715f-9861-8654df074013";
const legacyVersionCreatedAt = new Date("2026-06-18T00:00:00.000Z");

function createLegacyVersionRow(overrides: {
  sources: QuestionBlueprintVersionRow["sources"] | null | undefined;
  document: QuestionBlueprintVersionRow["document"];
}): QuestionBlueprintVersionRow {
  return {
    id: legacyVersionId,
    questionBlueprintId: legacyBlueprintId,
    versionNumber: 1,
    document: overrides.document,
    ...(overrides.sources === undefined
      ? {}
      : { sources: overrides.sources }),
    createdByUserId: legacyBlueprintOwnerId,
    createdAt: legacyVersionCreatedAt,
  } as QuestionBlueprintVersionRow;
}

function legacyBlueprintDocumentWithSourceId(sourceId: string) {
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
          sourceId,
          ref: "Sheet1!A1",
        },
      },
    ],
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
