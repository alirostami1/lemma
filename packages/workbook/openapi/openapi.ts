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

const tag: Tag = {
  name: "Workbook",
  description:
    "Workbook import, validation, calculation, snapshot, and engine health operations.",
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
    name: "sheetIndex",
    in: "path",
    required: true,
    schema: { type: "string", pattern: "^[0-9]+$" },
  },
};

const inspectionSchema: Schema = {
  name: "WorkbookInspection",
  schema: {
    type: "object",
    required: [
      "sheetCount",
      "cellCount",
      "formulaCount",
      "forbiddenFeatureFindings",
      "libreOfficeVersion",
    ],
    properties: {
      sheetCount: { type: "integer", minimum: 0 },
      cellCount: { type: "integer", minimum: 0 },
      formulaCount: { type: "integer", minimum: 0 },
      forbiddenFeatureFindings: { type: "array", items: { type: "string" } },
      libreOfficeVersion: { type: ["string", "null"] },
    },
  },
};

const workbookSchema: Schema = {
  name: "Workbook",
  schema: {
    type: "object",
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
    properties: {
      id: uuidV7StringSchemaObject(),
      ownerUserId: uuidV7StringSchemaObject(),
      createdByUserId: uuidV7StringSchemaObject(),
      name: {
        type: "string",
        minLength: 1,
        maxLength: MAX_WORKBOOK_NAME_LENGTH,
      },
      fileId: uuidV7StringSchemaObject(),
      checksumSha256: { type: "string", pattern: "^[A-Fa-f0-9]{64}$" },
      originalName: { type: "string", minLength: 1 },
      engine: { type: "string", enum: ["cached", "libreoffice"] },
      engineVersion: { type: ["string", "null"] },
      status: {
        type: "string",
        enum: WORKBOOK_STATUS_ACCEPTED_VALUES as unknown as string[],
      },
      inspection: { anyOf: [schemaRef(inspectionSchema), { type: "null" }] },
      validationError: { type: ["string", "null"] },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
};

const calculationSchema: Schema = {
  name: "WorkbookCalculation",
  schema: {
    type: "object",
    required: [
      "id",
      "ownerUserId",
      "createdByUserId",
      "workbookId",
      "requestedCount",
      "status",
      "correlationId",
      "errorMessage",
      "attempts",
      "startedAt",
      "finishedAt",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      id: uuidV7StringSchemaObject(),
      ownerUserId: uuidV7StringSchemaObject(),
      createdByUserId: uuidV7StringSchemaObject(),
      workbookId: uuidV7StringSchemaObject(),
      requestedCount: {
        type: "integer",
        minimum: 1,
        maximum: MAX_WORKBOOK_CALCULATION_COUNT,
      },
      status: {
        type: "string",
        enum: WORKBOOK_CALCULATION_STATUS_ACCEPTED_VALUES as unknown as string[],
      },
      correlationId: { type: ["string", "null"] },
      errorMessage: { type: ["string", "null"] },
      attempts: { type: "integer", minimum: 0 },
      startedAt: { type: ["string", "null"], format: "date-time" },
      finishedAt: { type: ["string", "null"], format: "date-time" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
};

const snapshotSchema: Schema = {
  name: "WorkbookSnapshot",
  schema: {
    type: "object",
    required: [
      "id",
      "workbookId",
      "calculationId",
      "snapshotIndex",
      "createdAt",
    ],
    properties: {
      id: uuidV7StringSchemaObject(),
      workbookId: uuidV7StringSchemaObject(),
      calculationId: uuidV7StringSchemaObject(),
      snapshotIndex: { type: "integer", minimum: 0 },
      createdAt: { type: "string", format: "date-time" },
    },
  },
};

const snapshotMetadataSchema: Schema = {
  name: "WorkbookSnapshotMetadata",
  schema: {
    type: "object",
    required: ["status", "sheetCount", "cellCount"],
    properties: {
      status: { type: "string", enum: ["ready"] },
      sheetCount: { type: "integer", minimum: 0 },
      cellCount: { type: "integer", minimum: 0 },
    },
  },
};

const snapshotSheetSchema: Schema = {
  name: "WorkbookSnapshotSheet",
  schema: {
    type: "object",
    required: [
      "sheetIndex",
      "name",
      "rowCount",
      "columnCount",
      "nonEmptyCellCount",
    ],
    properties: {
      sheetIndex: { type: "integer", minimum: 0 },
      name: { type: "string", minLength: 1 },
      rowCount: { type: "integer", minimum: 0 },
      columnCount: { type: "integer", minimum: 0 },
      nonEmptyCellCount: { type: "integer", minimum: 0 },
    },
  },
};

const snapshotCellsSchema: Schema = {
  name: "WorkbookSnapshotCells",
  schema: {
    type: "object",
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
    properties: {
      sheetIndex: { type: "integer", minimum: 0 },
      sheetName: { type: "string", minLength: 1 },
      startRow: { type: "integer", minimum: 1 },
      startColumn: { type: "integer", minimum: 1 },
      rowCount: { type: "integer", minimum: 0 },
      columnCount: { type: "integer", minimum: 0 },
      rows: {
        type: "array",
        maxItems: MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_ROWS,
        items: {
          type: "array",
          maxItems: MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_COLUMNS,
          items: { type: "string" },
        },
      },
      cellTypes: {
        type: "array",
        maxItems: MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_ROWS,
        items: {
          type: "array",
          maxItems: MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_COLUMNS,
          items: {
            type: "string",
            enum: WORKBOOK_CELL_TYPE_ACCEPTED_VALUES as unknown as string[],
          },
        },
      },
    },
  },
};

const snapshotRangeSchema: Schema = {
  name: "WorkbookSnapshotRange",
  schema: {
    allOf: [
      schemaRef(snapshotCellsSchema),
      {
        type: "object",
        required: ["ref", "startCellAddress", "endCellAddress"],
        properties: {
          ref: { type: "string", minLength: 1 },
          startCellAddress: { type: "string", minLength: 1 },
          endCellAddress: { type: "string", minLength: 1 },
        },
      },
    ],
  },
};

const snapshotRangeBatchItemSchema: Schema = {
  name: "WorkbookSnapshotRangeBatchItem",
  schema: {
    type: "object",
    required: ["ref", "status", "range", "errorMessage"],
    properties: {
      ref: { type: "string", minLength: 1 },
      status: { type: "string", enum: ["ok", "error"] },
      range: {
        anyOf: [schemaRef(snapshotRangeSchema), { type: "null" }],
      },
      errorMessage: { type: ["string", "null"] },
    },
  },
};

const snapshotRangeBatchSchema: Schema = {
  name: "WorkbookSnapshotRangeBatch",
  schema: {
    type: "object",
    required: ["ranges"],
    properties: {
      ranges: {
        type: "array",
        maxItems: MAX_WORKBOOK_SNAPSHOT_RANGE_BATCH_REFS,
        items: schemaRef(snapshotRangeBatchItemSchema),
      },
    },
  },
};

const healthSchema: Schema = {
  name: "WorkbookEngineHealth",
  schema: {
    type: "object",
    required: ["ok", "engine", "version"],
    properties: {
      ok: { type: "boolean" },
      engine: { type: "string", enum: ["cached", "libreoffice"] },
      version: { type: ["string", "null"] },
    },
  },
};

const createWorkbookRequestSchema = named("CreateWorkbookRequest", {
  type: "object",
  additionalProperties: false,
  required: ["name", "fileId"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: MAX_WORKBOOK_NAME_LENGTH },
    fileId: uuidV7StringSchemaObject(),
  },
});
const updateWorkbookRequestSchema = named("UpdateWorkbookRequest", {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: { type: "string", minLength: 1, maxLength: MAX_WORKBOOK_NAME_LENGTH },
    status: { type: "string", enum: ["archived"] },
  },
});
const createCalculationRequestSchema = named(
  "CreateWorkbookCalculationRequest",
  {
    type: "object",
    additionalProperties: false,
    required: ["workbookSources", "requestedCount"],
    properties: {
      workbookSources: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["sourceId", "workbookId"],
          properties: {
            sourceId: { type: "string" },
            workbookId: uuidV7StringSchemaObject(),
          },
        },
      },
      requestedCount: {
        type: "integer",
        minimum: 1,
        maximum: MAX_WORKBOOK_CALCULATION_COUNT,
      },
      correlationId: { type: ["string", "null"] },
    },
  },
);
const retryCalculationRequestSchema = named("RetryWorkbookCalculationRequest", {
  type: "object",
  additionalProperties: false,
  required: ["workbookSources"],
  properties: {
    workbookSources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sourceId", "workbookId"],
        properties: {
          sourceId: { type: "string" },
          workbookId: uuidV7StringSchemaObject(),
        },
      },
    },
  },
});
const getSnapshotRangeBatchRequestSchema = named(
  "GetWorkbookSnapshotRangeBatchRequest",
  {
    type: "object",
    additionalProperties: false,
    required: ["refs"],
    properties: {
      refs: {
        type: "array",
        minItems: 1,
        maxItems: MAX_WORKBOOK_SNAPSHOT_RANGE_BATCH_REFS,
        items: { type: "string", minLength: 1 },
      },
    },
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
  type: "object",
  required: ["value"],
  properties: { value: {} },
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
  retryCalculationRequestSchema,
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
  "/workbooks": {
    get: op(
      "listWorkbooks",
      "List workbooks",
      "200",
      workbooksResponseSchema,
      undefined,
      [
        query("limit", { type: "integer", minimum: 1, maximum: 100 }),
        query("cursor", { type: "string" }),
        query("status", {
          type: "string",
          enum: WORKBOOK_STATUS_ACCEPTED_VALUES as unknown as string[],
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
    parameters: [paramRef(workbookIdParam)],
    get: op("getWorkbook", "Get workbook", "200", workbookResponseSchema),
    patch: op(
      "updateWorkbook",
      "Update workbook",
      "200",
      workbookResponseSchema,
      updateWorkbookRequestSchema,
    ),
    delete: opNoBody("deleteWorkbook", "Delete workbook", "204"),
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
  "/workbooks/{workbookId}/calculations": {
    parameters: [paramRef(workbookIdParam)],
    get: op(
      "listWorkbookCalculations",
      "List workbook calculations",
      "200",
      calculationsResponseSchema,
      undefined,
      [
        query("limit", { type: "integer", minimum: 1, maximum: 100 }),
        query("cursor", { type: "string" }),
        query("status", {
          type: "string",
          enum: WORKBOOK_CALCULATION_STATUS_ACCEPTED_VALUES as unknown as string[],
        }),
      ],
    ),
    post: op(
      "createWorkbookCalculation",
      "Create workbook calculation",
      "201",
      calculationResponseSchema,
      createCalculationRequestSchema,
    ),
  },
  "/workbook-calculations/{workbookCalculationId}": {
    parameters: [paramRef(calculationIdParam)],
    get: op(
      "getWorkbookCalculation",
      "Get workbook calculation",
      "200",
      calculationResponseSchema,
    ),
  },
  "/workbook-calculations/{workbookCalculationId}/cancellations": {
    parameters: [paramRef(calculationIdParam)],
    post: opNoBody(
      "cancelWorkbookCalculation",
      "Cancel workbook calculation",
      "204",
    ),
  },
  "/workbook-calculations/{workbookCalculationId}/retries": {
    parameters: [paramRef(calculationIdParam)],
    post: op(
      "retryWorkbookCalculation",
      "Retry workbook calculation",
      "201",
      calculationResponseSchema,
      retryCalculationRequestSchema,
    ),
  },
  "/workbook-calculations/{workbookCalculationId}/snapshots": {
    parameters: [paramRef(calculationIdParam)],
    get: op(
      "listWorkbookSnapshots",
      "List workbook snapshots",
      "200",
      snapshotsResponseSchema,
      undefined,
      [
        query("limit", { type: "integer", minimum: 1, maximum: 100 }),
        query("cursor", { type: "string" }),
      ],
    ),
  },
  "/workbook-snapshots/{workbookSnapshotId}": {
    parameters: [paramRef(snapshotIdParam)],
    get: op(
      "getWorkbookSnapshot",
      "Get workbook snapshot",
      "200",
      snapshotResponseSchema,
    ),
  },
  "/workbook-snapshots/{workbookSnapshotId}/metadata": {
    parameters: [paramRef(snapshotIdParam)],
    get: op(
      "getWorkbookSnapshotMetadata",
      "Get workbook snapshot metadata",
      "200",
      snapshotMetadataResponseSchema,
    ),
  },
  "/workbook-snapshots/{workbookSnapshotId}/sheets": {
    parameters: [paramRef(snapshotIdParam)],
    get: op(
      "listWorkbookSnapshotSheets",
      "List workbook snapshot sheets",
      "200",
      snapshotSheetsResponseSchema,
      undefined,
      [
        query("limit", {
          type: "integer",
          minimum: 1,
          maximum: MAX_WORKBOOK_SNAPSHOT_SHEET_PAGE_SIZE,
        }),
        query("cursor", { type: "string" }),
      ],
    ),
  },
  "/workbook-snapshots/{workbookSnapshotId}/sheets/{sheetIndex}/cells": {
    parameters: [paramRef(snapshotIdParam), paramRef(sheetIndexParam)],
    get: op(
      "getWorkbookSnapshotCells",
      "Get workbook snapshot cells",
      "200",
      snapshotCellsResponseSchema,
      undefined,
      [
        query("startRow", { type: "integer", minimum: 1 }, true),
        query("startColumn", { type: "integer", minimum: 1 }, true),
        query(
          "rowCount",
          {
            type: "integer",
            minimum: 1,
            maximum: MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_ROWS,
          },
          true,
        ),
        query(
          "columnCount",
          {
            type: "integer",
            minimum: 1,
            maximum: MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_COLUMNS,
          },
          true,
        ),
      ],
    ),
  },
  "/workbook-snapshots/{workbookSnapshotId}/range": {
    parameters: [paramRef(snapshotIdParam)],
    get: op(
      "getWorkbookSnapshotRange",
      "Get workbook snapshot range",
      "200",
      snapshotRangeResponseSchema,
      undefined,
      [
        {
          name: "ref",
          in: "query",
          required: true,
          schema: { type: "string", minLength: 1 },
        },
      ],
    ),
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
  "/workbook-snapshots/{workbookSnapshotId}/values": {
    parameters: [paramRef(snapshotIdParam)],
    get: op(
      "resolveWorkbookSnapshotValue",
      "Resolve workbook snapshot value",
      "200",
      valueResponseSchema,
      undefined,
      [
        {
          name: "ref",
          in: "query",
          required: true,
          schema: { type: "string", minLength: 1 },
        },
      ],
    ),
  },
  "/workbook-engine/health": {
    get: op(
      "getWorkbookEngineHealth",
      "Get workbook engine health",
      "200",
      healthResponseSchema,
    ),
  },
};

export const openapi: OpenAPI = {
  openapi: "3.1.0",
  info: { title: "Lemma Workbook API", version: "0.1.0" },
  tags: [tag],
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

function named(name: string, schema: Schema["schema"]): Schema {
  return { name, schema };
}

function response(name: string, description: string): Response {
  return {
    name,
    schema: {
      description,
      content: {
        "application/json": { schema: schemaRef(errorResponseSchema) },
      },
    },
  };
}

function objectWith(name: string, schema: SchemaOrRef): OpenApiSchema {
  return {
    type: "object",
    required: [name],
    properties: { [name]: schema },
  } satisfies OpenApiSchema;
}

function listWith(name: string, schema: SchemaOrRef): OpenApiSchema {
  return {
    type: "object",
    required: [name, "nextCursor"],
    properties: {
      [name]: { type: "array", items: schema },
      nextCursor: { type: ["string", "null"] },
    },
  } satisfies OpenApiSchema;
}

function query(
  name: string,
  schema: QuerySchema,
  required = false,
): QueryParameter {
  return { name, in: "query", required, schema };
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
    tags: [tagRef(tag)],
    summary,
    operationId,
    security: [keycloakSecurityRequirement],
    parameters,
    requestBody: requestSchema
      ? {
          required: true,
          content: { "application/json": { schema: schemaRef(requestSchema) } },
        }
      : undefined,
    responses: responseMap(status, responseSchema),
  };
}

function opNoBody(operationId: string, summary: string, status: string) {
  return {
    tags: [tagRef(tag)],
    summary,
    operationId,
    security: [keycloakSecurityRequirement],
    responses: {
      [status]: { description: summary },
      "401": responseRef(unauthorizedResponse),
      "403": responseRef(forbiddenResponse),
      "404": responseRef(notFoundResponse),
      "409": responseRef(conflictResponse),
    },
  };
}

function responseMap(status: string, responseSchema: Schema) {
  return {
    [status]: {
      description: responseSchema.name,
      content: { "application/json": { schema: schemaRef(responseSchema) } },
    },
    "400": responseRef(badRequestResponse),
    "401": responseRef(unauthorizedResponse),
    "403": responseRef(forbiddenResponse),
    "404": responseRef(notFoundResponse),
    "409": responseRef(conflictResponse),
    "502": responseRef(upstreamResponse),
  };
}
