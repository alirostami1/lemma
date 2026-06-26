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
  description:
    "Question sets, question blueprints, question generation, and answer operations.",
  name: "Questions",
};

const jsonObject = { additionalProperties: true, type: "object" } as const;
const uuid = {
  pattern: UUID_V7_OPENAPI_PATTERN,
  type: "string",
} as const;
const nullableUuid = {
  example: "019e8278-6746-768e-b90b-3c6d2fb8267f",
  pattern: UUID_V7_OPENAPI_PATTERN,
  type: ["string", "null"],
} satisfies OpenApiSchema;
const dateTime = {
  format: "date-time",
  type: "string",
} satisfies OpenApiSchema;
const nullableDateTime = {
  format: "date-time",
  type: ["string", "null"],
} satisfies OpenApiSchema;

const questionValueExpressionSchema: Schema = {
  name: "QuestionValueExpression",
  schema: {
    oneOf: [
      {
        properties: {
          schemaVersion: { enum: [1], type: "number" },
          type: { enum: ["literal"], type: "string" },
          value: {},
        },
        required: ["schemaVersion", "type", "value"],
        type: "object",
      },
      {
        properties: {
          referenceId: { minLength: 1, type: "string" },
          schemaVersion: { enum: [1], type: "number" },
          type: { enum: ["reference"], type: "string" },
        },
        required: ["schemaVersion", "type", "referenceId"],
        type: "object",
      },
    ],
  },
};
const questionReferenceSourceSchema: Schema = {
  name: "QuestionReferenceSource",
  schema: {
    oneOf: [
      {
        properties: {
          schemaVersion: { enum: [1], type: "number" },
          type: { enum: ["literal"], type: "string" },
          value: {},
        },
        required: ["schemaVersion", "type", "value"],
        type: "object",
      },
      {
        properties: {
          ref: { type: "string" },
          schemaVersion: { enum: [1], type: "number" },
          sourceId: {
            description: "Blueprint-local workbook source identifier.",
            minLength: 1,
            type: "string",
          },
          type: { enum: ["workbook_cell", "workbook_range"] },
        },
        required: ["schemaVersion", "type", "sourceId", "ref"],
        type: "object",
      },
    ],
  },
};
const questionBlueprintDraftSourceSchema: Schema = {
  name: "QuestionBlueprintDraftSource",
  schema: {
    additionalProperties: false,
    properties: {
      byteSize: { minimum: 1, type: ["integer", "null"] },
      checksumSha256: {
        pattern: "^[a-f0-9]{64}$",
        type: ["string", "null"],
      },
      fileId: { format: "uuid", type: ["string", "null"] },
      name: { minLength: 1, type: "string" },
      originalName: { type: ["string", "null"] },
      sourceId: { pattern: "^[A-Za-z][A-Za-z0-9_-]*$", type: "string" },
      status: {
        enum: ["local", "uploaded", "validated", "invalid"],
        type: "string",
      },
      type: { enum: ["workbook"], type: "string" },
      workbookId: { format: "uuid", type: ["string", "null"] },
    },
    required: [
      "type",
      "sourceId",
      "name",
      "fileId",
      "workbookId",
      "status",
      "originalName",
      "byteSize",
      "checksumSha256",
    ],
    type: "object",
  },
};
const questionBlueprintDraftSourceIntentSchema: Schema = {
  name: "QuestionBlueprintDraftSourceIntent",
  schema: {
    additionalProperties: false,
    properties: {
      name: { minLength: 1, type: "string" },
      sourceId: { pattern: "^[A-Za-z][A-Za-z0-9_-]*$", type: "string" },
      type: { enum: ["workbook"], type: "string" },
    },
    required: ["type", "sourceId", "name"],
    type: "object",
  },
};
const questionBlueprintVersionSourceSchema: Schema = {
  name: "QuestionBlueprintVersionSource",
  schema: {
    additionalProperties: false,
    properties: {
      byteSize: { minimum: 1, type: ["integer", "null"] },
      checksumSha256: {
        pattern: "^[a-f0-9]{64}$",
        type: ["string", "null"],
      },
      fileId: { format: "uuid", type: ["string", "null"] },
      name: { minLength: 1, type: "string" },
      originalName: { type: ["string", "null"] },
      sourceId: { pattern: "^[A-Za-z][A-Za-z0-9_-]*$", type: "string" },
      type: { enum: ["workbook"], type: "string" },
      workbookId: { format: "uuid", type: "string" },
    },
    required: [
      "type",
      "sourceId",
      "name",
      "fileId",
      "workbookId",
      "originalName",
      "byteSize",
      "checksumSha256",
    ],
    type: "object",
  },
};
const blueprintInlineTextSchema: Schema = {
  name: "BlueprintInlineText",
  schema: {
    additionalProperties: false,
    properties: {
      text: { type: "string" },
      type: { enum: ["text"], type: "string" },
    },
    required: ["type", "text"],
    type: "object",
  },
};
const blueprintInlineReferenceSchema: Schema = {
  name: "BlueprintInlineReference",
  schema: {
    additionalProperties: false,
    properties: {
      fallbackText: { type: "string" },
      rangeCell: {
        additionalProperties: false,
        properties: {
          columnOffset: { minimum: 0, type: "integer" },
          rowOffset: { minimum: 0, type: "integer" },
        },
        required: ["rowOffset", "columnOffset"],
        type: "object",
      },
      referenceId: { minLength: 1, type: "string" },
      type: { enum: ["reference"], type: "string" },
    },
    required: ["type", "referenceId"],
    type: "object",
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
    additionalProperties: false,
    properties: {
      text: { type: "string" },
      type: { enum: ["text"], type: "string" },
    },
    required: ["type", "text"],
    type: "object",
  },
};
const renderedInlineValueSchema: Schema = {
  name: "RenderedInlineValue",
  schema: {
    additionalProperties: false,
    properties: {
      displayValue: { type: "string" },
      referenceId: { minLength: 1, type: "string" },
      type: { enum: ["value"], type: "string" },
    },
    required: ["type", "referenceId", "displayValue"],
    type: "object",
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
    additionalProperties: false,
    properties: {
      text: { type: "string" },
      type: { enum: ["text"], type: "string" },
    },
    required: ["type", "text"],
    type: "object",
  },
};
const richParagraphNodeSchema: Schema = {
  name: "RichParagraphNode",
  schema: {
    additionalProperties: false,
    properties: {
      content: { items: schemaRef(richTextNodeSchema), type: "array" },
      type: { enum: ["paragraph"], type: "string" },
    },
    required: ["type"],
    type: "object",
  },
};
const richHeadingNodeSchema: Schema = {
  name: "RichHeadingNode",
  schema: {
    additionalProperties: false,
    properties: {
      attrs: {
        additionalProperties: false,
        properties: { level: { maximum: 6, minimum: 1, type: "integer" } },
        required: ["level"],
        type: "object",
      },
      content: { items: schemaRef(richTextNodeSchema), type: "array" },
      type: { enum: ["heading"], type: "string" },
    },
    required: ["type", "attrs"],
    type: "object",
  },
};
const richListItemNodeSchema: Schema = {
  name: "RichListItemNode",
  schema: {
    additionalProperties: false,
    properties: {
      content: {
        items: {
          oneOf: [
            schemaRef(richParagraphNodeSchema),
            { $ref: "#/components/schemas/RichBulletListNode" },
            { $ref: "#/components/schemas/RichOrderedListNode" },
          ],
        },
        type: "array",
      },
      type: { enum: ["list_item"], type: "string" },
    },
    required: ["type", "content"],
    type: "object",
  },
};
const richBulletListNodeSchema: Schema = {
  name: "RichBulletListNode",
  schema: {
    additionalProperties: false,
    properties: {
      content: { items: schemaRef(richListItemNodeSchema), type: "array" },
      type: { enum: ["bullet_list"], type: "string" },
    },
    required: ["type", "content"],
    type: "object",
  },
};
const richOrderedListNodeSchema: Schema = {
  name: "RichOrderedListNode",
  schema: {
    additionalProperties: false,
    properties: {
      content: { items: schemaRef(richListItemNodeSchema), type: "array" },
      type: { enum: ["ordered_list"], type: "string" },
    },
    required: ["type", "content"],
    type: "object",
  },
};
const richContentSchema: Schema = {
  name: "RichContent",
  schema: {
    additionalProperties: false,
    properties: {
      content: {
        items: {
          oneOf: [
            schemaRef(richParagraphNodeSchema),
            schemaRef(richHeadingNodeSchema),
            schemaRef(richBulletListNodeSchema),
            schemaRef(richOrderedListNodeSchema),
          ],
        },
        type: "array",
      },
      type: { enum: ["doc"], type: "string" },
    },
    required: ["type", "content"],
    type: "object",
  },
};
const responseFieldSchema: Schema = {
  name: "QuestionResponseField",
  schema: {
    properties: {
      id: { type: "string" },
      label: { type: "string" },
      required: { type: "boolean" },
      type: { enum: ["text", "number", "boolean"], type: "string" },
    },
    required: ["id", "type"],
    type: "object",
  },
};
const questionTextBlockSchema: Schema = {
  name: "QuestionTextBlock",
  schema: {
    additionalProperties: false,
    properties: {
      content: { items: schemaRef(renderedInlineContentSchema), type: "array" },
      id: { minLength: 1, type: "string" },
      type: { enum: ["text"], type: "string" },
    },
    required: ["id", "type", "content"],
    type: "object",
  },
};

