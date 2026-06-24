import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapQuestionBlueprintRowToDomain,
  mapQuestionBlueprintToInsert,
  mapQuestionBlueprintToUpdate,
  mapQuestionGenerationRunRowToDomain,
  mapQuestionGenerationRunToInsert,
  mapQuestionRowToDomain,
  mapQuestionToInsert,
} from "./KyselyQuestionMappers.js";

const id = "019e9315-6a87-715f-9861-8654df074010";
const userId = "019e9315-6a87-715f-9861-8654df074011";
const workbookId = "019e9315-6a87-715f-9861-8654df074012";
const calculationId = "019e9315-6a87-715f-9861-8654df074013";
const snapshotId = "019e9315-6a87-715f-9861-8654df074014";
const questionSetId = "019e9315-6a87-715f-9861-8654df074015";
const versionId = "019e9315-6a87-715f-9861-8654df074016";
const createdAt = new Date("2026-06-18T00:00:00.000Z");

describe("KyselyQuestionMappers", () => {
  it("maps blueprint rows with document and sources on the blueprint", () => {
    const blueprint = mapQuestionBlueprintRowToDomain(blueprintRow());
    const insertSources = mapQuestionBlueprintToInsert(blueprint).sources;
    const updateSources = mapQuestionBlueprintToUpdate(blueprint).sources;

    assert.equal(blueprint.document.schemaVersion, 1);
    assert.equal(blueprint.sources[0]?.sourceId, "source_1");
    assert.equal(typeof insertSources, "object");
    assert.equal(
      typeof (insertSources as { toOperationNode?: unknown }).toOperationNode,
      "function",
    );
    assert.equal(typeof updateSources, "object");
    assert.equal(
      typeof (updateSources as { toOperationNode?: unknown }).toOperationNode,
      "function",
    );
  });

  it("maps empty blueprint sources as a jsonb expression", () => {
    const blueprint = mapQuestionBlueprintRowToDomain(emptyBlueprintRow());
    const insertSources = mapQuestionBlueprintToInsert(blueprint).sources;
    const updateSources = mapQuestionBlueprintToUpdate(blueprint).sources;

    assert.deepEqual(blueprint.sources, []);
    assert.equal(
      typeof (insertSources as { toOperationNode?: unknown }).toOperationNode,
      "function",
    );
    assert.equal(
      typeof (updateSources as { toOperationNode?: unknown }).toOperationNode,
      "function",
    );
  });

  it("maps generation run rows with blueprintSnapshot and workbookCalculationId", () => {
    const run = mapQuestionGenerationRunRowToDomain(generationRunRow());

    assert.equal(run.blueprintSnapshot.blueprintId, id);
    assert.equal(run.workbookCalculationId, calculationId);
    assert.equal(
      mapQuestionGenerationRunToInsert(run).workbookCalculationId,
      calculationId,
    );
  });

  it("maps question rows with durable source evidence and private source plan", () => {
    const question = mapQuestionRowToDomain(questionRow());

    assert.equal(question.sourceEvidence.sources[0]?.sourceId, "source_1");
    assert.equal(
      mapQuestionToInsert(question).sourceEvidence,
      question.sourceEvidence,
    );
    assert.deepEqual(
      mapQuestionToInsert(question).sourcePlan,
      question.sourcePlan,
    );
  });

  it("rejects persisted questions missing source evidence or source plan", () => {
    assert.throws(
      () => mapQuestionRowToDomain(withInvalidQuestionRow("sourceEvidence")),
      /source evidence must be an object/,
    );
    assert.throws(
      () => mapQuestionRowToDomain(withInvalidQuestionRow("sourcePlan")),
      /source plan must be an object/,
    );
  });
});

