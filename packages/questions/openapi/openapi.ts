import {
  badRequestResponse,
  conflictResponse,
  errorResponseSchema,
  forbiddenResponse,
  keycloakSecurityRequirement,
  keycloakSecurityScheme,
  notFoundResponse,
  type OpenAPI,
  type Param,
  type Paths,
  paramRef,
  type Response,
  responseRef,
  type Schema,
  schemaRef,
  type Tag,
  tagRef,
  UUID_V7_OPENAPI_PATTERN,
  unauthorizedResponse,
} from "@lemma/http/openapi";
import {
  MAX_GENERATION_RUN_COUNT,
  MAX_QUESTION_DESCRIPTION_LENGTH,
  MAX_QUESTION_NAME_LENGTH,
  QUESTION_BLUEPRINT_STATUS_ACCEPTED_VALUES,
  QUESTION_BLUEPRINT_VISIBILITY_ACCEPTED_VALUES,
  QUESTION_GENERATION_RUN_STATUS_ACCEPTED_VALUES,
  QUESTION_SET_STATUS_ACCEPTED_VALUES,
  QUESTION_STATUS_ACCEPTED_VALUES,
} from "../src/domain/index.ts";

type OpenApiSchema = Schema["schema"];

const questionTag: Tag = {
  name: "Questions",
  description:
    "Question sets, question blueprints, question generation, and answer operations.",
};

const jsonObject = { type: "object", additionalProperties: true } as const;
const uuid = {
  type: "string",
  pattern: UUID_V7_OPENAPI_PATTERN,
} as const;
const nullableUuid = {
  type: ["string", "null"],
  pattern: UUID_V7_OPENAPI_PATTERN,
  example: "019e8278-6746-768e-b90b-3c6d2fb8267f",
} satisfies OpenApiSchema;
const dateTime = {
  type: "string",
  format: "date-time",
} satisfies OpenApiSchema;
const nullableDateTime = {
  type: ["string", "null"],
  format: "date-time",
} satisfies OpenApiSchema;

const questionValueExpressionSchema: Schema = {
  name: "QuestionValueExpression",
  schema: {
    oneOf: [
      {
        type: "object",
        required: ["schemaVersion", "type", "value"],
        properties: {
          schemaVersion: { type: "number", enum: [1] },
          type: { type: "string", enum: ["literal"] },
          value: {},
        },
      },
      {
        type: "object",
        required: ["schemaVersion", "type", "referenceId"],
        properties: {
          schemaVersion: { type: "number", enum: [1] },
          type: { type: "string", enum: ["reference"] },
          referenceId: { type: "string", minLength: 1 },
        },
      },
    ],
  },
};
const questionReferenceSourceSchema: Schema = {
  name: "QuestionReferenceSource",
  schema: {
    oneOf: [
      {
        type: "object",
        required: ["schemaVersion", "type", "value"],
        properties: {
          schemaVersion: { type: "number", enum: [1] },
          type: { type: "string", enum: ["literal"] },
          value: {},
        },
      },
      {
        type: "object",
        required: ["schemaVersion", "type", "sourceId", "ref"],
        properties: {
          schemaVersion: { type: "number", enum: [1] },
          type: { enum: ["workbook_cell", "workbook_range"] },
          sourceId: { type: "string", minLength: 1 },
          ref: { type: "string" },
        },
      },
    ],
  },
};
const questionBlueprintWorkbookSourceSchema: Schema = {
  name: "QuestionBlueprintWorkbookSource",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["sourceId", "name", "workbookId"],
    properties: {
      sourceId: { type: "string", minLength: 1 },
      name: { type: "string", minLength: 1 },
      workbookId: uuid,
    },
  },
};
const blueprintInlineTextSchema: Schema = {
  name: "BlueprintInlineText",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["type", "text"],
    properties: {
      type: { type: "string", enum: ["text"] },
      text: { type: "string" },
    },
  },
};
const blueprintInlineReferenceSchema: Schema = {
  name: "BlueprintInlineReference",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["type", "referenceId"],
    properties: {
      type: { type: "string", enum: ["reference"] },
      referenceId: { type: "string", minLength: 1 },
      rangeCell: {
        type: "object",
        additionalProperties: false,
        required: ["rowOffset", "columnOffset"],
        properties: {
          rowOffset: { type: "integer", minimum: 0 },
          columnOffset: { type: "integer", minimum: 0 },
        },
      },
      fallbackText: { type: "string" },
    },
  },
};
const blueprintInlineContentSchema: Schema = {
  name: "BlueprintInlineContent",
  schema: {
    oneOf: [
      schemaRef(blueprintInlineTextSchema),
      schemaRef(blueprintInlineReferenceSchema),
    ],
  },
};
const renderedInlineTextSchema: Schema = {
  name: "RenderedInlineText",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["type", "text"],
    properties: {
      type: { type: "string", enum: ["text"] },
      text: { type: "string" },
    },
  },
};
const renderedInlineValueSchema: Schema = {
  name: "RenderedInlineValue",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["type", "referenceId", "displayValue"],
    properties: {
      type: { type: "string", enum: ["value"] },
      referenceId: { type: "string", minLength: 1 },
      displayValue: { type: "string" },
    },
  },
};
const renderedInlineContentSchema: Schema = {
  name: "RenderedInlineContent",
  schema: {
    oneOf: [
      schemaRef(renderedInlineTextSchema),
      schemaRef(renderedInlineValueSchema),
    ],
  },
};
const richTextNodeSchema: Schema = {
  name: "RichTextNode",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["type", "text"],
    properties: {
      type: { type: "string", enum: ["text"] },
      text: { type: "string" },
    },
  },
};
const richParagraphNodeSchema: Schema = {
  name: "RichParagraphNode",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["type"],
    properties: {
      type: { type: "string", enum: ["paragraph"] },
      content: { type: "array", items: schemaRef(richTextNodeSchema) },
    },
  },
};
const richHeadingNodeSchema: Schema = {
  name: "RichHeadingNode",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["type", "attrs"],
    properties: {
      type: { type: "string", enum: ["heading"] },
      attrs: {
        type: "object",
        additionalProperties: false,
        required: ["level"],
        properties: { level: { type: "integer", minimum: 1, maximum: 6 } },
      },
      content: { type: "array", items: schemaRef(richTextNodeSchema) },
    },
  },
};
const richListItemNodeSchema: Schema = {
  name: "RichListItemNode",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["type", "content"],
    properties: {
      type: { type: "string", enum: ["list_item"] },
      content: {
        type: "array",
        items: {
          oneOf: [
            schemaRef(richParagraphNodeSchema),
            { $ref: "#/components/schemas/RichBulletListNode" },
            { $ref: "#/components/schemas/RichOrderedListNode" },
          ],
        },
      },
    },
  },
};
const richBulletListNodeSchema: Schema = {
  name: "RichBulletListNode",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["type", "content"],
    properties: {
      type: { type: "string", enum: ["bullet_list"] },
      content: { type: "array", items: schemaRef(richListItemNodeSchema) },
    },
  },
};
const richOrderedListNodeSchema: Schema = {
  name: "RichOrderedListNode",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["type", "content"],
    properties: {
      type: { type: "string", enum: ["ordered_list"] },
      content: { type: "array", items: schemaRef(richListItemNodeSchema) },
    },
  },
};
const richContentSchema: Schema = {
  name: "RichContent",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["type", "content"],
    properties: {
      type: { type: "string", enum: ["doc"] },
      content: {
        type: "array",
        items: {
          oneOf: [
            schemaRef(richParagraphNodeSchema),
            schemaRef(richHeadingNodeSchema),
            schemaRef(richBulletListNodeSchema),
            schemaRef(richOrderedListNodeSchema),
          ],
        },
      },
    },
  },
};
const responseFieldSchema: Schema = {
  name: "QuestionResponseField",
  schema: {
    type: "object",
    required: ["id", "type"],
    properties: {
      id: { type: "string" },
      type: { type: "string", enum: ["text", "number", "boolean"] },
      label: { type: "string" },
      required: { type: "boolean" },
    },
  },
};
const questionTextBlockSchema: Schema = {
  name: "QuestionTextBlock",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["id", "type", "content"],
    properties: {
      id: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["text"] },
      content: { type: "array", items: schemaRef(renderedInlineContentSchema) },
    },
  },
};