const questionBlueprintTextBlockSchema: Schema = {
  name: "QuestionBlueprintTextBlock",
  schema: {
    additionalProperties: false,
    properties: {
      content: {
        items: schemaRef(blueprintInlineContentSchema),
        type: "array",
      },
      id: { minLength: 1, type: "string" },
      type: { enum: ["text"], type: "string" },
    },
    required: ["id", "type", "content"],
    type: "object",
  },
};
const publicQuestionBlueprintTextBlockSchema: Schema = {
  name: "PublicQuestionBlueprintTextBlock",
  schema: {
    additionalProperties: false,
    properties: {
      content: { items: schemaRef(blueprintInlineTextSchema), type: "array" },
      id: { minLength: 1, type: "string" },
      type: { enum: ["text"], type: "string" },
    },
    required: ["id", "type", "content"],
    type: "object",
  },
};

const questionRichTextBlockSchema: Schema = {
  name: "QuestionRichTextBlock",
  schema: {
    additionalProperties: false,
    properties: {
      content: schemaRef(richContentSchema),
      id: { minLength: 1, type: "string" },
      type: { enum: ["rich_text"], type: "string" },
    },
    required: ["id", "type", "content"],
    type: "object",
  },
};
const questionSeparatorBlockSchema: Schema = {
  name: "QuestionSeparatorBlock",
  schema: {
    additionalProperties: false,
    properties: {
      id: { minLength: 1, type: "string" },
      type: { enum: ["separator"], type: "string" },
    },
    required: ["id", "type"],
    type: "object",
  },
};
const questionResponseBlockSchema: Schema = {
  name: "QuestionResponseBlock",
  schema: {
    additionalProperties: false,
    properties: {
      id: { minLength: 1, type: "string" },
      label: { type: "string" },
      placeholder: { type: "string" },
      responseFieldId: { minLength: 1, type: "string" },
      type: { enum: ["response"], type: "string" },
    },
    required: ["id", "type", "responseFieldId"],
    type: "object",
  },
};
const questionReferenceSchema: Schema = {
  name: "QuestionReference",
  schema: {
    additionalProperties: false,
    properties: {
      id: { minLength: 1, type: "string" },
      label: { type: "string" },
      source: schemaRef(questionReferenceSourceSchema),
    },
    required: ["id", "source"],
    type: "object",
  },
};
const questionTableColumnSchema: Schema = {
  name: "QuestionTableColumn",
  schema: {
    additionalProperties: false,
    properties: {
      id: { minLength: 1, type: "string" },
      label: { minLength: 1, type: "string" },
    },
    required: ["id", "label"],
    type: "object",
  },
};
const questionTableRowSchema: Schema = {
  name: "QuestionTableRow",
  schema: {
    additionalProperties: false,
    properties: {
      id: { minLength: 1, type: "string" },
      label: { minLength: 1, type: "string" },
    },
    required: ["id", "label"],
    type: "object",
  },
};
const questionTableContentCellSchema: Schema = {
  name: "QuestionTableContentCell",
  schema: {
    additionalProperties: false,
    properties: {
      columnId: { minLength: 1, type: "string" },
      id: { minLength: 1, type: "string" },
      rowId: { minLength: 1, type: "string" },
      text: { type: "string" },
      type: { enum: ["content"], type: "string" },
    },
    required: ["id", "rowId", "columnId", "type", "text"],
    type: "object",
  },
};
const questionTableResponseCellSchema: Schema = {
  name: "QuestionTableResponseCell",
  schema: {
    additionalProperties: false,
    properties: {
      columnId: { minLength: 1, type: "string" },
      id: { minLength: 1, type: "string" },
      label: { type: "string" },
      placeholder: { type: "string" },
      responseFieldId: { minLength: 1, type: "string" },
      rowId: { minLength: 1, type: "string" },
      type: { enum: ["response"], type: "string" },
    },
    required: ["id", "rowId", "columnId", "type", "responseFieldId"],
    type: "object",
  },
};
const questionTableBlockSchema: Schema = {
  name: "QuestionTableBlock",
  schema: {
    additionalProperties: false,
    properties: {
      cells: {
        items: {
          oneOf: [
            schemaRef(questionTableContentCellSchema),
            schemaRef(questionTableResponseCellSchema),
          ],
        },
        type: "array",
      },
      columns: {
        items: schemaRef(questionTableColumnSchema),
        type: "array",
      },
      id: { minLength: 1, type: "string" },
      rows: {
        items: schemaRef(questionTableRowSchema),
        type: "array",
      },
      showColumnNames: { type: "boolean" },
      showRowNames: { type: "boolean" },
      type: { enum: ["table"], type: "string" },
    },
    required: [
      "id",
      "type",
      "showColumnNames",
      "showRowNames",
      "columns",
      "rows",
      "cells",
    ],
    type: "object",
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
    properties: {
      blocks: { items: schemaRef(questionBlockSchema), type: "array" },
      responseFields: { items: schemaRef(responseFieldSchema), type: "array" },
      schemaVersion: { enum: [1], type: "number" },
    },
    required: ["schemaVersion", "blocks", "responseFields"],
    type: "object",
  },
};
const questionBlueprintTableContentCellSchema: Schema = {
  name: "QuestionBlueprintTableContentCell",
  schema: {
    additionalProperties: false,
    properties: {
      columnId: { minLength: 1, type: "string" },
      content: {
        items: schemaRef(blueprintInlineContentSchema),
        type: "array",
      },
      id: { minLength: 1, type: "string" },
      rowId: { minLength: 1, type: "string" },
      type: { enum: ["content"], type: "string" },
    },
    required: ["id", "rowId", "columnId", "type", "content"],
    type: "object",
  },
};
const gradingSchema: Schema = {
  name: "QuestionBlueprintGrading",
  schema: {
    oneOf: [
      {
        additionalProperties: false,
        properties: { mode: { enum: ["exact"], type: "string" } },
        required: ["mode"],
        type: "object",
      },
      {
        additionalProperties: false,
        properties: {
          mode: { enum: ["number"], type: "string" },
          tolerance: {
            additionalProperties: false,
            properties: {
              type: { enum: ["absolute", "relative"], type: "string" },
              value: { minimum: 0, type: "number" },
            },
            required: ["type", "value"],
            type: "object",
          },
        },
        required: ["mode", "tolerance"],
        type: "object",
      },
      {
        additionalProperties: false,
        properties: {
          mode: { enum: ["case_insensitive_text"], type: "string" },
        },
        required: ["mode"],
        type: "object",
      },
      {
        additionalProperties: false,
        properties: { mode: { enum: ["manual"], type: "string" } },
        required: ["mode"],
        type: "object",
      },
    ],
  },
};
const questionBlueprintTableResponseCellSchema: Schema = {
  name: "QuestionBlueprintTableResponseCell",
  schema: {
    additionalProperties: false,
    properties: {
      columnId: { minLength: 1, type: "string" },
      correctValueSource: schemaRef(questionValueExpressionSchema),
      grading: schemaRef(gradingSchema),
      id: { minLength: 1, type: "string" },
      label: { type: "string" },
      placeholder: { type: "string" },
      points: { exclusiveMinimum: 0, type: "number" },
      responseFieldId: { minLength: 1, type: "string" },
      rowId: { minLength: 1, type: "string" },
      type: { enum: ["response"], type: "string" },
    },
    required: [
      "id",
      "rowId",
      "columnId",
      "type",
      "responseFieldId",
      "points",
      "grading",
    ],
    type: "object",
  },
};
const questionBlueprintResponseBlockSchema: Schema = {
  name: "QuestionBlueprintResponseBlock",
  schema: {
    additionalProperties: false,
    properties: {
      correctValueSource: schemaRef(questionValueExpressionSchema),
      grading: schemaRef(gradingSchema),
      id: { minLength: 1, type: "string" },
      label: { type: "string" },
      placeholder: { type: "string" },
      points: { exclusiveMinimum: 0, type: "number" },
      responseFieldId: { minLength: 1, type: "string" },
      type: { enum: ["response"], type: "string" },
    },
    required: ["id", "type", "responseFieldId", "points", "grading"],
    type: "object",
  },
};
const publicQuestionBlueprintResponseBlockSchema: Schema = {
  name: "PublicQuestionBlueprintResponseBlock",
  schema: {
    additionalProperties: false,
    properties: {
      id: { minLength: 1, type: "string" },
      label: { type: "string" },
      placeholder: { type: "string" },
      responseFieldId: { minLength: 1, type: "string" },
      type: { enum: ["response"], type: "string" },
    },
    required: ["id", "type", "responseFieldId"],
    type: "object",
  },
};
const publicQuestionBlueprintTableResponseCellSchema: Schema = {
  name: "PublicQuestionBlueprintTableResponseCell",
  schema: {
    additionalProperties: false,
    properties: {
      columnId: { minLength: 1, type: "string" },
      id: { minLength: 1, type: "string" },
      label: { type: "string" },
      placeholder: { type: "string" },
      responseFieldId: { minLength: 1, type: "string" },
      rowId: { minLength: 1, type: "string" },
      type: { enum: ["response"], type: "string" },
    },
    required: ["id", "rowId", "columnId", "type", "responseFieldId"],
    type: "object",
  },
};
const publicQuestionBlueprintTableContentCellSchema: Schema = {
  name: "PublicQuestionBlueprintTableContentCell",
  schema: {
    additionalProperties: false,
    properties: {
      columnId: { minLength: 1, type: "string" },
      content: { items: schemaRef(blueprintInlineTextSchema), type: "array" },
      id: { minLength: 1, type: "string" },
      rowId: { minLength: 1, type: "string" },
      type: { enum: ["content"], type: "string" },
    },
    required: ["id", "rowId", "columnId", "type", "content"],
    type: "object",
  },
};
const questionBlueprintTableBlockSchema: Schema = {
  name: "QuestionBlueprintTableBlock",
  schema: {
    additionalProperties: false,
    properties: {
      cells: {
        items: {
          oneOf: [
            schemaRef(questionBlueprintTableContentCellSchema),
            schemaRef(questionBlueprintTableResponseCellSchema),
          ],
        },
        type: "array",
      },
      columns: {
        items: schemaRef(questionTableColumnSchema),
        type: "array",
      },
      id: { minLength: 1, type: "string" },
      rows: {
        items: schemaRef(questionTableRowSchema),
        type: "array",
      },
      showColumnNames: { type: "boolean" },
      showRowNames: { type: "boolean" },
      type: { enum: ["table"], type: "string" },
    },
    required: [
      "id",
      "type",
      "showColumnNames",
      "showRowNames",
      "columns",
      "rows",
      "cells",
    ],
    type: "object",
  },
};
const publicQuestionBlueprintTableBlockSchema: Schema = {
  name: "PublicQuestionBlueprintTableBlock",
  schema: {
    additionalProperties: false,
    properties: {
      cells: {
        items: {
          oneOf: [
            schemaRef(publicQuestionBlueprintTableContentCellSchema),
            schemaRef(publicQuestionBlueprintTableResponseCellSchema),
          ],
        },
        type: "array",
      },
      columns: {
        items: schemaRef(questionTableColumnSchema),
        type: "array",
      },
      id: { minLength: 1, type: "string" },
      rows: {
        items: schemaRef(questionTableRowSchema),
        type: "array",
      },
      showColumnNames: { type: "boolean" },
      showRowNames: { type: "boolean" },
      type: { enum: ["table"], type: "string" },
    },
    required: [
      "id",
      "type",
      "showColumnNames",
      "showRowNames",
      "columns",
      "rows",
      "cells",
    ],
    type: "object",
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
    properties: {
      blocks: {
        items: schemaRef(questionBlueprintBlockSchema),
        type: "array",
      },
      references: { items: schemaRef(questionReferenceSchema), type: "array" },
      responseFields: { items: schemaRef(responseFieldSchema), type: "array" },
      schemaVersion: { enum: [1], type: "number" },
    },
    required: ["schemaVersion", "blocks", "responseFields", "references"],
    type: "object",
  },
};
const publicQuestionBlueprintDocumentSchema: Schema = {
  name: "PublicQuestionBlueprintDocument",
  schema: {
    properties: {
      blocks: {
        items: schemaRef(publicQuestionBlueprintBlockSchema),
        type: "array",
      },
      responseFields: { items: schemaRef(responseFieldSchema), type: "array" },
      schemaVersion: { enum: [1], type: "number" },
    },
    required: ["schemaVersion", "blocks", "responseFields"],
    type: "object",
  },
};
const questionProducerSchema: Schema = {
  name: "QuestionProducer",
  schema: {
    additionalProperties: false,
    properties: {
      compiler: { type: "string" },
      schemaVersion: { enum: [1], type: "number" },
      source: jsonObject,
    },
    required: ["schemaVersion", "compiler"],
    type: "object",
  },
};
const questionAnswerSchema: Schema = {
  name: "QuestionAnswer",
  schema: {
    properties: {
      responses: {
        items: {
          properties: { responseFieldId: { type: "string" }, value: {} },
          required: ["responseFieldId", "value"],
          type: "object",
        },
        type: "array",
      },
      schemaVersion: { enum: [1], type: "number" },
    },
    required: ["schemaVersion", "responses"],
    type: "object",
  },
};

