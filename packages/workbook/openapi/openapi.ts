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
  uuidV7Param,
  uuidV7StringSchemaObject,
} from "@lemma/http/openapi";
import {
  MAX_WORKBOOK_CALCULATION_COUNT,
  MAX_WORKBOOK_NAME_LENGTH,
  MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_COLUMNS,
  MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_ROWS,
  MAX_WORKBOOK_SNAPSHOT_RANGE_BATCH_REFS,
  MAX_WORKBOOK_SNAPSHOT_SHEET_PAGE_SIZE,
  WORKBOOK_CALCULATION_STATUS_ACCEPTED_VALUES,
  WORKBOOK_CELL_TYPE_ACCEPTED_VALUES,
  WORKBOOK_STATUS_ACCEPTED_VALUES,
} from "../src/domain/index.ts";

type OpenApiSchema = Schema["schema"];
type SchemaOrRef = OpenApiSchema | { $ref: string };
type QuerySchema = {
  type: "integer" | "number" | "string" | "boolean";
  minimum?: number;
  maximum?: number;
  minLength?: number;
  pattern?: string;
  enum?: string[];
  format?: string;
};
type QueryParameter = {
  name: string;
  in: "query";
  required?: boolean;
  schema: QuerySchema;
};

const nullableUuid = {
  pattern: UUID_V7_OPENAPI_PATTERN,
  type: ["string", "null"],
} satisfies OpenApiSchema;

const tag: Tag = {
  description:
    "Workbook import, validation, calculation, snapshot, and engine health operations.",
  name: "Workbook",
};

const workbookIdParam: Param = {
  name: "workbookId",
  schema: uuidV7Param("workbookId").schema,
};
const calculationIdParam: Param = {
  name: "workbookCalculationId",
  schema: uuidV7Param("workbookCalculationId").schema,
};
const snapshotIdParam: Param = {
  name: "workbookSnapshotId",
  schema: uuidV7Param("workbookSnapshotId").schema,
};
const sheetIndexParam: Param = {
  name: "sheetIndex",
  schema: {
    in: "path",
    name: "sheetIndex",
    required: true,
    schema: { pattern: "^[0-9]+$", type: "string" },
  },
};

const inspectionSchema: Schema = {
  name: "WorkbookInspection",
  schema: {
    properties: {
      cellCount: { minimum: 0, type: "integer" },
      forbiddenFeatureFindings: { items: { type: "string" }, type: "array" },
      formulaCount: { minimum: 0, type: "integer" },
      libreOfficeVersion: { type: ["string", "null"] },
      sheetCount: { minimum: 0, type: "integer" },
    },
    required: [
      "sheetCount",
      "cellCount",
      "formulaCount",
      "forbiddenFeatureFindings",
      "libreOfficeVersion",
    ],
    type: "object",
  },
};

const workbookSchema: Schema = {
  name: "Workbook",
  schema: {
    properties: {
      checksumSha256: { pattern: "^[A-Fa-f0-9]{64}$", type: "string" },
      createdAt: { format: "date-time", type: "string" },
      createdByUserId: uuidV7StringSchemaObject(),
      engine: { enum: ["cached", "libreoffice"], type: "string" },
      engineVersion: { type: ["string", "null"] },
      fileId: uuidV7StringSchemaObject(),
      id: uuidV7StringSchemaObject(),
      inspection: { anyOf: [schemaRef(inspectionSchema), { type: "null" }] },
      name: {
        maxLength: MAX_WORKBOOK_NAME_LENGTH,
        minLength: 1,
        type: "string",
      },
      originalName: { minLength: 1, type: "string" },
      ownerUserId: uuidV7StringSchemaObject(),
      status: {
        enum: [...WORKBOOK_STATUS_ACCEPTED_VALUES],
        type: "string",
      },
      updatedAt: { format: "date-time", type: "string" },
      validationError: { type: ["string", "null"] },
    },
    required: [
      "id",
      "ownerUserId",
      "createdByUserId",
      "name",
      "fileId",
      "checksumSha256",
      "originalName",
      "engine",
      "engineVersion",
      "status",
      "inspection",
      "validationError",
      "createdAt",
      "updatedAt",
    ],
    type: "object",
  },
};

