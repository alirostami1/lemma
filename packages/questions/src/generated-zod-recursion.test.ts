import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  PublicQuestionBlueprintDocument,
  QuestionBody,
} from "./generated/types/index.js";
import {
  CreateQuestionBlueprintDraftBody,
  UpdateQuestionBlueprintDraftBody,
} from "./generated/zod/index.js";

describe("generated question Zod recursion", () => {
  it("does not degrade generated container child validation to unknown arrays", () => {
    const generatedDirectory = fileURLToPath(
      new URL("./generated/types", import.meta.url),
    );
    for (const fileName of readdirSync(generatedDirectory)) {
      if (!fileName.endsWith(".zod.ts")) {
        continue;
      }
      const generatedZod = readFileSync(
        `${generatedDirectory}/${fileName}`,
        "utf8",
      );
      assert.equal(
        generatedZod.includes("blocks: zod.array(zod.unknown())"),
        false,
        fileName,
      );
    }
  });

  it("rejects nested container children missing block identity", () => {
    const result = CreateQuestionBlueprintDraftBody.safeParse({
      ...validCreateDraftBody(),
      document: {
        ...validCreateDraftBody().document,
        blocks: [
          {
            blocks: [{ id: "not_a_block", type: "text" }],
            id: "page_1",
            kind: "container",
            type: "page",
          },
        ],
      },
    });

    assert.equal(result.success, false);
  });

  it("rejects arbitrary JSON inside container child blocks", () => {
    const result = CreateQuestionBlueprintDraftBody.safeParse({
      ...validCreateDraftBody(),
      document: {
        ...validCreateDraftBody().document,
        blocks: [
          {
            blocks: [{ arbitrary: "json" }],
            id: "page_1",
            kind: "container",
            type: "page",
          },
        ],
      },
    });

    assert.equal(result.success, false);
  });

  it("accepts nested page and step blocks with primitive input and table composition", () => {
    const result = CreateQuestionBlueprintDraftBody.safeParse(
      validCreateDraftBody(),
    );

    assert.equal(result.success, true);
  });

  it("validates recursive blocks in update requests", () => {
    const createBody = validCreateDraftBody();
    const result = UpdateQuestionBlueprintDraftBody.safeParse({
      description: null,
      document: createBody.document,
      expectedRevision: 1,
      name: createBody.name,
      sources: [],
    });

    assert.equal(result.success, true);
    assert.equal(
      UpdateQuestionBlueprintDraftBody.safeParse({
        description: null,
        document: {
          ...createBody.document,
          blocks: [containerWithInvalidChild()],
        },
        expectedRevision: 1,
        name: createBody.name,
        sources: [],
      }).success,
      false,
    );
  });

  it("validates recursive materialized question bodies", () => {
    const body = validQuestionBody();
    assert.equal(QuestionBody.safeParse(body).success, true);
    assert.equal(
      QuestionBody.safeParse({
        ...body,
        blocks: [containerWithInvalidChild()],
      }).success,
      false,
    );
  });

  it("validates recursive public blueprint documents", () => {
    const document = validPublicBlueprintDocument();
    assert.equal(
      PublicQuestionBlueprintDocument.safeParse(document).success,
      true,
    );
    assert.equal(
      PublicQuestionBlueprintDocument.safeParse({
        ...document,
        blocks: [containerWithInvalidChild()],
      }).success,
      false,
    );
  });
});

function containerWithInvalidChild() {
  return {
    blocks: [{ id: "not_a_block", type: "text" }],
    id: "page_1",
    kind: "container",
    type: "page",
  };
}

function validQuestionBody(publicInput = false) {
  return {
    blocks: [
      {
        blocks: [
          {
            blocks: [
              {
                content: [{ text: "Prompt", type: "text" }],
                id: "prompt_text",
                kind: "primitive",
                type: "text",
              },
              {
                id: "answer_input",
                input: {
                  ...(publicInput
                    ? {
                        defaultValueStatus: "none",
                        optionsStatus: "none",
                      }
                    : {}),
                  schemaVersion: 1,
                  type: "text",
                },
                kind: "primitive",
                responseFieldId: "answer",
                type: "input",
              },
            ],
            id: "step_1",
            kind: "container",
            type: "step",
          },
        ],
        id: "page_1",
        kind: "container",
        type: "page",
      },
    ],
    responseFields: [{ id: "answer", type: "text" }],
    schemaVersion: 2,
  };
}

function validPublicBlueprintDocument() {
  return validQuestionBody(true);
}

function validCreateDraftBody() {
  return {
    document: {
      blocks: [
        {
          blocks: [
            {
              blocks: [
                {
                  content: [{ text: "Read the table.", type: "text" }],
                  id: "prompt_text",
                  kind: "primitive",
                  type: "text",
                },
                {
                  grading: { mode: "manual" },
                  id: "answer_input",
                  input: {
                    schemaVersion: 1,
                    type: "text",
                  },
                  kind: "primitive",
                  label: "Answer",
                  points: 1,
                  responseFieldId: "answer",
                  type: "input",
                },
                {
                  cells: [
                    {
                      blocks: [
                        {
                          content: [{ text: "Cell text", type: "text" }],
                          id: "cell_text",
                          kind: "primitive",
                          type: "text",
                        },
                        {
                          grading: { mode: "manual" },
                          id: "cell_input",
                          input: {
                            schemaVersion: 1,
                            type: "text",
                          },
                          kind: "primitive",
                          points: 1,
                          responseFieldId: "cell_answer",
                          type: "input",
                        },
                      ],
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
              id: "step_1",
              kind: "container",
              title: "Step one",
              type: "step",
            },
          ],
          id: "page_1",
          kind: "container",
          title: "Page one",
          type: "page",
        },
      ],
      references: [],
      responseFields: [
        { id: "answer", type: "text" },
        { id: "cell_answer", type: "text" },
      ],
      schemaVersion: 2,
    },
    name: "Nested blueprint",
    sources: [],
  };
}