const gradeResultSchema: Schema = {
  name: "GradeResult",
  schema: {
    properties: {
      details: { items: jsonObject, type: "array" },
      earnedPoints: { type: "number" },
      graderVersion: { type: "string" },
      schemaVersion: { enum: [1], type: "number" },
      status: { enum: ["graded", "needs_manual_review"], type: "string" },
      totalPoints: { type: "number" },
    },
    required: [
      "schemaVersion",
      "totalPoints",
      "earnedPoints",
      "status",
      "details",
      "graderVersion",
    ],
    type: "object",
  },
};

const questionSetSchema: Schema = {
  name: "QuestionSet",
  schema: {
    properties: {
      createdAt: dateTime,
      createdByUserId: uuid,
      description: {
        maxLength: MAX_QUESTION_DESCRIPTION_LENGTH,
        type: ["string", "null"],
      },
      id: uuid,
      name: {
        maxLength: MAX_QUESTION_NAME_LENGTH,
        minLength: 1,
        type: "string",
      },
      ownerUserId: uuid,
      status: {
        enum: [...QUESTION_SET_STATUS_ACCEPTED_VALUES],
        type: "string",
      },
      updatedAt: dateTime,
    },
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
    type: "object",
  },
};

const questionBlueprintSchema: Schema = {
  name: "QuestionBlueprint",
  schema: {
    properties: {
      archivedAt: nullableDateTime,
      createdAt: dateTime,
      createdByUserId: uuid,
      currentVersionId: uuid,
      description: {
        maxLength: MAX_QUESTION_DESCRIPTION_LENGTH,
        type: ["string", "null"],
      },
      document: schemaRef(publicQuestionBlueprintDocumentSchema),
      id: uuid,
      name: {
        maxLength: MAX_QUESTION_NAME_LENGTH,
        minLength: 1,
        type: "string",
      },
      ownerUserId: uuid,
      sources: {
        description:
          "Blueprint-local source entries attached to this blueprint.",
        items: schemaRef(questionBlueprintVersionSourceSchema),
        type: "array",
      },
      status: {
        enum: [...QUESTION_BLUEPRINT_STATUS_ACCEPTED_VALUES],
        type: "string",
      },
      updatedAt: dateTime,
      visibility: {
        enum: [...QUESTION_BLUEPRINT_VISIBILITY_ACCEPTED_VALUES],
        type: "string",
      },
    },
    required: [
      "id",
      "ownerUserId",
      "createdByUserId",
      "currentVersionId",
      "name",
      "description",
      "document",
      "sources",
      "visibility",
      "status",
      "archivedAt",
      "createdAt",
      "updatedAt",
    ],
    type: "object",
  },
};