const questionBlueprintTextBlockSchema: Schema = {
  name: "QuestionBlueprintTextBlock",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["id", "type", "content"],
    properties: {
      id: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["text"] },
      content: {
        type: "array",
        items: schemaRef(blueprintInlineContentSchema),
      },
    },
  },
};
const publicQuestionBlueprintTextBlockSchema: Schema = {
  name: "PublicQuestionBlueprintTextBlock",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["id", "type", "content"],
    properties: {
      id: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["text"] },
      content: { type: "array", items: schemaRef(blueprintInlineTextSchema) },
    },
  },
};

const questionRichTextBlockSchema: Schema = {
  name: "QuestionRichTextBlock",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["id", "type", "content"],
    properties: {
      id: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["rich_text"] },
      content: schemaRef(richContentSchema),
    },
  },
};
const questionSeparatorBlockSchema: Schema = {
  name: "QuestionSeparatorBlock",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["id", "type"],
    properties: {
      id: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["separator"] },
    },
  },
};
const questionResponseBlockSchema: Schema = {
  name: "QuestionResponseBlock",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["id", "type", "responseFieldId"],
    properties: {
      id: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["response"] },
      responseFieldId: { type: "string", minLength: 1 },
      label: { type: "string" },
      placeholder: { type: "string" },
    },
  },
};
const questionReferenceSchema: Schema = {
  name: "QuestionReference",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["id", "source"],
    properties: {
      id: { type: "string", minLength: 1 },
      label: { type: "string" },
      source: schemaRef(questionReferenceSourceSchema),
    },
  },
};
const questionTableColumnSchema: Schema = {
  name: "QuestionTableColumn",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["id", "label"],
    properties: {
      id: { type: "string", minLength: 1 },
      label: { type: "string", minLength: 1 },
    },
  },
};
const questionTableRowSchema: Schema = {
  name: "QuestionTableRow",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["id", "label"],
    properties: {
      id: { type: "string", minLength: 1 },
      label: { type: "string", minLength: 1 },
    },
  },
};
const questionTableContentCellSchema: Schema = {
  name: "QuestionTableContentCell",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["id", "rowId", "columnId", "type", "text"],
    properties: {
      id: { type: "string", minLength: 1 },
      rowId: { type: "string", minLength: 1 },
      columnId: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["content"] },
      text: { type: "string" },
    },
  },
};
const questionTableResponseCellSchema: Schema = {
  name: "QuestionTableResponseCell",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["id", "rowId", "columnId", "type", "responseFieldId"],
    properties: {
      id: { type: "string", minLength: 1 },
      rowId: { type: "string", minLength: 1 },
      columnId: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["response"] },
      responseFieldId: { type: "string", minLength: 1 },
      label: { type: "string" },
      placeholder: { type: "string" },
    },
  },
};
const questionTableBlockSchema: Schema = {
  name: "QuestionTableBlock",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "id",
      "type",
      "showColumnNames",
      "showRowNames",
      "columns",
      "rows",
      "cells",
    ],
    properties: {
      id: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["table"] },
      showColumnNames: { type: "boolean" },
      showRowNames: { type: "boolean" },
      columns: {
        type: "array",
        items: schemaRef(questionTableColumnSchema),
      },
      rows: {
        type: "array",
        items: schemaRef(questionTableRowSchema),
      },
      cells: {
        type: "array",
        items: {
          oneOf: [
            schemaRef(questionTableContentCellSchema),
            schemaRef(questionTableResponseCellSchema),
          ],
        },
      },
    },
  },
};
const questionBlockSchema: Schema = {
  name: "QuestionBlock",
  schema: {
    oneOf: [
      schemaRef(questionTextBlockSchema),
      schemaRef(questionRichTextBlockSchema),
      schemaRef(questionSeparatorBlockSchema),
      schemaRef(questionResponseBlockSchema),
      schemaRef(questionTableBlockSchema),
    ],
  },
};
const questionBodySchema: Schema = {
  name: "QuestionBody",
  schema: {
    type: "object",
    required: ["schemaVersion", "blocks", "responseFields"],
    properties: {
      schemaVersion: { type: "number", enum: [1] },
      blocks: { type: "array", items: schemaRef(questionBlockSchema) },
      responseFields: { type: "array", items: schemaRef(responseFieldSchema) },
    },
  },
};
const questionBlueprintTableContentCellSchema: Schema = {
  name: "QuestionBlueprintTableContentCell",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["id", "rowId", "columnId", "type", "content"],
    properties: {
      id: { type: "string", minLength: 1 },
      rowId: { type: "string", minLength: 1 },
      columnId: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["content"] },
      content: {
        type: "array",
        items: schemaRef(blueprintInlineContentSchema),
      },
    },
  },
};
const gradingSchema: Schema = {
  name: "QuestionBlueprintGrading",
  schema: {
    oneOf: [
      {
        type: "object",
        additionalProperties: false,
        required: ["mode"],
        properties: { mode: { type: "string", enum: ["exact"] } },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["mode", "tolerance"],
        properties: {
          mode: { type: "string", enum: ["number"] },
          tolerance: {
            type: "object",
            additionalProperties: false,
            required: ["type", "value"],
            properties: {
              type: { type: "string", enum: ["absolute", "relative"] },
              value: { type: "number", minimum: 0 },
            },
          },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["mode"],
        properties: {
          mode: { type: "string", enum: ["case_insensitive_text"] },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["mode"],
        properties: { mode: { type: "string", enum: ["manual"] } },
      },
    ],
  },
};
const questionBlueprintTableResponseCellSchema: Schema = {
  name: "QuestionBlueprintTableResponseCell",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "id",
      "rowId",
      "columnId",
      "type",
      "responseFieldId",
      "points",
      "grading",
    ],
    properties: {
      id: { type: "string", minLength: 1 },
      rowId: { type: "string", minLength: 1 },
      columnId: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["response"] },
      responseFieldId: { type: "string", minLength: 1 },
      label: { type: "string" },
      placeholder: { type: "string" },
      correctValueSource: schemaRef(questionValueExpressionSchema),
      points: { type: "number", exclusiveMinimum: 0 },
      grading: schemaRef(gradingSchema),
    },
  },
};
const questionBlueprintResponseBlockSchema: Schema = {
  name: "QuestionBlueprintResponseBlock",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["id", "type", "responseFieldId", "points", "grading"],
    properties: {
      id: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["response"] },
      responseFieldId: { type: "string", minLength: 1 },
      label: { type: "string" },
      placeholder: { type: "string" },
      correctValueSource: schemaRef(questionValueExpressionSchema),
      points: { type: "number", exclusiveMinimum: 0 },
      grading: schemaRef(gradingSchema),
    },
  },
};
const publicQuestionBlueprintResponseBlockSchema: Schema = {
  name: "PublicQuestionBlueprintResponseBlock",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["id", "type", "responseFieldId"],
    properties: {
      id: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["response"] },
      responseFieldId: { type: "string", minLength: 1 },
      label: { type: "string" },
      placeholder: { type: "string" },
    },
  },
};
const publicQuestionBlueprintTableResponseCellSchema: Schema = {
  name: "PublicQuestionBlueprintTableResponseCell",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["id", "rowId", "columnId", "type", "responseFieldId"],
    properties: {
      id: { type: "string", minLength: 1 },
      rowId: { type: "string", minLength: 1 },
      columnId: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["response"] },
      responseFieldId: { type: "string", minLength: 1 },
      label: { type: "string" },
      placeholder: { type: "string" },
    },
  },
};
const publicQuestionBlueprintTableContentCellSchema: Schema = {
  name: "PublicQuestionBlueprintTableContentCell",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["id", "rowId", "columnId", "type", "content"],
    properties: {
      id: { type: "string", minLength: 1 },
      rowId: { type: "string", minLength: 1 },
      columnId: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["content"] },
      content: { type: "array", items: schemaRef(blueprintInlineTextSchema) },
    },
  },
};
const questionBlueprintTableBlockSchema: Schema = {
  name: "QuestionBlueprintTableBlock",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "id",
      "type",
      "showColumnNames",
      "showRowNames",
      "columns",
      "rows",
      "cells",
    ],
    properties: {
      id: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["table"] },
      showColumnNames: { type: "boolean" },
      showRowNames: { type: "boolean" },
      columns: {
        type: "array",
        items: schemaRef(questionTableColumnSchema),
      },
      rows: {
        type: "array",
        items: schemaRef(questionTableRowSchema),
      },
      cells: {
        type: "array",
        items: {
          oneOf: [
            schemaRef(questionBlueprintTableContentCellSchema),
            schemaRef(questionBlueprintTableResponseCellSchema),
          ],
        },
      },
    },
  },
};
const publicQuestionBlueprintTableBlockSchema: Schema = {
  name: "PublicQuestionBlueprintTableBlock",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "id",
      "type",
      "showColumnNames",
      "showRowNames",
      "columns",
      "rows",
      "cells",
    ],
    properties: {
      id: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["table"] },
      showColumnNames: { type: "boolean" },
      showRowNames: { type: "boolean" },
      columns: {
        type: "array",
        items: schemaRef(questionTableColumnSchema),
      },
      rows: {
        type: "array",
        items: schemaRef(questionTableRowSchema),
      },
      cells: {
        type: "array",
        items: {
          oneOf: [
            schemaRef(publicQuestionBlueprintTableContentCellSchema),
            schemaRef(publicQuestionBlueprintTableResponseCellSchema),
          ],
        },
      },
    },
  },
};
const questionBlueprintBlockSchema: Schema = {
  name: "QuestionBlueprintBlock",
  schema: {
    oneOf: [
      schemaRef(questionBlueprintTextBlockSchema),
      schemaRef(questionRichTextBlockSchema),
      schemaRef(questionSeparatorBlockSchema),
      schemaRef(questionBlueprintResponseBlockSchema),
      schemaRef(questionBlueprintTableBlockSchema),
    ],
  },
};