function blueprintRow(): Parameters<typeof mapQuestionBlueprintRowToDomain>[0] {
  return {
    archivedAt: null,
    createdAt,
    createdByUserId: userId,
    currentVersionId: versionId,
    description: null,
    document: document(),
    id,
    name: "Blueprint",
    ownerUserId: userId,
    sources: [source()],
    status: "active",
    updatedAt: createdAt,
    visibility: "private",
  };
}

function emptyBlueprintRow(): Parameters<
  typeof mapQuestionBlueprintRowToDomain
>[0] {
  return {
    archivedAt: null,
    createdAt,
    createdByUserId: userId,
    currentVersionId: versionId,
    description: null,
    document: {
      blocks: [],
      references: [],
      responseFields: [],
      schemaVersion: 1,
    },
    id,
    name: "Blueprint",
    ownerUserId: userId,
    sources: [],
    status: "active",
    updatedAt: createdAt,
    visibility: "private",
  };
}

function generationRunRow(): Parameters<
  typeof mapQuestionGenerationRunRowToDomain
>[0] {
  return {
    attemptNumber: 1,
    attempts: 0,
    blueprintId: id,
    blueprintSnapshot: {
      blueprintId: id,
      capturedAt: createdAt.toISOString(),
      description: null,
      document: document(),
      documentHash: "hash",
      name: "Blueprint",
      schemaVersion: 1,
      sources: [source()],
    },
    createdAt,
    createdByUserId: userId,
    errorMessage: null,
    finishedAt: null,
    id,
    ownerUserId: userId,
    requestedCount: 1,
    result: null,
    retryOfRunId: null,
    startedAt: null,
    status: "queued",
    targetQuestionSetId: questionSetId,
    updatedAt: createdAt,
    workbookCalculationId: calculationId,
  };
}

function questionRow(): Parameters<typeof mapQuestionRowToDomain>[0] {
  return {
    blueprintId: id,
    body: {
      blocks: [],
      responseFields: [],
      schemaVersion: 1,
    },
    createdAt,
    createdByUserId: userId,
    generationRunId: id,
    id,
    ownerUserId: userId,
    producer: { compiler: "test", schemaVersion: 1 },
    solution: { rules: [], schemaVersion: 1 },
    sourceEvidence: evidence(),
    sourcePlan: {
      references: [
        {
          ref: "Sheet1!A1",
          referenceId: "revenue",
          sourceId: "source_1",
          value: 1200,
          workbookSnapshotId: snapshotId,
        },
      ],
      schemaVersion: 1,
    },
    status: "active",
    updatedAt: createdAt,
  } as Parameters<typeof mapQuestionRowToDomain>[0];
}

function withInvalidQuestionRow(
  field: "sourceEvidence" | "sourcePlan",
): Parameters<typeof mapQuestionRowToDomain>[0] {
  const row = questionRow();
  return {
    ...row,
    sourceEvidence:
      field === "sourceEvidence" ? (undefined as unknown) : row.sourceEvidence,
    sourcePlan:
      field === "sourcePlan" ? (undefined as unknown) : row.sourcePlan,
  } as Parameters<typeof mapQuestionRowToDomain>[0];
}

function document() {
  return {
    blocks: [],
    references: [
      {
        id: "workbook:source_1:cell:Sheet1:A1",
        source: {
          ref: "Sheet1!A1",
          schemaVersion: 1,
          sourceId: "source_1",
          type: "workbook_cell",
        },
      },
    ],
    responseFields: [],
    schemaVersion: 1,
  };
}

function source() {
  return {
    name: "Source 1",
    sourceId: "source_1",
    type: "workbook" as const,
    workbookId,
  };
}

function evidence() {
  return {
    schemaVersion: 1,
    sources: [
      {
        questionIndex: 0,
        references: ["workbook:source_1:cell:Sheet1:A1"],
        snapshotIndex: 0,
        sourceId: "source_1",
        sourceName: "Source 1",
        workbookCalculationId: calculationId,
        workbookId,
        workbookSnapshotId: snapshotId,
      },
    ],
  };
}