const questionBlueprintAuthoringSchema: Schema = {
  name: "QuestionBlueprintAuthoring",
  schema: {
    properties: {
      archivedAt: nullableDateTime,
      createdAt: dateTime,
      createdByUserId: uuid,
      currentVersionId: uuid,
      description: {
        maxLength: MAX_QUESTION_DESCRIPTION_LENGTH,
        type: ["string", "null"],
      },
      document: schemaRef(questionBlueprintDocumentSchema),
      id: uuid,
      name: {
        maxLength: MAX_QUESTION_NAME_LENGTH,
        minLength: 1,
        type: "string",
      },
      ownerUserId: uuid,
      sources: {
        description:
          "Blueprint-local source entries attached to this blueprint.",
        items: schemaRef(questionBlueprintVersionSourceSchema),
        type: "array",
      },
      status: {
        enum: [...QUESTION_BLUEPRINT_STATUS_ACCEPTED_VALUES],
        type: "string",
      },
      updatedAt: dateTime,
      visibility: {
        enum: [...QUESTION_BLUEPRINT_VISIBILITY_ACCEPTED_VALUES],
        type: "string",
      },
    },
    required: [
      "id",
      "ownerUserId",
      "createdByUserId",
      "currentVersionId",
      "name",
      "description",
      "document",
      "sources",
      "visibility",
      "status",
      "archivedAt",
      "createdAt",
      "updatedAt",
    ],
    type: "object",
  },
};
const questionBlueprintDraftSchema: Schema = {
  name: "QuestionBlueprintDraft",
  schema: {
    additionalProperties: false,
    properties: {
      baseVersionId: nullableUuid,
      blueprintId: nullableUuid,
      createdAt: dateTime,
      createdByUserId: uuid,
      description: {
        maxLength: MAX_QUESTION_DESCRIPTION_LENGTH,
        type: ["string", "null"],
      },
      discardedAt: nullableDateTime,
      document: schemaRef(questionBlueprintDocumentSchema),
      id: uuid,
      lastSavedAt: dateTime,
      name: {
        maxLength: MAX_QUESTION_NAME_LENGTH,
        minLength: 1,
        type: "string",
      },
      ownerUserId: uuid,
      publishedAt: nullableDateTime,
      publishedVersionId: nullableUuid,
      revision: { minimum: 1, type: "integer" },
      sources: {
        items: schemaRef(questionBlueprintDraftSourceSchema),
        type: "array",
      },
      status: {
        enum: ["draft", "publishing", "published", "discarded"],
        type: "string",
      },
      updatedAt: dateTime,
    },
    required: [
      "id",
      "ownerUserId",
      "createdByUserId",
      "revision",
      "blueprintId",
      "baseVersionId",
      "publishedVersionId",
      "name",
      "description",
      "document",
      "sources",
      "status",
      "lastSavedAt",
      "publishedAt",
      "discardedAt",
      "createdAt",
      "updatedAt",
    ],
    type: "object",
  },
};