const publicQuestionBlueprintBlockSchema: Schema = {
  name: "PublicQuestionBlueprintBlock",
  schema: {
    oneOf: [
      schemaRef(publicQuestionBlueprintTextBlockSchema),
      schemaRef(questionRichTextBlockSchema),
      schemaRef(questionSeparatorBlockSchema),
      schemaRef(publicQuestionBlueprintResponseBlockSchema),
      schemaRef(publicQuestionBlueprintTableBlockSchema),
    ],
  },
};
const questionBlueprintDocumentSchema: Schema = {
  name: "QuestionBlueprintDocument",
  schema: {
    type: "object",
    required: ["schemaVersion", "blocks", "responseFields", "references"],
    properties: {
      schemaVersion: { type: "number", enum: [1] },
      blocks: {
        type: "array",
        items: schemaRef(questionBlueprintBlockSchema),
      },
      responseFields: { type: "array", items: schemaRef(responseFieldSchema) },
      references: { type: "array", items: schemaRef(questionReferenceSchema) },
    },
  },
};
const publicQuestionBlueprintDocumentSchema: Schema = {
  name: "PublicQuestionBlueprintDocument",
  schema: {
    type: "object",
    required: ["schemaVersion", "blocks", "responseFields"],
    properties: {
      schemaVersion: { type: "number", enum: [1] },
      blocks: {
        type: "array",
        items: schemaRef(publicQuestionBlueprintBlockSchema),
      },
      responseFields: { type: "array", items: schemaRef(responseFieldSchema) },
    },
  },
};
const questionSolutionSchema: Schema = {
  name: "QuestionSolution",
  schema: {
    type: "object",
    required: ["schemaVersion", "rules"],
    properties: {
      schemaVersion: { type: "number", enum: [1] },
      rules: {
        type: "array",
        items: {
          oneOf: [
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "responseFieldId", "correctValue", "points"],
              properties: {
                type: { type: "string", enum: ["exact"] },
                responseFieldId: { type: "string", minLength: 1 },
                correctValue: {},
                points: { type: "number", exclusiveMinimum: 0 },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: [
                "type",
                "responseFieldId",
                "correctValue",
                "tolerance",
                "points",
              ],
              properties: {
                type: { type: "string", enum: ["number"] },
                responseFieldId: { type: "string", minLength: 1 },
                correctValue: { type: "number" },
                tolerance: {
                  type: "object",
                  additionalProperties: false,
                  required: ["type", "value"],
                  properties: {
                    type: { type: "string", enum: ["absolute", "relative"] },
                    value: { type: "number", minimum: 0 },
                  },
                },
                points: { type: "number", exclusiveMinimum: 0 },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "responseFieldId", "correctValue", "points"],
              properties: {
                type: { type: "string", enum: ["case_insensitive_text"] },
                responseFieldId: { type: "string", minLength: 1 },
                correctValue: { type: "string" },
                points: { type: "number", exclusiveMinimum: 0 },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "responseFieldId", "points"],
              properties: {
                type: { type: "string", enum: ["manual"] },
                responseFieldId: { type: "string", minLength: 1 },
                points: { type: "number", exclusiveMinimum: 0 },
              },
            },
          ],
        },
      },
    },
  },
};
const questionSourcePlanSchema: Schema = {
  name: "QuestionSourcePlan",
  schema: {
    type: "object",
    required: ["schemaVersion", "references"],
    properties: {
      schemaVersion: { type: "number", enum: [1] },
      references: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "source"],
          properties: {
            id: { type: "string" },
            source: schemaRef(questionReferenceSourceSchema),
            resolved: { type: "boolean" },
          },
        },
      },
    },
  },
};
const questionProducerSchema: Schema = {
  name: "QuestionProducer",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "compiler"],
    properties: {
      schemaVersion: { type: "number", enum: [1] },
      compiler: { type: "string" },
      source: jsonObject,
    },
  },
};
const questionAnswerSchema: Schema = {
  name: "QuestionAnswer",
  schema: {
    type: "object",
    required: ["schemaVersion", "responses"],
    properties: {
      schemaVersion: { type: "number", enum: [1] },
      responses: {
        type: "array",
        items: {
          type: "object",
          required: ["responseFieldId", "value"],
          properties: { responseFieldId: { type: "string" }, value: {} },
        },
      },
    },
  },
};
const workbookSourceSchema: Schema = {
  name: "WorkbookSource",
  schema: {
    type: "object",
    required: ["type", "workbookId"],
    properties: {
      type: {
        type: "string",
        enum: ["workbook_snapshot"],
      },
      workbookId: uuid,
      workbookVersionId: nullableUuid,
      workbookCalculationId: nullableUuid,
      workbookSnapshotId: nullableUuid,
    },
  },
};
const createWorkbookSourceSchema: Schema = {
  name: "CreateWorkbookSource",
  schema: {
    type: "object",
    required: ["type", "workbookId"],
    additionalProperties: false,
    properties: {
      type: {
        type: "string",
        enum: ["workbook_snapshot"],
      },
      workbookId: uuid,
    },
  },
};

