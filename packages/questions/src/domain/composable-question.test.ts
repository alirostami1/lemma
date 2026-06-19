import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  presentQuestion,
  presentQuestionBlueprint,
  presentQuestionBlueprintAuthoring,
} from "../http/presenters.js";
import {
  createQuestion,
  createQuestionBlueprint,
  createQuestionBlueprintVersion,
  type QuestionBlueprint,
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintVersionId,
  questionBlueprintVisibility,
  questionBody,
  questionGenerationRunId,
  questionId,
  questionProducer,
  questionSolution,
  questionSourcePlan,
  userId,
} from "./index.js";

const literalReference = {
  id: "revenue",
  source: { schemaVersion: 1, type: "literal", value: "100" },
} as const;

const responseField = { id: "answer", type: "number", required: true } as const;
const responseBlock = {
  id: "answer-block",
  type: "response",
  responseFieldId: "answer",
  correctValueSource: { schemaVersion: 1, type: "literal", value: 100 },
  points: 1,
  grading: { mode: "number", tolerance: { type: "absolute", value: 0 } },
} as const;

describe("composable question canonical model", () => {
  it("accepts a text and response blueprint", () => {
    const blueprint = questionBlueprintDocument({
      schemaVersion: 1,
      references: [literalReference],
      responseFields: [responseField],
      blocks: [
        {
          id: "prompt",
          type: "text",
          content: [
            { type: "text", text: "Revenue is " },
            { type: "reference", referenceId: "revenue", fallbackText: "n/a" },
          ],
        },
        responseBlock,
      ],
    });

    assert.equal(blueprint.blocks.length, 2);
    assert.equal(blueprint.references[0]?.id, "revenue");
  });

  it("accepts literal, workbook cell, and workbook range references", () => {
    const blueprint = questionBlueprintDocument({
      schemaVersion: 1,
      references: [
        literalReference,
        {
          id: "cell",
          source: { schemaVersion: 1, type: "workbook_cell", ref: "Sheet1!A1" },
        },
        {
          id: "range",
          source: {
            schemaVersion: 1,
            type: "workbook_range",
            ref: "Sheet1!A1:B2",
          },
        },
      ],
      responseFields: [],
      blocks: [],
    });

    assert.deepEqual(
      blueprint.references.map((reference) => reference.source.type),
      ["literal", "workbook_cell", "workbook_range"],
    );
  });

  it("accepts rich text, table content, and table response cells", () => {
    const blueprint = questionBlueprintDocument({
      schemaVersion: 1,
      references: [literalReference],
      responseFields: [responseField],
      blocks: [
        {
          id: "instructions",
          type: "rich_text",
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Use the table." }],
              },
            ],
          },
        },
        {
          id: "table",
          type: "table",
          showColumnNames: true,
          showRowNames: true,
          columns: [
            { id: "c1", label: "Amount" },
            { id: "c2", label: "Answer" },
          ],
          rows: [{ id: "r1", label: "Revenue" }],
          cells: [
            {
              id: "cell-1",
              rowId: "r1",
              columnId: "c1",
              type: "content",
              content: [{ type: "reference", referenceId: "revenue" }],
            },
            {
              ...responseBlock,
              id: "cell-2",
              rowId: "r1",
              columnId: "c2",
            },
          ],
        },
      ],
    });

    assert.equal(blueprint.blocks[1]?.type, "table");
  });

  it("accepts a direct composed question body", () => {
    const body = questionBody({
      schemaVersion: 1,
      responseFields: [responseField],
      blocks: [
        {
          id: "prompt",
          type: "text",
          content: [{ type: "text", text: "Enter revenue." }],
        },
        {
          id: "answer-block",
          type: "response",
          responseFieldId: "answer",
          points: 1,
          grading: { mode: "exact" },
        },
      ],
    });

    assert.equal(body.blocks.length, 2);
  });

  it("rejects json response field types", () => {
    assert.throws(
      () =>
        questionBlueprintDocument({
          schemaVersion: 1,
          references: [],
          responseFields: [{ id: "answer", type: "json" }],
          blocks: [],
        }),
      /response field type must be one of text, number, boolean/,
    );
    assert.throws(
      () =>
        questionBody({
          schemaVersion: 1,
          responseFields: [{ id: "answer", type: "json" }],
          blocks: [],
        }),
      /response field type must be one of text, number, boolean/,
    );
  });

  it("rejects duplicate and unknown references", () => {
    assert.throws(
      () =>
        questionBlueprintDocument({
          schemaVersion: 1,
          references: [literalReference, literalReference],
          responseFields: [responseField],
          blocks: [responseBlock],
        }),
      /references ids must be unique/,
    );
    assert.throws(
      () =>
        questionBlueprintDocument({
          schemaVersion: 1,
          references: [],
          responseFields: [responseField],
          blocks: [
            {
              ...responseBlock,
              correctValueSource: {
                schemaVersion: 1,
                type: "reference",
                referenceId: "missing",
              },
            },
          ],
        }),
      /unknown reference id/,
    );
  });

  it("rejects malformed and mismatched workbook references", () => {
    for (const source of [
      { schemaVersion: 1, type: "workbook_cell", ref: "A1:B2" },
      { schemaVersion: 1, type: "workbook_range", ref: "A1" },
      { schemaVersion: 1, type: "workbook_cell", ref: "not-a-ref" },
    ]) {
      assert.throws(() =>
        questionBlueprintDocument({
          schemaVersion: 1,
          references: [{ id: "revenue", source }],
          responseFields: [],
          blocks: [],
        }),
      );
    }
  });

  it("rejects unresolved authoring references in generated bodies", () => {
    assert.throws(() =>
      questionBody({
        schemaVersion: 1,
        responseFields: [],
        blocks: [
          {
            id: "prompt",
            type: "text",
            content: [{ type: "reference", referenceId: "revenue" }],
          },
        ],
      }),
    );
  });

  it("validates frozen private solution rules", () => {
    const solution = questionSolution({
      schemaVersion: 1,
      rules: [
        {
          type: "number",
          responseFieldId: "answer",
          correctValue: 1200,
          points: 1,
          tolerance: { type: "absolute", value: 0 },
        },
      ],
    });
    assert.equal(solution.rules[0]?.type, "number");
    assert.throws(() =>
      questionSolution({
        schemaVersion: 1,
        rules: [
          {
            type: "number",
            responseFieldId: "answer",
            correctValue: 1200,
            points: 1,
            tolerance: { type: "absolute", value: -1 },
          },
        ],
      }),
    );
  });

  it("sanitizes public blueprints but keeps authoring blueprints complete", () => {
    const at = new Date("2026-01-01T00:00:00.000Z");
    const ownerUserId = userId("019e9315-6a87-715f-9861-8654df070c4c");
    const document = questionBlueprintDocument({
      schemaVersion: 1,
      references: [literalReference],
      responseFields: [responseField],
      blocks: [
        {
          id: "prompt",
          type: "text",
          content: [
            {
              type: "reference",
              referenceId: "revenue",
              fallbackText: "Revenue",
            },
          ],
        },
        responseBlock,
      ],
    });
    const baseBlueprint = createQuestionBlueprint(
      {
        id: questionBlueprintId("019e9315-6a87-715f-9861-8654df070c4c"),
        ownerUserId,
        createdByUserId: ownerUserId,
        name: questionBlueprintName("Revenue"),
        description: questionBlueprintDescription(null),
        visibility: questionBlueprintVisibility("private"),
        workbookId: null,
      },
      at,
    );
    const version = createQuestionBlueprintVersion(
      {
        id: questionBlueprintVersionId("019e9315-6a87-715f-9861-8654df070c4d"),
        questionBlueprintId: baseBlueprint.id,
        versionNumber: 1,
        document,
        workbookId: null,
        createdByUserId: ownerUserId,
      },
      at,
    );
    const versionWithAssets = {
      ...version,
      sourceAssets: [],
    };
    const blueprint = {
      ...baseBlueprint,
      currentVersionId: version.id,
      currentVersion: versionWithAssets,
    } satisfies QuestionBlueprint & {
      currentVersion: typeof versionWithAssets;
    };

    const publicBlueprint = presentQuestionBlueprint({
      questionBlueprint: blueprint,
    }).questionBlueprint;
    const authoringBlueprint = presentQuestionBlueprintAuthoring({
      questionBlueprint: {
        ...blueprint,
        selectedVersion: versionWithAssets,
        versions: [versionWithAssets],
      },
    }).questionBlueprint;

    const publicDocument = publicBlueprint.document;
    const authoringDocument = authoringBlueprint.document;
    assert.ok(publicDocument);
    assert.ok(authoringDocument);
    const publicSecondBlock = publicDocument.blocks[1];
    const authoringSecondBlock = authoringDocument.blocks[1];
    assert.ok(publicSecondBlock);
    assert.ok(authoringSecondBlock);
    assert.equal("references" in publicDocument, false);
    assert.equal("correctValueSource" in publicSecondBlock, false);
    assert.equal(authoringDocument.references.length, 1);
    assert.equal("correctValueSource" in authoringSecondBlock, true);
  });

  it("does not expose private solutions in public question responses", () => {
    const question = createQuestion(
      {
        id: questionId("019e9315-6a87-715f-9861-8654df070c4c"),
        ownerUserId: userId("019e9315-6a87-715f-9861-8654df070c4c"),
        createdByUserId: userId("019e9315-6a87-715f-9861-8654df070c4c"),
        blueprintId: questionBlueprintId(
          "019e9315-6a87-715f-9861-8654df070c4d",
        ),
        blueprintVersionId: questionBlueprintVersionId(
          "019e9315-6a87-715f-9861-8654df070c4e",
        ),
        generationRunId: questionGenerationRunId(
          "019e9315-6a87-715f-9861-8654df070c4f",
        ),
        body: questionBody({
          schemaVersion: 1,
          responseFields: [responseField],
          blocks: [
            {
              id: "answer-block",
              type: "response",
              responseFieldId: "answer",
            },
          ],
        }),
        solution: questionSolution({
          schemaVersion: 1,
          rules: [
            {
              type: "exact",
              responseFieldId: "answer",
              correctValue: 100,
              points: 1,
            },
          ],
        }),
        sourcePlan: questionSourcePlan({
          schemaVersion: 1,
          references: [],
        }),
        producer: questionProducer({
          schemaVersion: 1,
          compiler: "test",
        }),
        source: null,
      },
      new Date("2026-01-01T00:00:00.000Z"),
    );

    const publicQuestion = presentQuestion({ question }).question;

    assert.equal("solution" in publicQuestion, false);
    assert.equal("sourcePlan" in publicQuestion, false);
  });

  it("keeps table content as literal plain text and rejects rich structures", () => {
    const blueprint = questionBlueprintDocument({
      schemaVersion: 1,
      references: [],
      responseFields: [],
      blocks: [
        {
          id: "table",
          type: "table",
          showColumnNames: true,
          showRowNames: true,
          columns: [{ id: "c1", label: "Label" }],
          rows: [{ id: "r1", label: "Row" }],
          cells: [
            {
              id: "cell-1",
              rowId: "r1",
              columnId: "c1",
              type: "content",
              content: [{ type: "text", text: "**Revenue**" }],
            },
          ],
        },
      ],
    });

    assert.deepEqual(
      blueprint.blocks[0]?.type === "table"
        ? blueprint.blocks[0].cells[0]
        : null,
      {
        id: "cell-1",
        rowId: "r1",
        columnId: "c1",
        type: "content",
        content: [{ type: "text", text: "**Revenue**" }],
      },
    );
    assert.throws(
      () =>
        questionBlueprintDocument({
          schemaVersion: 1,
          references: [],
          responseFields: [],
          blocks: [
            {
              id: "table",
              type: "table",
              showColumnNames: true,
              showRowNames: true,
              columns: [{ id: "c1", label: "Label" }],
              rows: [{ id: "r1", label: "Row" }],
              cells: [
                {
                  id: "cell-1",
                  rowId: "r1",
                  columnId: "c1",
                  type: "content",
                  content: { type: "doc", content: [] },
                },
              ],
            },
          ],
        }),
      /inline content must be an array/,
    );
  });

  it("keeps blueprint documents off the blueprint entity", () => {
    const blueprint = createQuestionBlueprint(
      {
        id: questionBlueprintId("019e9315-6a87-715f-9861-8654df070c70"),
        ownerUserId: userId("019e9315-6a87-715f-9861-8654df070c71"),
        createdByUserId: userId("019e9315-6a87-715f-9861-8654df070c72"),
        name: questionBlueprintName("Blueprint"),
        description: questionBlueprintDescription(null),
        visibility: questionBlueprintVisibility("private"),
      },
      new Date("2026-01-01T00:00:00.000Z"),
    );

    assert.equal("document" in blueprint, false);
  });

  it("rejects non-positive blueprint version numbers", () => {
    assert.throws(
      () =>
        createQuestionBlueprintVersion(
          {
            id: questionBlueprintVersionId(
              "019e9315-6a87-715f-9861-8654df070c73",
            ),
            questionBlueprintId: questionBlueprintId(
              "019e9315-6a87-715f-9861-8654df070c74",
            ),
            versionNumber: 0,
            document: questionBlueprintDocument({
              schemaVersion: 1,
              references: [],
              responseFields: [],
              blocks: [],
            }),
            workbookId: null,
            createdByUserId: userId("019e9315-6a87-715f-9861-8654df070c75"),
          },
          new Date("2026-01-01T00:00:00.000Z"),
        ),
      /positive integer/,
    );
  });
});