const questionBlueprintVersionSchema: Schema = {
  name: "QuestionBlueprintVersion",
  schema: {
    additionalProperties: false,
    properties: {
      blueprintId: uuid,
      createdAt: dateTime,
      createdByUserId: uuid,
      description: {
        maxLength: MAX_QUESTION_DESCRIPTION_LENGTH,
        type: ["string", "null"],
      },
      document: schemaRef(questionBlueprintDocumentSchema),
      id: uuid,
      name: {
        maxLength: MAX_QUESTION_NAME_LENGTH,
        minLength: 1,
        type: "string",
      },
      ownerUserId: uuid,
      parentVersionId: nullableUuid,
      publishedAt: dateTime,
      sources: {
        description:
          "Immutable blueprint-local source entries pinned by this version.",
        items: schemaRef(questionBlueprintVersionSourceSchema),
        type: "array",
      },
      versionNumber: { minimum: 1, type: "integer" },
    },
    required: [
      "id",
      "blueprintId",
      "versionNumber",
      "parentVersionId",
      "ownerUserId",
      "createdByUserId",
      "name",
      "description",
      "document",
      "sources",
      "publishedAt",
      "createdAt",
    ],
    type: "object",
  },
};
const questionSchema: Schema = {
  name: "Question",
  schema: {
    properties: {
      blueprintId: uuid,
      body: schemaRef(questionBodySchema),
      createdAt: dateTime,
      createdByUserId: uuid,
      generationRunId: uuid,
      id: uuid,
      ownerUserId: uuid,
      producer: schemaRef(questionProducerSchema),
      status: {
        enum: [...QUESTION_STATUS_ACCEPTED_VALUES],
        type: "string",
      },
      updatedAt: dateTime,
    },
    required: [
      "id",
      "ownerUserId",
      "createdByUserId",
      "blueprintId",
      "generationRunId",
      "body",
      "producer",
      "status",
      "createdAt",
      "updatedAt",
    ],
    type: "object",
  },
};

const questionGenerationRunSchema: Schema = {
  name: "QuestionGenerationRun",
  schema: {
    properties: {
      attemptNumber: { minimum: 1, type: "integer" },
      attempts: { minimum: 0, type: "integer" },
      blueprintId: uuid,
      createdAt: dateTime,
      createdByUserId: uuid,
      errorMessage: { type: ["string", "null"] },
      finishedAt: nullableDateTime,
      id: uuid,
      ownerUserId: uuid,
      requestedCount: {
        maximum: MAX_GENERATION_RUN_COUNT,
        minimum: 1,
        type: "integer",
      },
      result: {
        oneOf: [
          {
            properties: { questionIds: { items: uuid, type: "array" } },
            required: ["questionIds"],
            type: "object",
          },
          { type: "null" },
        ],
      },
      retryOfRunId: nullableUuid,
      startedAt: nullableDateTime,
      status: {
        enum: [...QUESTION_GENERATION_RUN_STATUS_ACCEPTED_VALUES],
        type: "string",
      },
      targetQuestionSetId: uuid,
      updatedAt: dateTime,
      workbookCalculationId: nullableUuid,
    },
    required: [
      "id",
      "ownerUserId",
      "createdByUserId",
      "blueprintId",
      "targetQuestionSetId",
      "requestedCount",
      "workbookCalculationId",
      "retryOfRunId",
      "attemptNumber",
      "status",
      "result",
      "errorMessage",
      "attempts",
      "startedAt",
      "finishedAt",
      "createdAt",
      "updatedAt",
    ],
    type: "object",
  },
};

const listQuestionSetsResponseSchema: Schema = {
  name: "ListQuestionSetsResponse",
  schema: {
    properties: {
      nextCursor: {
        type: ["string", "null"],
      },
      questionSets: {
        items: schemaRef(questionSetSchema),
        type: "array",
      },
    },
    required: ["questionSets", "nextCursor"],
    type: "object",
  },
};
const questionSetResponseSchema: Schema = {
  name: "QuestionSetResponse",
  schema: {
    properties: {
      questionSet: schemaRef(questionSetSchema),
    },
    required: ["questionSet"],
    type: "object",
  },
};
const listQuestionBlueprintsResponseSchema: Schema = {
  name: "ListQuestionBlueprintsResponse",
  schema: {
    properties: {
      nextCursor: {
        type: ["string", "null"],
      },
      questionBlueprints: {
        items: schemaRef(questionBlueprintSchema),
        type: "array",
      },
    },
    required: ["questionBlueprints", "nextCursor"],
    type: "object",
  },
};
const questionBlueprintResponseSchema: Schema = {
  name: "QuestionBlueprintResponse",
  schema: {
    properties: {
      questionBlueprint: schemaRef(questionBlueprintSchema),
    },
    required: ["questionBlueprint"],
    type: "object",
  },
};
const questionBlueprintAuthoringResponseSchema: Schema = {
  name: "QuestionBlueprintAuthoringResponse",
  schema: {
    properties: {
      questionBlueprint: schemaRef(questionBlueprintAuthoringSchema),
    },
    required: ["questionBlueprint"],
    type: "object",
  },
};
const questionBlueprintDraftResponseSchema: Schema = {
  name: "QuestionBlueprintDraftResponse",
  schema: {
    properties: { draft: schemaRef(questionBlueprintDraftSchema) },
    required: ["draft"],
    type: "object",
  },
};
const questionBlueprintEditDraftResponseSchema: Schema = {
  name: "QuestionBlueprintEditDraftResponse",
  schema: {
    properties: {
      draft: schemaRef(questionBlueprintDraftSchema),
      resolution: { enum: ["created", "resumed"], type: "string" },
    },
    required: ["draft", "resolution"],
    type: "object",
  },
};
const listQuestionBlueprintDraftsResponseSchema: Schema = {
  name: "ListQuestionBlueprintDraftsResponse",
  schema: {
    properties: {
      drafts: { items: schemaRef(questionBlueprintDraftSchema), type: "array" },
      nextCursor: { type: ["string", "null"] },
    },
    required: ["drafts", "nextCursor"],
    type: "object",
  },
};
const publishQuestionBlueprintDraftResponseSchema: Schema = {
  name: "PublishQuestionBlueprintDraftResponse",
  schema: {
    properties: {
      draft: schemaRef(questionBlueprintDraftSchema),
      questionBlueprint: schemaRef(questionBlueprintSchema),
      questionBlueprintVersion: schemaRef(questionBlueprintVersionSchema),
    },
    required: ["draft", "questionBlueprint", "questionBlueprintVersion"],
    type: "object",
  },
};
const listQuestionsResponseSchema: Schema = {
  name: "ListQuestionsResponse",
  schema: {
    properties: {
      nextCursor: {
        type: ["string", "null"],
      },
      questions: {
        items: schemaRef(questionSchema),
        type: "array",
      },
    },
    required: ["questions", "nextCursor"],
    type: "object",
  },
};
const questionResponseSchema: Schema = {
  name: "QuestionResponse",
  schema: {
    properties: {
      question: schemaRef(questionSchema),
    },
    required: ["question"],
    type: "object",
  },
};
const listQuestionGenerationRunsResponseSchema: Schema = {
  name: "ListQuestionGenerationRunsResponse",
  schema: {
    properties: {
      nextCursor: {
        type: ["string", "null"],
      },
      questionGenerationRuns: {
        items: schemaRef(questionGenerationRunSchema),
        type: "array",
      },
    },
    required: ["questionGenerationRuns", "nextCursor"],
    type: "object",
  },
};
const questionGenerationRunResponseSchema: Schema = {
  name: "QuestionGenerationRunResponse",
  schema: {
    properties: {
      questionGenerationRun: schemaRef(questionGenerationRunSchema),
    },
    required: ["questionGenerationRun"],
    type: "object",
  },
};
const gradeQuestionResponseSchema: Schema = {
  name: "GradeQuestionResponse",
  schema: {
    properties: { grade: schemaRef(gradeResultSchema) },
    required: ["grade"],
    type: "object",
  },
};