const gradeResultSchema: Schema = {
  name: "GradeResult",
  schema: {
    type: "object",
    required: [
      "schemaVersion",
      "totalPoints",
      "earnedPoints",
      "status",
      "details",
      "graderVersion",
    ],
    properties: {
      schemaVersion: { type: "number", enum: [1] },
      totalPoints: { type: "number" },
      earnedPoints: { type: "number" },
      status: { type: "string", enum: ["graded", "needs_manual_review"] },
      details: { type: "array", items: jsonObject },
      graderVersion: { type: "string" },
    },
  },
};

const questionSetSchema: Schema = {
  name: "QuestionSet",
  schema: {
    type: "object",
    required: [
      "id",
      "ownerUserId",
      "createdByUserId",
      "name",
      "description",
      "status",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      id: uuid,
      ownerUserId: uuid,
      createdByUserId: uuid,
      name: {
        type: "string",
        minLength: 1,
        maxLength: MAX_QUESTION_NAME_LENGTH,
      },
      description: {
        type: ["string", "null"],
        maxLength: MAX_QUESTION_DESCRIPTION_LENGTH,
      },
      status: {
        type: "string",
        enum: QUESTION_SET_STATUS_ACCEPTED_VALUES as unknown as string[],
      },
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },
};

const questionBlueprintSchema: Schema = {
  name: "QuestionBlueprint",
  schema: {
    type: "object",
    required: [
      "id",
      "ownerUserId",
      "createdByUserId",
      "name",
      "description",
      "document",
      "workbookId",
      "workbookSources",
      "currentVersionId",
      "currentVersionNumber",
      "currentVersion",
      "visibility",
      "status",
      "archivedAt",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      id: uuid,
      ownerUserId: uuid,
      createdByUserId: uuid,
      name: {
        type: "string",
        minLength: 1,
        maxLength: MAX_QUESTION_NAME_LENGTH,
      },
      description: {
        type: ["string", "null"],
        maxLength: MAX_QUESTION_DESCRIPTION_LENGTH,
      },
      document: schemaRef(publicQuestionBlueprintDocumentSchema),
      workbookId: nullableUuid,
      workbookSources: {
        type: "array",
        items: schemaRef(questionBlueprintWorkbookSourceSchema),
      },
      currentVersionId: uuid,
      currentVersionNumber: { type: "integer", minimum: 1 },
      currentVersion: {
        type: "object",
        required: [
          "id",
          "versionNumber",
          "workbookId",
          "workbookSources",
          "createdByUserId",
          "createdAt",
        ],
        properties: {
          id: uuid,
          versionNumber: { type: "integer", minimum: 1 },
          workbookId: nullableUuid,
          workbookSources: {
            type: "array",
            items: schemaRef(questionBlueprintWorkbookSourceSchema),
          },
          createdByUserId: uuid,
          createdAt: dateTime,
        },
      },
      visibility: {
        type: "string",
        enum: QUESTION_BLUEPRINT_VISIBILITY_ACCEPTED_VALUES as unknown as string[],
      },
      status: {
        type: "string",
        enum: QUESTION_BLUEPRINT_STATUS_ACCEPTED_VALUES as unknown as string[],
      },
      archivedAt: nullableDateTime,
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },
};

const questionBlueprintVersionAssetSchema: Schema = {
  name: "QuestionBlueprintVersionAsset",
  schema: {
    type: "object",
    required: [
      "questionBlueprintVersionId",
      "workbookId",
      "kind",
      "position",
      "createdAt",
    ],
    properties: {
      questionBlueprintVersionId: uuid,
      workbookId: uuid,
      kind: { type: "string", enum: ["workbook"] },
      position: { type: "integer", minimum: 0 },
      createdAt: dateTime,
    },
  },
};

const questionBlueprintVersionSchema: Schema = {
  name: "QuestionBlueprintVersion",
  schema: {
    type: "object",
    required: [
      "id",
      "versionNumber",
      "workbookId",
      "sourceAssets",
      "workbookSources",
      "createdByUserId",
      "createdAt",
    ],
    properties: {
      id: uuid,
      versionNumber: { type: "integer", minimum: 1 },
      workbookId: nullableUuid,
      sourceAssets: {
        type: "array",
        items: schemaRef(questionBlueprintVersionAssetSchema),
      },
      workbookSources: {
        type: "array",
        items: schemaRef(questionBlueprintWorkbookSourceSchema),
      },
      createdByUserId: uuid,
      createdAt: dateTime,
    },
  },
};

const questionBlueprintAuthoringSchema: Schema = {
  name: "QuestionBlueprintAuthoring",
  schema: {
    type: "object",
    required: [
      "id",
      "ownerUserId",
      "createdByUserId",
      "name",
      "description",
      "document",
      "workbookId",
      "workbookSources",
      "currentVersionId",
      "currentVersionNumber",
      "currentVersion",
      "selectedVersionId",
      "selectedVersionNumber",
      "selectedVersion",
      "versions",
      "visibility",
      "status",
      "archivedAt",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      id: uuid,
      ownerUserId: uuid,
      createdByUserId: uuid,
      name: {
        type: "string",
        minLength: 1,
        maxLength: MAX_QUESTION_NAME_LENGTH,
      },
      description: {
        type: ["string", "null"],
        maxLength: MAX_QUESTION_DESCRIPTION_LENGTH,
      },
      document: schemaRef(questionBlueprintDocumentSchema),
      workbookId: nullableUuid,
      workbookSources: {
        type: "array",
        items: schemaRef(questionBlueprintWorkbookSourceSchema),
      },
      currentVersionId: uuid,
      currentVersionNumber: { type: "integer", minimum: 1 },
      currentVersion: schemaRef(questionBlueprintVersionSchema),
      selectedVersionId: uuid,
      selectedVersionNumber: { type: "integer", minimum: 1 },
      selectedVersion: schemaRef(questionBlueprintVersionSchema),
      versions: {
        type: "array",
        items: schemaRef(questionBlueprintVersionSchema),
      },
      visibility: {
        type: "string",
        enum: QUESTION_BLUEPRINT_VISIBILITY_ACCEPTED_VALUES as unknown as string[],
      },
      status: {
        type: "string",
        enum: QUESTION_BLUEPRINT_STATUS_ACCEPTED_VALUES as unknown as string[],
      },
      archivedAt: nullableDateTime,
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },
};

const questionSchema: Schema = {
  name: "Question",
  schema: {
    type: "object",
    required: [
      "id",
      "ownerUserId",
      "createdByUserId",
      "blueprintId",
      "blueprintVersionId",
      "generationRunId",
      "body",
      "producer",
      "source",
      "status",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      id: uuid,
      ownerUserId: uuid,
      createdByUserId: uuid,
      blueprintId: uuid,
      blueprintVersionId: uuid,
      generationRunId: uuid,
      body: schemaRef(questionBodySchema),
      producer: schemaRef(questionProducerSchema),
      source: { oneOf: [schemaRef(workbookSourceSchema), { type: "null" }] },
      status: {
        type: "string",
        enum: QUESTION_STATUS_ACCEPTED_VALUES as unknown as string[],
      },
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },
};

const questionGenerationRunSchema: Schema = {
  name: "QuestionGenerationRun",
  schema: {
    type: "object",
    required: [
      "id",
      "ownerUserId",
      "createdByUserId",
      "blueprintId",
      "blueprintVersionId",
      "targetQuestionSetId",
      "requestedCount",
      "source",
      "status",
      "result",
      "errorMessage",
      "attempts",
      "startedAt",
      "finishedAt",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      id: uuid,
      ownerUserId: uuid,
      createdByUserId: uuid,
      blueprintId: uuid,
      blueprintVersionId: uuid,
      targetQuestionSetId: uuid,
      requestedCount: {
        type: "integer",
        minimum: 1,
        maximum: MAX_GENERATION_RUN_COUNT,
      },
      source: { oneOf: [schemaRef(workbookSourceSchema), { type: "null" }] },
      status: {
        type: "string",
        enum: QUESTION_GENERATION_RUN_STATUS_ACCEPTED_VALUES as unknown as string[],
      },
      result: {
        oneOf: [
          {
            type: "object",
            required: ["questionIds"],
            properties: { questionIds: { type: "array", items: uuid } },
          },
          { type: "null" },
        ],
      },
      errorMessage: { type: ["string", "null"] },
      attempts: { type: "integer", minimum: 0 },
      startedAt: nullableDateTime,
      finishedAt: nullableDateTime,
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },
};

const listQuestionSetsResponseSchema: Schema = {
  name: "ListQuestionSetsResponse",
  schema: {
    type: "object",
    required: ["questionSets", "nextCursor"],
    properties: {
      questionSets: {
        type: "array",
        items: schemaRef(questionSetSchema),
      },
      nextCursor: {
        type: ["string", "null"],
      },
    },
  },
};
const questionSetResponseSchema: Schema = {
  name: "QuestionSetResponse",
  schema: {
    type: "object",
    required: ["questionSet"],
    properties: {
      questionSet: schemaRef(questionSetSchema),
    },
  },
};
const listQuestionBlueprintsResponseSchema: Schema = {
  name: "ListQuestionBlueprintsResponse",
  schema: {
    type: "object",
    required: ["questionBlueprints", "nextCursor"],
    properties: {
      questionBlueprints: {
        type: "array",
        items: schemaRef(questionBlueprintSchema),
      },
      nextCursor: {
        type: ["string", "null"],
      },
    },
  },
};
const questionBlueprintResponseSchema: Schema = {
  name: "QuestionBlueprintResponse",
  schema: {
    type: "object",
    required: ["questionBlueprint"],
    properties: {
      questionBlueprint: schemaRef(questionBlueprintSchema),
    },
  },
};
const questionBlueprintAuthoringResponseSchema: Schema = {
  name: "QuestionBlueprintAuthoringResponse",
  schema: {
    type: "object",
    required: ["questionBlueprint"],
    properties: {
      questionBlueprint: schemaRef(questionBlueprintAuthoringSchema),
    },
  },
};
const listQuestionBlueprintVersionsResponseSchema: Schema = {
  name: "ListQuestionBlueprintVersionsResponse",
  schema: {
    type: "object",
    required: ["versions"],
    properties: {
      versions: {
        type: "array",
        items: schemaRef(questionBlueprintVersionSchema),
      },
    },
  },
};
const listQuestionsResponseSchema: Schema = {
  name: "ListQuestionsResponse",
  schema: {
    type: "object",
    required: ["questions", "nextCursor"],
    properties: {
      questions: {
        type: "array",
        items: schemaRef(questionSchema),
      },
      nextCursor: {
        type: ["string", "null"],
      },
    },
  },
};
const questionResponseSchema: Schema = {
  name: "QuestionResponse",
  schema: {
    type: "object",
    required: ["question"],
    properties: {
      question: schemaRef(questionSchema),
    },
  },
};
const listQuestionGenerationRunsResponseSchema: Schema = {
  name: "ListQuestionGenerationRunsResponse",
  schema: {
    type: "object",
    required: ["questionGenerationRuns", "nextCursor"],
    properties: {
      questionGenerationRuns: {
        type: "array",
        items: schemaRef(questionGenerationRunSchema),
      },
      nextCursor: {
        type: ["string", "null"],
      },
    },
  },
};
const questionGenerationRunResponseSchema: Schema = {
  name: "QuestionGenerationRunResponse",
  schema: {
    type: "object",
    required: ["questionGenerationRun"],
    properties: {
      questionGenerationRun: schemaRef(questionGenerationRunSchema),
    },
  },
};
const gradeQuestionResponseSchema: Schema = {
  name: "GradeQuestionResponse",
  schema: {
    type: "object",
    required: ["grade"],
    properties: { grade: schemaRef(gradeResultSchema) },
  },
};

const createQuestionSetRequestSchema: Schema = {
  name: "CreateQuestionSetRequest",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: MAX_QUESTION_NAME_LENGTH,
      },
      description: {
        type: ["string", "null"],
        maxLength: MAX_QUESTION_DESCRIPTION_LENGTH,
      },
    },
  },
};
const updateQuestionSetRequestSchema: Schema = {
  name: "UpdateQuestionSetRequest",
  schema: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: MAX_QUESTION_NAME_LENGTH,
      },
      description: {
        type: ["string", "null"],
        maxLength: MAX_QUESTION_DESCRIPTION_LENGTH,
      },
      status: {
        type: "string",
        enum: QUESTION_SET_STATUS_ACCEPTED_VALUES as unknown as string[],
      },
    },
  },
};
const createQuestionBlueprintRequestSchema: Schema = {
  name: "CreateQuestionBlueprintRequest",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["name", "document"],
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: MAX_QUESTION_NAME_LENGTH,
      },
      description: {
        type: ["string", "null"],
        maxLength: MAX_QUESTION_DESCRIPTION_LENGTH,
      },
      visibility: {
        type: "string",
        enum: QUESTION_BLUEPRINT_VISIBILITY_ACCEPTED_VALUES as unknown as string[],
      },
      document: schemaRef(questionBlueprintDocumentSchema),
      workbookId: nullableUuid,
      workbookSources: {
        type: "array",
        items: schemaRef(questionBlueprintWorkbookSourceSchema),
      },
    },
  },
};
const updateQuestionBlueprintRequestSchema: Schema = {
  name: "UpdateQuestionBlueprintRequest",
  schema: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: MAX_QUESTION_NAME_LENGTH,
      },
      description: {
        type: ["string", "null"],
        maxLength: MAX_QUESTION_DESCRIPTION_LENGTH,
      },
      visibility: {
        type: "string",
        enum: QUESTION_BLUEPRINT_VISIBILITY_ACCEPTED_VALUES as unknown as string[],
      },
      document: schemaRef(questionBlueprintDocumentSchema),
      workbookId: nullableUuid,
      workbookSources: {
        type: "array",
        items: schemaRef(questionBlueprintWorkbookSourceSchema),
      },
      status: {
        type: "string",
        enum: QUESTION_BLUEPRINT_STATUS_ACCEPTED_VALUES as unknown as string[],
      },
    },
  },
};
const gradeQuestionRequestSchema: Schema = {
  name: "GradeQuestionRequest",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["answer"],
    properties: { answer: schemaRef(questionAnswerSchema) },
  },
};
const createQuestionGenerationRunRequestSchema: Schema = {
  name: "CreateQuestionGenerationRunRequest",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["count", "blueprintId", "targetQuestionSetId"],
    properties: {
      count: {
        type: "integer",
        minimum: 1,
        maximum: MAX_GENERATION_RUN_COUNT,
      },
      targetQuestionSetId: uuid,
      blueprintId: uuid,
      blueprintVersionId: nullableUuid,
      source: {
        oneOf: [schemaRef(createWorkbookSourceSchema), { type: "null" }],
      },
    },
  },
};

