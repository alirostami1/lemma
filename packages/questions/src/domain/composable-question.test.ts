import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createQuestionBlueprint,
  nextUntitledQuestionBlueprintName,
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintVersionId,
  questionBlueprintVisibility,
  questionSourceEvidence,
  reconstituteQuestionBlueprint,
  userId,
  workbookId,
} from "./index.js";

const ownerUserId = userId("019e9315-6a87-715f-9861-8654df070c01");
const evidenceWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df070c02");
const createdAt = new Date("2026-01-01T00:00:00.000Z");

describe("composable question canonical model", () => {
  it("creating a blueprint requires a document and sources array", () => {
    const blueprint = createQuestionBlueprint(
      {
        createdByUserId: ownerUserId,
        currentVersionId: questionBlueprintVersionId(
          "019e9315-6a87-715f-9861-8654df070c07",
        ),
        description: questionBlueprintDescription(null),
        document: emptyDocument(),
        id: questionBlueprintId("019e9315-6a87-715f-9861-8654df070c03"),
        name: questionBlueprintName("Revenue"),
        ownerUserId,
        sources: [],
        visibility: questionBlueprintVisibility("private"),
      },
      createdAt,
    );

    assert.deepEqual(blueprint.document, emptyDocument());
    assert.deepEqual(blueprint.sources, []);
  });

  it("persisted null or missing document fails fast", () => {
    assert.throws(
      () => reconstituteQuestionBlueprint(storedBlueprint({ document: null })),
      /question blueprint document must be an object/,
    );
    assert.throws(
      () =>
        reconstituteQuestionBlueprint(storedBlueprint({ document: undefined })),
      /question blueprint document must be an object/,
    );
  });

  it("persisted null or missing sources fails fast", () => {
    assert.throws(
      () => reconstituteQuestionBlueprint(storedBlueprint({ sources: null })),
      /question blueprint sources must be an array/,
    );
    assert.throws(
      () =>
        reconstituteQuestionBlueprint(storedBlueprint({ sources: undefined })),
      /question blueprint sources must be an array/,
    );
  });

  it("rejects duplicate source ids", () => {
    assert.throws(
      () =>
        createQuestionBlueprint(
          {
            ...blueprintInput(),
            sources: [workbookSource("source_1"), workbookSource("source_1")],
          },
          createdAt,
        ),
      /question blueprint source ids must be unique/,
    );
  });

  it("rejects workbook references that use an unknown source id", () => {
    assert.throws(
      () =>
        createQuestionBlueprint(
          {
            ...blueprintInput(),
            document: documentWithWorkbookReference("missing_source"),
            sources: [workbookSource("source_1")],
          },
          createdAt,
        ),
      /unknown question blueprint source id/,
    );
  });

  it("allows unused attached sources", () => {
    const blueprint = createQuestionBlueprint(
      {
        ...blueprintInput(),
        document: emptyDocument(),
        sources: [workbookSource("source_1")],
      },
      createdAt,
    );

    assert.equal(blueprint.sources[0]?.sourceId, "source_1");
  });

  it("generates next default blueprint name", () => {
    assert.equal(nextUntitledQuestionBlueprintName([]), "Untitled blueprint");
    assert.equal(
      nextUntitledQuestionBlueprintName([
        "Untitled blueprint",
        "Untitled blueprint 2",
      ]),
      "Untitled blueprint 3",
    );
  });

  it("source evidence accepts only schemaVersion plus sources", () => {
    const evidence = questionSourceEvidence({
      schemaVersion: 1,
      sources: [
        {
          questionIndex: 0,
          references: ["workbook:source_1:cell:Sheet1:A1"],
          snapshotIndex: 0,
          sourceId: "source_1",
          sourceName: "Source 1",
          workbookCalculationId: "019e9315-6a87-715f-9861-8654df070c04",
          workbookId: evidenceWorkbookId,
          workbookSnapshotId: "019e9315-6a87-715f-9861-8654df070c05",
        },
      ],
    });

    assert.deepEqual(evidence.sources[0]?.references, [
      "workbook:source_1:cell:Sheet1:A1",
    ]);
    assert.throws(
      () => questionSourceEvidence({ references: [], schemaVersion: 1 }),
      /sources must be an array/,
    );
  });

  it("source evidence rejects raw resolved values", () => {
    assert.throws(
      () =>
        questionSourceEvidence({
          schemaVersion: 1,
          sources: [
            {
              questionIndex: 0,
              references: ["workbook:source_1:cell:Sheet1:A1"],
              resolvedValue: 1200,
              snapshotIndex: 0,
              sourceId: "source_1",
              sourceName: "Source 1",
              workbookCalculationId: "019e9315-6a87-715f-9861-8654df070c04",
              workbookId: evidenceWorkbookId,
              workbookSnapshotId: "019e9315-6a87-715f-9861-8654df070c05",
            },
          ],
        }),
      /resolvedValue is not allowed/,
    );
  });
});

function blueprintInput() {
  return {
    createdByUserId: ownerUserId,
    currentVersionId: questionBlueprintVersionId(
      "019e9315-6a87-715f-9861-8654df070c07",
    ),
    description: questionBlueprintDescription(null),
    document: emptyDocument(),
    id: questionBlueprintId("019e9315-6a87-715f-9861-8654df070c03"),
    name: questionBlueprintName("Revenue"),
    ownerUserId,
    sources: [],
    visibility: questionBlueprintVisibility("private"),
  };
}

function storedBlueprint(overrides: { document?: unknown; sources?: unknown }) {
  return {
    ...blueprintInput(),
    archivedAt: null,
    createdAt,
    currentVersionId: questionBlueprintVersionId(
      "019e9315-6a87-715f-9861-8654df070c07",
    ),
    document: emptyDocument(),
    sources: [],
    status: "active",
    updatedAt: createdAt,
    ...overrides,
  };
}

function emptyDocument() {
  return questionBlueprintDocument({
    blocks: [],
    references: [],
    responseFields: [],
    schemaVersion: 1,
  });
}

function documentWithWorkbookReference(sourceId: string) {
  return questionBlueprintDocument({
    blocks: [],
    references: [
      {
        id: `workbook:${sourceId}:cell:Sheet1:A1`,
        source: {
          ref: "Sheet1!A1",
          schemaVersion: 1,
          sourceId,
          type: "workbook_cell",
        },
      },
    ],
    responseFields: [],
    schemaVersion: 1,
  });
}

function workbookSource(sourceId: string) {
  return {
    name: "Source 1",
    sourceId,
    type: "workbook" as const,
    workbookId: evidenceWorkbookId,
  };
}