const createQuestionSetRequestSchema: Schema = {
  name: "CreateQuestionSetRequest",
  schema: {
    additionalProperties: false,
    properties: {
      description: {
        maxLength: MAX_QUESTION_DESCRIPTION_LENGTH,
        type: ["string", "null"],
      },
      name: {
        maxLength: MAX_QUESTION_NAME_LENGTH,
        minLength: 1,
        type: "string",
      },
    },
    required: ["name"],
    type: "object",
  },
};
const updateQuestionSetRequestSchema: Schema = {
  name: "UpdateQuestionSetRequest",
  schema: {
    additionalProperties: false,
    minProperties: 1,
    properties: {
      description: {
        maxLength: MAX_QUESTION_DESCRIPTION_LENGTH,
        type: ["string", "null"],
      },
      name: {
        maxLength: MAX_QUESTION_NAME_LENGTH,
        minLength: 1,
        type: "string",
      },
      status: {
        enum: [...QUESTION_SET_STATUS_ACCEPTED_VALUES],
        type: "string",
      },
    },
    type: "object",
  },
};
const createQuestionBlueprintDraftRequestSchema: Schema = {
  name: "CreateQuestionBlueprintDraftRequest",
  schema: {
    additionalProperties: false,
    properties: {
      blueprintId: nullableUuid,
      description: {
        maxLength: MAX_QUESTION_DESCRIPTION_LENGTH,
        type: ["string", "null"],
      },
      document: schemaRef(questionBlueprintDocumentSchema),
      name: {
        maxLength: MAX_QUESTION_NAME_LENGTH,
        minLength: 1,
        type: "string",
      },
      sources: {
        items: schemaRef(questionBlueprintDraftSourceIntentSchema),
        type: "array",
      },
    },
    required: ["name", "document", "sources"],
    type: "object",
  },
};
const createQuestionBlueprintEditDraftRequestSchema: Schema = {
  name: "CreateQuestionBlueprintEditDraftRequest",
  schema: {
    additionalProperties: false,
    properties: {
      mode: { enum: ["resume_or_create"], type: "string" },
    },
    type: "object",
  },
};
const updateQuestionBlueprintDraftRequestSchema: Schema = {
  name: "UpdateQuestionBlueprintDraftRequest",
  schema: {
    additionalProperties: false,
    properties: {
      expectedRevision: { minimum: 1, type: "integer" },
      description: {
        maxLength: MAX_QUESTION_DESCRIPTION_LENGTH,
        type: ["string", "null"],
      },
      document: schemaRef(questionBlueprintDocumentSchema),
      name: {
        maxLength: MAX_QUESTION_NAME_LENGTH,
        minLength: 1,
        type: "string",
      },
      sources: {
        items: schemaRef(questionBlueprintDraftSourceIntentSchema),
        type: "array",
      },
    },
    required: [
      "expectedRevision",
      "name",
      "description",
      "document",
      "sources",
    ],
    type: "object",
  },
};
const publishQuestionBlueprintDraftRequestSchema: Schema = {
  name: "PublishQuestionBlueprintDraftRequest",
  schema: {
    additionalProperties: false,
    properties: {
      expectedRevision: { minimum: 1, type: "integer" },
      idempotencyKey: { maxLength: 128, minLength: 1, type: "string" },
    },
    required: ["expectedRevision", "idempotencyKey"],
    type: "object",
  },
};
const discardQuestionBlueprintDraftRequestSchema: Schema = {
  name: "DiscardQuestionBlueprintDraftRequest",
  schema: {
    additionalProperties: false,
    properties: {
      expectedRevision: { minimum: 1, type: "integer" },
    },
    required: ["expectedRevision"],
    type: "object",
  },
};
const attachQuestionBlueprintDraftSourceFileRequestSchema: Schema = {
  name: "AttachQuestionBlueprintDraftSourceFileRequest",
  schema: {
    additionalProperties: false,
    properties: {
      expectedRevision: { minimum: 1, type: "integer" },
      fileId: uuid,
    },
    required: ["fileId", "expectedRevision"],
    type: "object",
  },
};
const gradeQuestionRequestSchema: Schema = {
  name: "GradeQuestionRequest",
  schema: {
    additionalProperties: false,
    properties: { answer: schemaRef(questionAnswerSchema) },
    required: ["answer"],
    type: "object",
  },
};
const createQuestionGenerationRunRequestSchema: Schema = {
  name: "CreateQuestionGenerationRunRequest",
  schema: {
    additionalProperties: false,
    properties: {
      blueprintId: uuid,
      count: {
        maximum: MAX_GENERATION_RUN_COUNT,
        minimum: 1,
        type: "integer",
      },
      targetQuestionSetId: uuid,
    },
    required: ["count", "blueprintId", "targetQuestionSetId"],
    type: "object",
  },
};

const upstreamWorkbookResponse: Response = {
  name: "UpstreamWorkbook",
  schema: {
    content: {
      "application/json": { schema: schemaRef(errorResponseSchema) },
    },
    description: "UPSTREAM_WORKBOOK",
  },
};

const questionSetParam: Param = {
  name: "QuestionSetIdParam",
  schema: {
    in: "path",
    name: "questionSetId",
    required: true,
    schema: uuid,
  },
};
const questionBlueprintParam: Param = {
  name: "QuestionBlueprintIdParam",
  schema: {
    in: "path",
    name: "questionBlueprintId",
    required: true,
    schema: uuid,
  },
};
const questionBlueprintDraftParam: Param = {
  name: "QuestionBlueprintDraftIdParam",
  schema: {
    in: "path",
    name: "draftId",
    required: true,
    schema: uuid,
  },
};
const questionBlueprintDraftSourceParam: Param = {
  name: "QuestionBlueprintDraftSourceIdParam",
  schema: {
    in: "path",
    name: "sourceId",
    required: true,
    schema: { pattern: "^[A-Za-z][A-Za-z0-9_-]*$", type: "string" },
  },
};
const questionParam: Param = {
  name: "QuestionIdParam",
  schema: {
    in: "path",
    name: "questionId",
    required: true,
    schema: uuid,
  },
};
const questionGenerationRunParam: Param = {
  name: "QuestionGenerationRunIdParam",
  schema: {
    in: "path",
    name: "questionGenerationRunId",
    required: true,
    schema: uuid,
  },
};

export const tags: readonly Tag[] = Object.freeze([questionTag]);