const upstreamWorkbookResponse: Response = {
  name: "UpstreamWorkbook",
  schema: {
    description: "UPSTREAM_WORKBOOK",
    content: {
      "application/json": { schema: schemaRef(errorResponseSchema) },
    },
  },
};

const questionSetParam: Param = {
  name: "QuestionSetIdParam",
  schema: {
    name: "questionSetId",
    in: "path",
    required: true,
    schema: uuid,
  },
};
const questionBlueprintParam: Param = {
  name: "QuestionBlueprintIdParam",
  schema: {
    name: "questionBlueprintId",
    in: "path",
    required: true,
    schema: uuid,
  },
};
const questionBlueprintVersionParam: Param = {
  name: "QuestionBlueprintVersionIdParam",
  schema: {
    name: "questionBlueprintVersionId",
    in: "path",
    required: true,
    schema: uuid,
  },
};
const questionParam: Param = {
  name: "QuestionIdParam",
  schema: {
    name: "questionId",
    in: "path",
    required: true,
    schema: uuid,
  },
};
const questionGenerationRunParam: Param = {
  name: "QuestionGenerationRunIdParam",
  schema: {
    name: "questionGenerationRunId",
    in: "path",
    required: true,
    schema: uuid,
  },
};

export const tags: readonly Tag[] = Object.freeze([questionTag]);