const calculationSchema: Schema = {
  name: "WorkbookCalculation",
  schema: {
    properties: {
      attemptNumber: { minimum: 1, type: "integer" },
      attempts: { minimum: 0, type: "integer" },
      correlationId: { type: ["string", "null"] },
      createdAt: { format: "date-time", type: "string" },
      createdByUserId: uuidV7StringSchemaObject(),
      errorMessage: { type: ["string", "null"] },
      finishedAt: { format: "date-time", type: ["string", "null"] },
      id: uuidV7StringSchemaObject(),
      ownerUserId: uuidV7StringSchemaObject(),
      requestedCount: {
        maximum: MAX_WORKBOOK_CALCULATION_COUNT,
        minimum: 1,
        type: "integer",
      },
      retryOfCalculationId: nullableUuid,
      startedAt: { format: "date-time", type: ["string", "null"] },
      status: {
        enum: [...WORKBOOK_CALCULATION_STATUS_ACCEPTED_VALUES],
        type: "string",
      },
      updatedAt: { format: "date-time", type: "string" },
    },
    required: [
      "id",
      "ownerUserId",
      "createdByUserId",
      "requestedCount",
      "status",
      "correlationId",
      "retryOfCalculationId",
      "attemptNumber",
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

const snapshotSchema: Schema = {
  name: "WorkbookSnapshot",
  schema: {
    properties: {
      calculationId: uuidV7StringSchemaObject(),
      createdAt: { format: "date-time", type: "string" },
      id: uuidV7StringSchemaObject(),
      questionIndex: { minimum: 0, type: "integer" },
      snapshotIndex: { minimum: 0, type: "integer" },
      sourceId: {
        pattern: "^[A-Za-z][A-Za-z0-9_-]*$",
        type: "string",
      },
      workbookId: uuidV7StringSchemaObject(),
    },
    required: [
      "id",
      "sourceId",
      "workbookId",
      "calculationId",
      "questionIndex",
      "snapshotIndex",
      "createdAt",
    ],
    type: "object",
  },
};

const snapshotMetadataSchema: Schema = {
  name: "WorkbookSnapshotMetadata",
  schema: {
    properties: {
      cellCount: { minimum: 0, type: "integer" },
      sheetCount: { minimum: 0, type: "integer" },
      status: { enum: ["ready"], type: "string" },
    },
    required: ["status", "sheetCount", "cellCount"],
    type: "object",
  },
};

const snapshotSheetSchema: Schema = {
  name: "WorkbookSnapshotSheet",
  schema: {
    properties: {
      columnCount: { minimum: 0, type: "integer" },
      name: { minLength: 1, type: "string" },
      nonEmptyCellCount: { minimum: 0, type: "integer" },
      rowCount: { minimum: 0, type: "integer" },
      sheetIndex: { minimum: 0, type: "integer" },
    },
    required: [
      "sheetIndex",
      "name",
      "rowCount",
      "columnCount",
      "nonEmptyCellCount",
    ],
    type: "object",
  },
};

const snapshotCellsSchema: Schema = {
  name: "WorkbookSnapshotCells",
  schema: {
    properties: {
      cellTypes: {
        items: {
          items: {
            enum: [...WORKBOOK_CELL_TYPE_ACCEPTED_VALUES],
            type: "string",
          },
          maxItems: MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_COLUMNS,
          type: "array",
        },
        maxItems: MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_ROWS,
        type: "array",
      },
      columnCount: { minimum: 0, type: "integer" },
      rowCount: { minimum: 0, type: "integer" },
      rows: {
        items: {
          items: { type: "string" },
          maxItems: MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_COLUMNS,
          type: "array",
        },
        maxItems: MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_ROWS,
        type: "array",
      },
      sheetIndex: { minimum: 0, type: "integer" },
      sheetName: { minLength: 1, type: "string" },
      startColumn: { minimum: 1, type: "integer" },
      startRow: { minimum: 1, type: "integer" },
    },
    required: [
      "sheetIndex",
      "sheetName",
      "startRow",
      "startColumn",
      "rowCount",
      "columnCount",
      "rows",
      "cellTypes",
    ],
    type: "object",
  },
};

const snapshotRangeSchema: Schema = {
  name: "WorkbookSnapshotRange",
  schema: {
    allOf: [
      schemaRef(snapshotCellsSchema),
      {
        properties: {
          endCellAddress: { minLength: 1, type: "string" },
          ref: { minLength: 1, type: "string" },
          startCellAddress: { minLength: 1, type: "string" },
        },
        required: ["ref", "startCellAddress", "endCellAddress"],
        type: "object",
      },
    ],
  },
};

const snapshotRangeBatchItemSchema: Schema = {
  name: "WorkbookSnapshotRangeBatchItem",
  schema: {
    properties: {
      errorMessage: { type: ["string", "null"] },
      range: {
        anyOf: [schemaRef(snapshotRangeSchema), { type: "null" }],
      },
      ref: { minLength: 1, type: "string" },
      status: { enum: ["ok", "error"], type: "string" },
    },
    required: ["ref", "status", "range", "errorMessage"],
    type: "object",
  },
};

const snapshotRangeBatchSchema: Schema = {
  name: "WorkbookSnapshotRangeBatch",
  schema: {
    properties: {
      ranges: {
        items: schemaRef(snapshotRangeBatchItemSchema),
        maxItems: MAX_WORKBOOK_SNAPSHOT_RANGE_BATCH_REFS,
        type: "array",
      },
    },
    required: ["ranges"],
    type: "object",
  },
};

const healthSchema: Schema = {
  name: "WorkbookEngineHealth",
  schema: {
    properties: {
      engine: { enum: ["cached", "libreoffice"], type: "string" },
      ok: { type: "boolean" },
      version: { type: ["string", "null"] },
    },
    required: ["ok", "engine", "version"],
    type: "object",
  },
};

const createWorkbookRequestSchema = named("CreateWorkbookRequest", {
  additionalProperties: false,
  properties: {
    fileId: uuidV7StringSchemaObject(),
    name: { maxLength: MAX_WORKBOOK_NAME_LENGTH, minLength: 1, type: "string" },
  },
  required: ["name", "fileId"],
  type: "object",
});
const updateWorkbookRequestSchema = named("UpdateWorkbookRequest", {
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: { maxLength: MAX_WORKBOOK_NAME_LENGTH, minLength: 1, type: "string" },
    status: { enum: ["archived"], type: "string" },
  },
  type: "object",
});
const createCalculationRequestSchema = named(
  "CreateWorkbookCalculationRequest",
  {
    additionalProperties: false,
    properties: {
      correlationId: { type: ["string", "null"] },
      requestedCount: {
        maximum: MAX_WORKBOOK_CALCULATION_COUNT,
        minimum: 1,
        type: "integer",
      },
    },
    required: ["requestedCount"],
    type: "object",
  },
);
const getSnapshotRangeBatchRequestSchema = named(
  "GetWorkbookSnapshotRangeBatchRequest",
  {
    additionalProperties: false,
    properties: {
      refs: {
        items: { minLength: 1, type: "string" },
        maxItems: MAX_WORKBOOK_SNAPSHOT_RANGE_BATCH_REFS,
        minItems: 1,
        type: "array",
      },
    },
    required: ["refs"],
    type: "object",
  },
);
const workbookResponseSchema = named(
  "WorkbookResponse",
  objectWith("workbook", schemaRef(workbookSchema)),
);
const workbooksResponseSchema = named(
  "WorkbooksResponse",
  listWith("workbooks", schemaRef(workbookSchema)),
);
const calculationResponseSchema = named(
  "WorkbookCalculationResponse",
  objectWith("workbookCalculation", schemaRef(calculationSchema)),
);
const calculationsResponseSchema = named(
  "WorkbookCalculationsResponse",
  listWith("workbookCalculations", schemaRef(calculationSchema)),
);
const snapshotResponseSchema = named(
  "WorkbookSnapshotResponse",
  objectWith("workbookSnapshot", schemaRef(snapshotSchema)),
);
const snapshotMetadataResponseSchema = named(
  "WorkbookSnapshotMetadataResponse",
  objectWith("workbookSnapshotMetadata", schemaRef(snapshotMetadataSchema)),
);
const snapshotSheetsResponseSchema = named(
  "WorkbookSnapshotSheetsResponse",
  listWith("workbookSnapshotSheets", schemaRef(snapshotSheetSchema)),
);
const snapshotCellsResponseSchema = named(
  "WorkbookSnapshotCellsResponse",
  objectWith("workbookSnapshotCells", schemaRef(snapshotCellsSchema)),
);
const snapshotRangeResponseSchema = named(
  "WorkbookSnapshotRangeResponse",
  objectWith("workbookSnapshotRange", schemaRef(snapshotRangeSchema)),
);
const snapshotRangeBatchResponseSchema = named(
  "WorkbookSnapshotRangeBatchResponse",
  objectWith("workbookSnapshotRangeBatch", schemaRef(snapshotRangeBatchSchema)),
);
const snapshotsResponseSchema = named(
  "WorkbookSnapshotsResponse",
  listWith("workbookSnapshots", schemaRef(snapshotSchema)),
);
const valueResponseSchema = named("WorkbookSnapshotValueResponse", {
  properties: { value: {} },
  required: ["value"],
  type: "object",
});
const healthResponseSchema = named(
  "WorkbookEngineHealthResponse",
  objectWith("health", schemaRef(healthSchema)),
);

const upstreamResponse = response(
  "UpstreamWorkbookEngineResponse",
  "Workbook engine failed.",
);

const schemas = [
  workbookSchema,
  calculationSchema,
  snapshotSchema,
  snapshotMetadataSchema,
  snapshotSheetSchema,
  snapshotCellsSchema,
  snapshotRangeSchema,
  snapshotRangeBatchItemSchema,
  snapshotRangeBatchSchema,
  inspectionSchema,
  healthSchema,
  createWorkbookRequestSchema,
  updateWorkbookRequestSchema,
  createCalculationRequestSchema,
  getSnapshotRangeBatchRequestSchema,
  workbookResponseSchema,
  workbooksResponseSchema,
  calculationResponseSchema,
  calculationsResponseSchema,
  snapshotResponseSchema,
  snapshotMetadataResponseSchema,
  snapshotSheetsResponseSchema,
  snapshotCellsResponseSchema,
  snapshotRangeResponseSchema,
  snapshotRangeBatchResponseSchema,
  snapshotsResponseSchema,
  valueResponseSchema,
  healthResponseSchema,
];
const responses = [
  badRequestResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictResponse,
  upstreamResponse,
];
const params = [
  workbookIdParam,
  calculationIdParam,
  snapshotIdParam,
  sheetIndexParam,
];

const paths: Paths = {
  "/workbook-calculations/{workbookCalculationId}": {
    get: op(
      "getWorkbookCalculation",
      "Get workbook calculation",
      "200",
      calculationResponseSchema,
    ),
    parameters: [paramRef(calculationIdParam)],
  },
  "/workbook-calculations/{workbookCalculationId}/cancellations": {
    parameters: [paramRef(calculationIdParam)],
    post: opNoBody(
      "cancelWorkbookCalculation",
      "Cancel workbook calculation",
      "204",
    ),
  },
  "/workbook-calculations/{workbookCalculationId}/retry": {
    parameters: [paramRef(calculationIdParam)],
    post: op(
      "retryWorkbookCalculation",
      "Retry workbook calculation",
      "201",
      calculationResponseSchema,
    ),
  },
  "/workbook-calculations/{workbookCalculationId}/snapshots": {
    get: op(
      "listWorkbookSnapshots",
      "List workbook snapshots",
      "200",
      snapshotsResponseSchema,
      undefined,
      [
        query("limit", { maximum: 100, minimum: 1, type: "integer" }),
        query("cursor", { type: "string" }),
      ],
    ),
    parameters: [paramRef(calculationIdParam)],
  },
  "/workbook-engine/health": {
    get: op(
      "getWorkbookEngineHealth",
      "Get workbook engine health",
      "200",
      healthResponseSchema,
    ),
  },
  "/workbook-snapshots/{workbookSnapshotId}": {
    get: op(
      "getWorkbookSnapshot",
      "Get workbook snapshot",
      "200",
      snapshotResponseSchema,
    ),
    parameters: [paramRef(snapshotIdParam)],
  },
  "/workbook-snapshots/{workbookSnapshotId}/metadata": {
    get: op(
      "getWorkbookSnapshotMetadata",
      "Get workbook snapshot metadata",
      "200",
      snapshotMetadataResponseSchema,
    ),
    parameters: [paramRef(snapshotIdParam)],
  },
  "/workbook-snapshots/{workbookSnapshotId}/range": {
    get: op(
      "getWorkbookSnapshotRange",
      "Get workbook snapshot range",
      "200",
      snapshotRangeResponseSchema,
      undefined,
      [
        {
          in: "query",
          name: "ref",
          required: true,
          schema: { minLength: 1, type: "string" },
        },
      ],
    ),
    parameters: [paramRef(snapshotIdParam)],
  },
  "/workbook-snapshots/{workbookSnapshotId}/ranges": {
    parameters: [paramRef(snapshotIdParam)],
    post: op(
      "getWorkbookSnapshotRangeBatch",
      "Get workbook snapshot ranges",
      "200",
      snapshotRangeBatchResponseSchema,
      getSnapshotRangeBatchRequestSchema,
    ),
  },
  "/workbook-snapshots/{workbookSnapshotId}/sheets": {
    get: op(
      "listWorkbookSnapshotSheets",
      "List workbook snapshot sheets",
      "200",
      snapshotSheetsResponseSchema,
      undefined,
      [
        query("limit", {
          maximum: MAX_WORKBOOK_SNAPSHOT_SHEET_PAGE_SIZE,
          minimum: 1,
          type: "integer",
        }),
        query("cursor", { type: "string" }),
      ],
    ),
    parameters: [paramRef(snapshotIdParam)],
  },
  "/workbook-snapshots/{workbookSnapshotId}/sheets/{sheetIndex}/cells": {
    get: op(
      "getWorkbookSnapshotCells",
      "Get workbook snapshot cells",
      "200",
      snapshotCellsResponseSchema,
      undefined,
      [
        query("startRow", { minimum: 1, type: "integer" }, true),
        query("startColumn", { minimum: 1, type: "integer" }, true),
        query(
          "rowCount",
          {
            maximum: MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_ROWS,
            minimum: 1,
            type: "integer",
          },
          true,
        ),
        query(
          "columnCount",
          {
            maximum: MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_COLUMNS,
            minimum: 1,
            type: "integer",
          },
          true,
        ),
      ],
    ),
    parameters: [paramRef(snapshotIdParam), paramRef(sheetIndexParam)],
  },
  "/workbook-snapshots/{workbookSnapshotId}/values": {
    get: op(
      "resolveWorkbookSnapshotValue",
      "Resolve workbook snapshot value",
      "200",
      valueResponseSchema,
      undefined,
      [
        {
          in: "query",
          name: "ref",
          required: true,
          schema: { minLength: 1, type: "string" },
        },
      ],
    ),
    parameters: [paramRef(snapshotIdParam)],
  },
  "/workbooks": {
    get: op(
      "listWorkbooks",
      "List workbooks",
      "200",
      workbooksResponseSchema,
      undefined,
      [
        query("limit", { maximum: 100, minimum: 1, type: "integer" }),
        query("cursor", { type: "string" }),
        query("status", {
          enum: [...WORKBOOK_STATUS_ACCEPTED_VALUES],
          type: "string",
        }),
      ],
    ),
    post: op(
      "createWorkbook",
      "Create workbook",
      "201",
      workbookResponseSchema,
      createWorkbookRequestSchema,
    ),
  },
  "/workbooks/{workbookId}": {
    delete: opNoBody("deleteWorkbook", "Delete workbook", "204"),
    get: op("getWorkbook", "Get workbook", "200", workbookResponseSchema),
    parameters: [paramRef(workbookIdParam)],
    patch: op(
      "updateWorkbook",
      "Update workbook",
      "200",
      workbookResponseSchema,
      updateWorkbookRequestSchema,
    ),
  },
  "/workbooks/{workbookId}/calculations": {
    get: op(
      "listWorkbookCalculations",
      "List workbook calculations",
      "200",
      calculationsResponseSchema,
      undefined,
      [
        query("limit", { maximum: 100, minimum: 1, type: "integer" }),
        query("cursor", { type: "string" }),
        query("status", {
          enum: [...WORKBOOK_CALCULATION_STATUS_ACCEPTED_VALUES],
          type: "string",
        }),
      ],
    ),
    parameters: [paramRef(workbookIdParam)],
    post: op(
      "createWorkbookCalculation",
      "Create workbook calculation",
      "201",
      calculationResponseSchema,
      createCalculationRequestSchema,
    ),
  },
  "/workbooks/{workbookId}/validations": {
    parameters: [paramRef(workbookIdParam)],
    post: op(
      "validateWorkbook",
      "Validate workbook",
      "200",
      workbookResponseSchema,
    ),
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
  info: { title: "Lemma Workbook API", version: "0.1.0" },
  openapi: "3.1.0",
  paths,
  tags: [tag],
};

function named(name: string, schema: Schema["schema"]): Schema {
  return { name, schema };
}

function response(name: string, description: string): Response {
  return {
    name,
    schema: {
      content: {
        "application/json": { schema: schemaRef(errorResponseSchema) },
      },
      description,
    },
  };
}

function objectWith(name: string, schema: SchemaOrRef): OpenApiSchema {
  return {
    properties: { [name]: schema },
    required: [name],
    type: "object",
  } satisfies OpenApiSchema;
}

function listWith(name: string, schema: SchemaOrRef): OpenApiSchema {
  return {
    properties: {
      [name]: { items: schema, type: "array" },
      nextCursor: { type: ["string", "null"] },
    },
    required: [name, "nextCursor"],
    type: "object",
  } satisfies OpenApiSchema;
}

function query(
  name: string,
  schema: QuerySchema,
  required = false,
): QueryParameter {
  return { in: "query", name, required, schema };
}

function op(
  operationId: string,
  summary: string,
  status: string,
  responseSchema: Schema,
  requestSchema?: Schema,
  parameters?: QueryParameter[],
) {
  return {
    operationId,
    parameters,
    requestBody: requestSchema
      ? {
          content: { "application/json": { schema: schemaRef(requestSchema) } },
          required: true,
        }
      : undefined,
    responses: responseMap(status, responseSchema),
    security: [keycloakSecurityRequirement],
    summary,
    tags: [tagRef(tag)],
  };
}

function opNoBody(operationId: string, summary: string, status: string) {
  return {
    operationId,
    responses: {
      [status]: { description: summary },
      "401": responseRef(unauthorizedResponse),
      "403": responseRef(forbiddenResponse),
      "404": responseRef(notFoundResponse),
      "409": responseRef(conflictResponse),
    },
    security: [keycloakSecurityRequirement],
    summary,
    tags: [tagRef(tag)],
  };
}

function responseMap(status: string, responseSchema: Schema) {
  return {
    [status]: {
      content: { "application/json": { schema: schemaRef(responseSchema) } },
      description: responseSchema.name,
    },
    "400": responseRef(badRequestResponse),
    "401": responseRef(unauthorizedResponse),
    "403": responseRef(forbiddenResponse),
    "404": responseRef(notFoundResponse),
    "409": responseRef(conflictResponse),
    "502": responseRef(upstreamResponse),
  };
}