export const schemas = Object.freeze([
  questionValueExpressionSchema,
  questionReferenceSourceSchema,
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
  questionProducerSchema,
  questionAnswerSchema,
  gradeResultSchema,
  questionSetSchema,
  questionBlueprintDraftSourceSchema,
  questionBlueprintDraftSourceIntentSchema,
  questionBlueprintVersionSourceSchema,
  questionBlueprintSchema,
  questionBlueprintAuthoringSchema,
  questionBlueprintDraftSchema,
  questionBlueprintVersionSchema,
  questionSchema,
  questionGenerationRunSchema,
  listQuestionSetsResponseSchema,
  questionSetResponseSchema,
  listQuestionBlueprintsResponseSchema,
  questionBlueprintResponseSchema,
  questionBlueprintAuthoringResponseSchema,
  questionBlueprintDraftResponseSchema,
  questionBlueprintEditDraftResponseSchema,
  listQuestionBlueprintDraftsResponseSchema,
  publishQuestionBlueprintDraftResponseSchema,
  listQuestionsResponseSchema,
  questionResponseSchema,
  gradeQuestionResponseSchema,
  listQuestionGenerationRunsResponseSchema,
  questionGenerationRunResponseSchema,
  createQuestionSetRequestSchema,
  updateQuestionSetRequestSchema,
  createQuestionBlueprintDraftRequestSchema,
  createQuestionBlueprintEditDraftRequestSchema,
  updateQuestionBlueprintDraftRequestSchema,
  publishQuestionBlueprintDraftRequestSchema,
  discardQuestionBlueprintDraftRequestSchema,
  attachQuestionBlueprintDraftSourceFileRequestSchema,
  gradeQuestionRequestSchema,
  createQuestionGenerationRunRequestSchema,
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
  questionBlueprintDraftParam,
  questionBlueprintDraftSourceParam,
  questionParam,
  questionGenerationRunParam,
]);