export const schemas = Object.freeze([
  questionValueExpressionSchema,
  questionReferenceSourceSchema,
  questionBlueprintWorkbookSourceSchema,
  blueprintInlineTextSchema,
  blueprintInlineReferenceSchema,
  blueprintInlineContentSchema,
  renderedInlineTextSchema,
  renderedInlineValueSchema,
  renderedInlineContentSchema,
  richTextNodeSchema,
  richParagraphNodeSchema,
  richHeadingNodeSchema,
  richListItemNodeSchema,
  richBulletListNodeSchema,
  richOrderedListNodeSchema,
  richContentSchema,
  responseFieldSchema,
  questionTextBlockSchema,
  questionBlueprintTextBlockSchema,
  publicQuestionBlueprintTextBlockSchema,
  questionRichTextBlockSchema,
  questionSeparatorBlockSchema,
  questionResponseBlockSchema,
  questionReferenceSchema,
  questionTableColumnSchema,
  questionTableRowSchema,
  questionTableContentCellSchema,
  questionTableResponseCellSchema,
  questionTableBlockSchema,
  questionBlockSchema,
  questionBodySchema,
  questionBlueprintTableContentCellSchema,
  gradingSchema,
  questionBlueprintTableResponseCellSchema,
  questionBlueprintResponseBlockSchema,
  publicQuestionBlueprintResponseBlockSchema,
  publicQuestionBlueprintTableContentCellSchema,
  publicQuestionBlueprintTableResponseCellSchema,
  questionBlueprintTableBlockSchema,
  publicQuestionBlueprintTableBlockSchema,
  questionBlueprintBlockSchema,
  publicQuestionBlueprintBlockSchema,
  questionBlueprintDocumentSchema,
  publicQuestionBlueprintDocumentSchema,
  questionSolutionSchema,
  questionSourcePlanSchema,
  questionProducerSchema,
  questionAnswerSchema,
  workbookSourceSchema,
  gradeResultSchema,
  questionSetSchema,
  questionBlueprintSchema,
  questionBlueprintVersionAssetSchema,
  questionBlueprintVersionSchema,
  questionBlueprintAuthoringSchema,
  questionSchema,
  questionGenerationRunSchema,
  listQuestionSetsResponseSchema,
  questionSetResponseSchema,
  listQuestionBlueprintsResponseSchema,
  questionBlueprintResponseSchema,
  questionBlueprintAuthoringResponseSchema,
  listQuestionBlueprintVersionsResponseSchema,
  listQuestionsResponseSchema,
  questionResponseSchema,
  gradeQuestionResponseSchema,
  listQuestionGenerationRunsResponseSchema,
  questionGenerationRunResponseSchema,
  createQuestionSetRequestSchema,
  updateQuestionSetRequestSchema,
  createQuestionBlueprintRequestSchema,
  updateQuestionBlueprintRequestSchema,
  gradeQuestionRequestSchema,
  createQuestionGenerationRunRequestSchema,
  createWorkbookSourceSchema,
]);
export const responses = Object.freeze([
  badRequestResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictResponse,
  upstreamWorkbookResponse,
]);
export const params = Object.freeze([
  questionSetParam,
  questionBlueprintParam,
  questionBlueprintVersionParam,
  questionParam,
  questionGenerationRunParam,
]);

export const paths: Paths = {
  "/question-sets": {
    get: {
      tags: [tagRef(questionTag)],
      summary: "List question sets",
      operationId: "listQuestionSets",
      security: [keycloakSecurityRequirement],
      parameters: [
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", minimum: 1, maximum: 100 },
          required: false,
        },
        {
          name: "cursor",
          in: "query",
          schema: { type: "string" },
          required: false,
        },
      ],
      responses: {
        "200": {
          description: "Question sets.",
          content: {
            "application/json": {
              schema: schemaRef(listQuestionSetsResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
    },
    post: {
      tags: [tagRef(questionTag)],
      summary: "Create question set",
      operationId: "createQuestionSet",
      security: [keycloakSecurityRequirement],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: schemaRef(createQuestionSetRequestSchema),
          },
        },
      },
      responses: {
        "201": {
          description: "Question set created.",
          content: {
            "application/json": {
              schema: schemaRef(questionSetResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
    },
  },

  "/question-sets/{questionSetId}": {
    parameters: [paramRef(questionSetParam)],
    get: {
      tags: [tagRef(questionTag)],
      summary: "Get question set",
      operationId: "getQuestionSet",
      security: [keycloakSecurityRequirement],
      responses: {
        "200": {
          description: "Question set.",
          content: {
            "application/json": {
              schema: schemaRef(questionSetResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
    },
    patch: {
      tags: [tagRef(questionTag)],
      summary: "Update question set",
      operationId: "updateQuestionSet",
      security: [keycloakSecurityRequirement],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: schemaRef(updateQuestionSetRequestSchema),
          },
        },
      },
      responses: {
        "200": {
          description: "Question set updated.",
          content: {
            "application/json": {
              schema: schemaRef(questionSetResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
    },
    delete: {
      tags: [tagRef(questionTag)],
      summary: "Delete question set",
      operationId: "deleteQuestionSet",
      security: [keycloakSecurityRequirement],
      responses: {
        "204": { description: "No content" },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
      },
    },
  },

  "/question-sets/{questionSetId}/questions": {
    parameters: [paramRef(questionSetParam)],
    get: {
      tags: [tagRef(questionTag)],
      summary: "List question set questions",
      operationId: "listQuestionSetQuestions",
      security: [keycloakSecurityRequirement],
      parameters: [
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", minimum: 1, maximum: 100 },
          required: false,
        },
        {
          name: "cursor",
          in: "query",
          schema: { type: "string" },
          required: false,
        },
      ],
      responses: {
        "200": {
          description: "Question set questions.",
          content: {
            "application/json": {
              schema: schemaRef(listQuestionsResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
    },
  },
  "/question-sets/{questionSetId}/questions/{questionId}": {
    parameters: [paramRef(questionSetParam), paramRef(questionParam)],
    delete: {
      tags: [tagRef(questionTag)],
      summary: "Remove question from set",
      operationId: "removeQuestionFromSet",
      security: [keycloakSecurityRequirement],
      responses: {
        "204": { description: "No content" },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
      },
    },
  },
  "/question-blueprints": {
    get: {
      tags: [tagRef(questionTag)],
      summary: "List question blueprints",
      operationId: "listQuestionBlueprints",
      security: [keycloakSecurityRequirement],
      parameters: [
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", minimum: 1, maximum: 100 },
          required: false,
        },
        {
          name: "cursor",
          in: "query",
          schema: { type: "string" },
          required: false,
        },
        {
          name: "status",
          in: "query",
          schema: {
            type: "string",
            enum: QUESTION_BLUEPRINT_STATUS_ACCEPTED_VALUES as unknown as string[],
          },
          required: false,
        },
      ],
      responses: {
        "200": {
          description: "Question blueprints.",
          content: {
            "application/json": {
              schema: schemaRef(listQuestionBlueprintsResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
    },
    post: {
      tags: [tagRef(questionTag)],
      summary: "Create question blueprint",
      description:
        "Authoring-only. Request may include full blueprint document with value expressions and correct values; learner responses return a public blueprint view.",
      operationId: "createQuestionBlueprint",
      security: [keycloakSecurityRequirement],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: schemaRef(createQuestionBlueprintRequestSchema),
          },
        },
      },
      responses: {
        "201": {
          description: "Question blueprint created.",
          content: {
            "application/json": {
              schema: schemaRef(questionBlueprintResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
    },
  },
  "/question-blueprints/{questionBlueprintId}": {
    parameters: [paramRef(questionBlueprintParam)],
    get: {
      tags: [tagRef(questionTag)],
      summary: "Get question blueprint",
      operationId: "getQuestionBlueprint",
      security: [keycloakSecurityRequirement],
      responses: {
        "200": {
          description: "Question blueprint.",
          content: {
            "application/json": {
              schema: schemaRef(questionBlueprintResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
    },
    patch: {
      tags: [tagRef(questionTag)],
      summary: "Update question blueprint",
      description:
        "Authoring-only. Request may include full blueprint document with value expressions and correct values; learner responses return a public blueprint view.",
      operationId: "updateQuestionBlueprint",
      security: [keycloakSecurityRequirement],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: schemaRef(updateQuestionBlueprintRequestSchema),
          },
        },
      },
      responses: {
        "200": {
          description: "Question blueprint updated.",
          content: {
            "application/json": {
              schema: schemaRef(questionBlueprintResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
    },
    delete: {
      tags: [tagRef(questionTag)],
      summary: "Delete question blueprint",
      operationId: "deleteQuestionBlueprint",
      security: [keycloakSecurityRequirement],
      responses: {
        "204": { description: "No content" },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
      },
    },
  },
  "/question-blueprints/{questionBlueprintId}/authoring": {
    parameters: [paramRef(questionBlueprintParam)],
    get: {
      tags: [tagRef(questionTag)],
      summary: "Get question blueprint authoring data",
      description:
        "Authoring-only. Returns the private canonical blueprint document for editing.",
      operationId: "getQuestionBlueprintAuthoring",
      security: [keycloakSecurityRequirement],
      responses: {
        "200": {
          description: "Question blueprint authoring data.",
          content: {
            "application/json": {
              schema: schemaRef(questionBlueprintAuthoringResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
    },
  },
  "/question-blueprints/{questionBlueprintId}/versions": {
    parameters: [paramRef(questionBlueprintParam)],
    get: {
      tags: [tagRef(questionTag)],
      summary: "List question blueprint versions",
      description:
        "Authoring-only. Returns immutable version metadata and bound source assets.",
      operationId: "listQuestionBlueprintVersions",
      security: [keycloakSecurityRequirement],
      responses: {
        "200": {
          description: "Question blueprint versions.",
          content: {
            "application/json": {
              schema: schemaRef(listQuestionBlueprintVersionsResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
    },
  },
  "/question-blueprints/{questionBlueprintId}/versions/{questionBlueprintVersionId}/authoring":
    {
      parameters: [
        paramRef(questionBlueprintParam),
        paramRef(questionBlueprintVersionParam),
      ],
      get: {
        tags: [tagRef(questionTag)],
        summary: "Get question blueprint version authoring data",
        description:
          "Authoring-only. Returns the private canonical document and source assets from one immutable version.",
        operationId: "getQuestionBlueprintVersionAuthoring",
        security: [keycloakSecurityRequirement],
        responses: {
          "200": {
            description: "Question blueprint version authoring data.",
            content: {
              "application/json": {
                schema: schemaRef(questionBlueprintAuthoringResponseSchema),
              },
            },
          },
          "400": responseRef(badRequestResponse),
          "401": responseRef(unauthorizedResponse),
          "403": responseRef(forbiddenResponse),
          "404": responseRef(notFoundResponse),
          "409": responseRef(conflictResponse),
          "502": responseRef(upstreamWorkbookResponse),
        },
      },
    },

  "/questions": {
    get: {
      tags: [tagRef(questionTag)],
      summary: "List questions",
      operationId: "listQuestions",
      security: [keycloakSecurityRequirement],
      parameters: [
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", minimum: 1, maximum: 100 },
          required: false,
        },
        {
          name: "cursor",
          in: "query",
          schema: { type: "string" },
          required: false,
        },
        {
          name: "status",
          in: "query",
          schema: {
            type: "string",
            enum: QUESTION_STATUS_ACCEPTED_VALUES as unknown as string[],
          },
          required: false,
        },
        {
          name: "blueprintId",
          in: "query",
          schema: uuid,
          required: false,
        },
        {
          name: "generationRunId",
          in: "query",
          schema: uuid,
          required: false,
        },
      ],
      responses: {
        "200": {
          description: "Questions.",
          content: {
            "application/json": {
              schema: schemaRef(listQuestionsResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
    },
  },
  "/questions/{questionId}": {
    parameters: [paramRef(questionParam)],
    get: {
      tags: [tagRef(questionTag)],
      summary: "Get question",
      operationId: "getQuestion",
      security: [keycloakSecurityRequirement],
      responses: {
        "200": {
          description: "Question.",
          content: {
            "application/json": {
              schema: schemaRef(questionResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
    },
    delete: {
      tags: [tagRef(questionTag)],
      summary: "Delete question",
      operationId: "deleteQuestion",
      security: [keycloakSecurityRequirement],
      responses: {
        "204": { description: "No content" },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
      },
    },
  },

  "/questions/{questionId}/grade": {
    parameters: [paramRef(questionParam)],
    post: {
      tags: [tagRef(questionTag)],
      summary: "Grade question",
      operationId: "gradeQuestion",
      security: [keycloakSecurityRequirement],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: schemaRef(gradeQuestionRequestSchema),
          },
        },
      },
      responses: {
        "200": {
          description: "Question graded.",
          content: {
            "application/json": {
              schema: schemaRef(gradeQuestionResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
    },
  },

  "/question-generation-runs": {
    get: {
      tags: [tagRef(questionTag)],
      summary: "List question generation runs",
      operationId: "listQuestionGenerationRuns",
      security: [keycloakSecurityRequirement],
      parameters: [
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", minimum: 1, maximum: 100 },
          required: false,
        },
        {
          name: "cursor",
          in: "query",
          schema: { type: "string" },
          required: false,
        },
        {
          name: "status",
          in: "query",
          schema: {
            type: "string",
            enum: QUESTION_GENERATION_RUN_STATUS_ACCEPTED_VALUES as unknown as string[],
          },
          required: false,
        },
      ],
      responses: {
        "200": {
          description: "Question generation runs.",
          content: {
            "application/json": {
              schema: schemaRef(listQuestionGenerationRunsResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
    },
    post: {
      tags: [tagRef(questionTag)],
      summary: "Create question generation run",
      description: "Create a generation run from a saved blueprint version.",
      operationId: "createQuestionGenerationRun",
      security: [keycloakSecurityRequirement],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: schemaRef(createQuestionGenerationRunRequestSchema),
          },
        },
      },
      responses: {
        "201": {
          description: "Question generation run created.",
          content: {
            "application/json": {
              schema: schemaRef(questionGenerationRunResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
    },
  },
  "/question-generation-runs/{questionGenerationRunId}": {
    parameters: [paramRef(questionGenerationRunParam)],
    get: {
      tags: [tagRef(questionTag)],
      summary: "Get question generation run",
      operationId: "getQuestionGenerationRun",
      security: [keycloakSecurityRequirement],
      responses: {
        "200": {
          description: "Question generation run.",
          content: {
            "application/json": {
              schema: schemaRef(questionGenerationRunResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
    },
  },
  "/question-generation-runs/{questionGenerationRunId}/cancel": {
    parameters: [paramRef(questionGenerationRunParam)],
    post: {
      tags: [tagRef(questionTag)],
      summary: "Cancel question generation run",
      operationId: "cancelQuestionGenerationRun",
      security: [keycloakSecurityRequirement],
      responses: {
        "204": { description: "No content" },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
      },
    },
  },
  "/question-generation-runs/{questionGenerationRunId}/retry": {
    parameters: [paramRef(questionGenerationRunParam)],
    post: {
      tags: [tagRef(questionTag)],
      summary: "Retry question generation run",
      operationId: "retryQuestionGenerationRun",
      security: [keycloakSecurityRequirement],
      responses: {
        "201": {
          description: "Question generation run retried.",
          content: {
            "application/json": {
              schema: schemaRef(questionGenerationRunResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
    },
  },
};

export const openapi: OpenAPI = {
  openapi: "3.1.0",
  info: {
    title: "Lemma Questions API",
    version: "0.1.0",
  },
  tags: [questionTag],
  components: {
    securitySchemes: Object.fromEntries([
      [keycloakSecurityScheme.name, keycloakSecurityScheme.securitySchema],
    ]),
    parameters: Object.fromEntries(
      params.map((param) => [param.name, param.schema]),
    ),
    schemas: Object.fromEntries([
      ...schemas.map((schema) => [schema.name, schema.schema]),
      [errorResponseSchema.name, errorResponseSchema.schema],
    ]),
    responses: Object.fromEntries([
      ...responses.map((resp) => [resp.name, resp.schema]),
      [unauthorizedResponse.name, unauthorizedResponse.schema],
    ]),
  },
  paths,
};