export const paths: Paths = {
  "/question-blueprint-drafts": {
    get: {
      operationId: "listQuestionBlueprintDrafts",
      parameters: [
        {
          in: "query",
          name: "limit",
          required: false,
          schema: { maximum: 100, minimum: 1, type: "integer" },
        },
        {
          in: "query",
          name: "cursor",
          required: false,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(listQuestionBlueprintDraftsResponseSchema),
            },
          },
          description: "Question blueprint drafts.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "List question blueprint drafts",
      tags: [tagRef(questionTag)],
    },
    post: {
      operationId: "createQuestionBlueprintDraft",
      requestBody: {
        content: {
          "application/json": {
            schema: schemaRef(createQuestionBlueprintDraftRequestSchema),
          },
        },
        required: true,
      },
      responses: {
        "201": {
          content: {
            "application/json": {
              schema: schemaRef(questionBlueprintDraftResponseSchema),
            },
          },
          description: "Question blueprint draft created.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Create question blueprint draft",
      tags: [tagRef(questionTag)],
    },
  },
  "/question-blueprint-drafts/{draftId}/discard": {
    parameters: [paramRef(questionBlueprintDraftParam)],
    post: {
      operationId: "discardQuestionBlueprintDraft",
      requestBody: {
        content: {
          "application/json": {
            schema: schemaRef(discardQuestionBlueprintDraftRequestSchema),
          },
        },
        required: true,
      },
      responses: {
        "204": { description: "No content" },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Discard question blueprint draft",
      tags: [tagRef(questionTag)],
    },
  },
  "/question-blueprint-drafts/{draftId}": {
    get: {
      operationId: "getQuestionBlueprintDraft",
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(questionBlueprintDraftResponseSchema),
            },
          },
          description: "Question blueprint draft.",
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Get question blueprint draft",
      tags: [tagRef(questionTag)],
    },
    parameters: [paramRef(questionBlueprintDraftParam)],
    patch: {
      operationId: "updateQuestionBlueprintDraft",
      requestBody: {
        content: {
          "application/json": {
            schema: schemaRef(updateQuestionBlueprintDraftRequestSchema),
          },
        },
        required: true,
      },
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(questionBlueprintDraftResponseSchema),
            },
          },
          description: "Question blueprint draft updated.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Update question blueprint draft",
      tags: [tagRef(questionTag)],
    },
  },
  "/question-blueprint-drafts/{draftId}/publish": {
    parameters: [paramRef(questionBlueprintDraftParam)],
    post: {
      operationId: "publishQuestionBlueprintDraft",
      requestBody: {
        content: {
          "application/json": {
            schema: schemaRef(publishQuestionBlueprintDraftRequestSchema),
          },
        },
        required: true,
      },
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(publishQuestionBlueprintDraftResponseSchema),
            },
          },
          description: "Question blueprint draft published.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Publish question blueprint draft",
      tags: [tagRef(questionTag)],
    },
  },
  "/question-blueprint-drafts/{draftId}/sources/{sourceId}/file": {
    parameters: [
      paramRef(questionBlueprintDraftParam),
      paramRef(questionBlueprintDraftSourceParam),
    ],
    post: {
      operationId: "attachQuestionBlueprintDraftSourceFile",
      requestBody: {
        content: {
          "application/json": {
            schema: schemaRef(
              attachQuestionBlueprintDraftSourceFileRequestSchema,
            ),
          },
        },
        required: true,
      },
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(questionBlueprintDraftResponseSchema),
            },
          },
          description: "Draft source file attached.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Attach source file to question blueprint draft",
      tags: [tagRef(questionTag)],
    },
  },
  "/question-blueprints": {
    get: {
      operationId: "listQuestionBlueprints",
      parameters: [
        {
          in: "query",
          name: "limit",
          required: false,
          schema: { maximum: 100, minimum: 1, type: "integer" },
        },
        {
          in: "query",
          name: "cursor",
          required: false,
          schema: { type: "string" },
        },
        {
          in: "query",
          name: "status",
          required: false,
          schema: {
            enum: [...QUESTION_BLUEPRINT_STATUS_ACCEPTED_VALUES],
            type: "string",
          },
        },
      ],
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(listQuestionBlueprintsResponseSchema),
            },
          },
          description: "Question blueprints.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "List question blueprints",
      tags: [tagRef(questionTag)],
    },
  },
  "/question-blueprints/{questionBlueprintId}": {
    delete: {
      operationId: "deleteQuestionBlueprint",
      responses: {
        "204": { description: "No content" },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Delete question blueprint",
      tags: [tagRef(questionTag)],
    },
    get: {
      operationId: "getQuestionBlueprint",
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(questionBlueprintResponseSchema),
            },
          },
          description: "Question blueprint.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Get question blueprint",
      tags: [tagRef(questionTag)],
    },
    parameters: [paramRef(questionBlueprintParam)],
  },
  "/question-blueprints/{questionBlueprintId}/edit-draft": {
    parameters: [paramRef(questionBlueprintParam)],
    post: {
      operationId: "createQuestionBlueprintEditDraft",
      requestBody: {
        content: {
          "application/json": {
            schema: schemaRef(createQuestionBlueprintEditDraftRequestSchema),
          },
        },
      },
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(questionBlueprintEditDraftResponseSchema),
            },
          },
          description: "Existing edit draft resumed.",
        },
        "201": {
          content: {
            "application/json": {
              schema: schemaRef(questionBlueprintEditDraftResponseSchema),
            },
          },
          description: "Edit draft created.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Create or resume question blueprint edit draft",
      tags: [tagRef(questionTag)],
    },
  },
  "/question-blueprints/{questionBlueprintId}/authoring": {
    get: {
      description:
        "Authoring-only. Returns the private canonical blueprint document for editing.",
      operationId: "getQuestionBlueprintAuthoring",
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(questionBlueprintAuthoringResponseSchema),
            },
          },
          description: "Question blueprint authoring data.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Get question blueprint authoring data",
      tags: [tagRef(questionTag)],
    },
    parameters: [paramRef(questionBlueprintParam)],
  },

  "/question-generation-runs": {
    get: {
      operationId: "listQuestionGenerationRuns",
      parameters: [
        {
          in: "query",
          name: "limit",
          required: false,
          schema: { maximum: 100, minimum: 1, type: "integer" },
        },
        {
          in: "query",
          name: "cursor",
          required: false,
          schema: { type: "string" },
        },
        {
          in: "query",
          name: "status",
          required: false,
          schema: {
            enum: [...QUESTION_GENERATION_RUN_STATUS_ACCEPTED_VALUES],
            type: "string",
          },
        },
      ],
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(listQuestionGenerationRunsResponseSchema),
            },
          },
          description: "Question generation runs.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "List question generation runs",
      tags: [tagRef(questionTag)],
    },
    post: {
      description: "Create a generation run from the current blueprint state.",
      operationId: "createQuestionGenerationRun",
      requestBody: {
        content: {
          "application/json": {
            schema: schemaRef(createQuestionGenerationRunRequestSchema),
          },
        },
        required: true,
      },
      responses: {
        "201": {
          content: {
            "application/json": {
              schema: schemaRef(questionGenerationRunResponseSchema),
            },
          },
          description: "Question generation run created.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Create question generation run",
      tags: [tagRef(questionTag)],
    },
  },
  "/question-generation-runs/{questionGenerationRunId}": {
    get: {
      operationId: "getQuestionGenerationRun",
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(questionGenerationRunResponseSchema),
            },
          },
          description: "Question generation run.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Get question generation run",
      tags: [tagRef(questionTag)],
    },
    parameters: [paramRef(questionGenerationRunParam)],
  },
  "/question-generation-runs/{questionGenerationRunId}/cancel": {
    parameters: [paramRef(questionGenerationRunParam)],
    post: {
      operationId: "cancelQuestionGenerationRun",
      responses: {
        "204": { description: "No content" },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Cancel question generation run",
      tags: [tagRef(questionTag)],
    },
  },
  "/question-generation-runs/{questionGenerationRunId}/retry": {
    parameters: [paramRef(questionGenerationRunParam)],
    post: {
      operationId: "retryQuestionGenerationRun",
      responses: {
        "201": {
          content: {
            "application/json": {
              schema: schemaRef(questionGenerationRunResponseSchema),
            },
          },
          description: "Question generation run retried.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
      security: [keycloakSecurityRequirement],
      summary:
        "Create replacement question generation run from frozen failed run snapshot",
      tags: [tagRef(questionTag)],
    },
  },
  "/question-sets": {
    get: {
      operationId: "listQuestionSets",
      parameters: [
        {
          in: "query",
          name: "limit",
          required: false,
          schema: { maximum: 100, minimum: 1, type: "integer" },
        },
        {
          in: "query",
          name: "cursor",
          required: false,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(listQuestionSetsResponseSchema),
            },
          },
          description: "Question sets.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "List question sets",
      tags: [tagRef(questionTag)],
    },
    post: {
      operationId: "createQuestionSet",
      requestBody: {
        content: {
          "application/json": {
            schema: schemaRef(createQuestionSetRequestSchema),
          },
        },
        required: true,
      },
      responses: {
        "201": {
          content: {
            "application/json": {
              schema: schemaRef(questionSetResponseSchema),
            },
          },
          description: "Question set created.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Create question set",
      tags: [tagRef(questionTag)],
    },
  },

  "/question-sets/{questionSetId}": {
    delete: {
      operationId: "deleteQuestionSet",
      responses: {
        "204": { description: "No content" },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Delete question set",
      tags: [tagRef(questionTag)],
    },
    get: {
      operationId: "getQuestionSet",
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(questionSetResponseSchema),
            },
          },
          description: "Question set.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Get question set",
      tags: [tagRef(questionTag)],
    },
    parameters: [paramRef(questionSetParam)],
    patch: {
      operationId: "updateQuestionSet",
      requestBody: {
        content: {
          "application/json": {
            schema: schemaRef(updateQuestionSetRequestSchema),
          },
        },
        required: true,
      },
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(questionSetResponseSchema),
            },
          },
          description: "Question set updated.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Update question set",
      tags: [tagRef(questionTag)],
    },
  },

  "/question-sets/{questionSetId}/questions": {
    get: {
      operationId: "listQuestionSetQuestions",
      parameters: [
        {
          in: "query",
          name: "limit",
          required: false,
          schema: { maximum: 100, minimum: 1, type: "integer" },
        },
        {
          in: "query",
          name: "cursor",
          required: false,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(listQuestionsResponseSchema),
            },
          },
          description: "Question set questions.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "List question set questions",
      tags: [tagRef(questionTag)],
    },
    parameters: [paramRef(questionSetParam)],
  },
  "/question-sets/{questionSetId}/questions/{questionId}": {
    delete: {
      operationId: "removeQuestionFromSet",
      responses: {
        "204": { description: "No content" },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Remove question from set",
      tags: [tagRef(questionTag)],
    },
    parameters: [paramRef(questionSetParam), paramRef(questionParam)],
  },
  "/questions": {
    get: {
      operationId: "listQuestions",
      parameters: [
        {
          in: "query",
          name: "limit",
          required: false,
          schema: { maximum: 100, minimum: 1, type: "integer" },
        },
        {
          in: "query",
          name: "cursor",
          required: false,
          schema: { type: "string" },
        },
        {
          in: "query",
          name: "status",
          required: false,
          schema: {
            enum: [...QUESTION_STATUS_ACCEPTED_VALUES],
            type: "string",
          },
        },
        {
          in: "query",
          name: "blueprintId",
          required: false,
          schema: uuid,
        },
        {
          in: "query",
          name: "generationRunId",
          required: false,
          schema: uuid,
        },
      ],
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(listQuestionsResponseSchema),
            },
          },
          description: "Questions.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "List questions",
      tags: [tagRef(questionTag)],
    },
  },
  "/questions/{questionId}": {
    delete: {
      operationId: "deleteQuestion",
      responses: {
        "204": { description: "No content" },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Delete question",
      tags: [tagRef(questionTag)],
    },
    get: {
      operationId: "getQuestion",
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(questionResponseSchema),
            },
          },
          description: "Question.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Get question",
      tags: [tagRef(questionTag)],
    },
    parameters: [paramRef(questionParam)],
  },

  "/questions/{questionId}/grade": {
    parameters: [paramRef(questionParam)],
    post: {
      operationId: "gradeQuestion",
      requestBody: {
        content: {
          "application/json": {
            schema: schemaRef(gradeQuestionRequestSchema),
          },
        },
        required: true,
      },
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(gradeQuestionResponseSchema),
            },
          },
          description: "Question graded.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamWorkbookResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Grade question",
      tags: [tagRef(questionTag)],
    },
  },
};

export const openapi: OpenAPI = {
  components: {
    parameters: Object.fromEntries(
      params.map((param) => [param.name, param.schema]),
    ),
    responses: Object.fromEntries([
      ...responses.map((resp) => [resp.name, resp.schema]),
      [unauthorizedResponse.name, unauthorizedResponse.schema],
    ]),
    schemas: Object.fromEntries([
      ...schemas.map((schema) => [schema.name, schema.schema]),
      [errorResponseSchema.name, errorResponseSchema.schema],
    ]),
    securitySchemes: Object.fromEntries([
      [keycloakSecurityScheme.name, keycloakSecurityScheme.securitySchema],
    ]),
  },
  info: {
    title: "Lemma Questions API",
    version: "0.1.0",
  },
  openapi: "3.1.0",
  paths,
  tags: [questionTag],
};
