import {
  badRequestResponse,
  errorResponseSchema,
  forbiddenResponse,
  keycloakSecurityRequirement,
  keycloakSecurityScheme,
  type OpenAPI,
  type Param,
  type Paths,
  notFoundResponse,
  paramRef,
  responseRef,
  type Schema,
  schemaRef,
  type Tag,
  tagRef,
  unauthorizedResponse,
  uuidV7Param,
  uuidV7StringSchemaObject,
} from "@lemma/http/openapi";

type OpenApiSchema = Schema["schema"];

const opsTag: Tag = {
  name: "Ops",
  description: "Operational outbox and queue review tools.",
};

const dateTime = { type: "string", format: "date-time" } satisfies OpenApiSchema;
const nullableDateTime = {
  type: ["string", "null"],
  format: "date-time",
} satisfies OpenApiSchema;
const nullableJsonObject = {
  type: ["object", "null"],
  additionalProperties: true,
} satisfies OpenApiSchema;
const nullableString = { type: ["string", "null"] } satisfies OpenApiSchema;
const uuidString = {
  type: "string",
  pattern:
    "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
} satisfies OpenApiSchema;
const nullableUuid = {
  type: ["string", "null"],
  pattern:
    "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
} satisfies OpenApiSchema;
const nullableUuidV7 = {
  type: ["string", "null"],
  pattern:
    "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-7[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
} satisfies OpenApiSchema;

const opsOverviewSchema: Schema = {
  name: "OpsOverview",
  schema: {
    type: "object",
    required: ["outbox", "queue"],
    additionalProperties: false,
    properties: {
      outbox: {
        type: "object",
        required: [
          "pendingCount",
          "publishingCount",
          "publishedCount",
          "failedCount",
          "oldestPendingCreatedAt",
        ],
        additionalProperties: false,
        properties: {
          pendingCount: { type: "integer", minimum: 0 },
          publishingCount: { type: "integer", minimum: 0 },
          publishedCount: { type: "integer", minimum: 0 },
          failedCount: { type: "integer", minimum: 0 },
          oldestPendingCreatedAt: nullableDateTime,
        },
      },
      queue: {
        type: "object",
        required: [
          "available",
          "pendingCount",
          "completedCount",
          "failedCount",
          "oldestPendingCreatedAt",
        ],
        additionalProperties: false,
        properties: {
          available: { type: "boolean" },
          pendingCount: { type: "integer", minimum: 0 },
          completedCount: { type: "integer", minimum: 0 },
          failedCount: { type: "integer", minimum: 0 },
          oldestPendingCreatedAt: nullableDateTime,
        },
      },
    },
  },
};

const opsOutboxEventReviewSchema: Schema = {
  name: "OpsOutboxEventReview",
  schema: {
    type: "object",
    required: ["action", "note", "actorUserId", "actorEmail", "createdAt"],
    additionalProperties: false,
    properties: {
      action: {
        type: "string",
        enum: ["reviewed", "ignored", "replayed"],
      },
      note: nullableString,
      actorUserId: nullableUuidV7,
      actorEmail: nullableString,
      createdAt: dateTime,
    },
  },
};

const opsOutboxEventSchema: Schema = {
  name: "OpsOutboxEvent",
  schema: {
    type: "object",
    required: [
      "id",
      "eventType",
      "aggregateType",
      "aggregateId",
      "ownerUserId",
      "requestId",
      "correlationId",
      "causationId",
      "status",
      "attempts",
      "availableAt",
      "lockedBy",
      "lockedAt",
      "publishedAt",
      "lastError",
      "createdAt",
      "updatedAt",
      "latestReview",
    ],
    additionalProperties: false,
    properties: {
      id: uuidV7StringSchemaObject(),
      eventType: { type: "string", minLength: 1 },
      aggregateType: { type: "string", minLength: 1 },
      aggregateId: { type: "string", minLength: 1 },
      ownerUserId: nullableUuidV7,
      requestId: uuidString,
      correlationId: uuidString,
      causationId: nullableUuid,
      status: {
        type: "string",
        enum: ["pending", "publishing", "published", "failed"],
      },
      attempts: { type: "integer", minimum: 0 },
      availableAt: dateTime,
      lockedBy: nullableString,
      lockedAt: nullableDateTime,
      publishedAt: nullableDateTime,
      lastError: nullableString,
      createdAt: dateTime,
      updatedAt: dateTime,
      latestReview: {
        oneOf: [schemaRef(opsOutboxEventReviewSchema), { type: "null" }],
      },
    },
  },
};

const listOpsOutboxEventsResponseSchema: Schema = {
  name: "ListOpsOutboxEventsResponse",
  schema: {
    type: "object",
    required: ["events"],
    additionalProperties: false,
    properties: {
      events: {
        type: "array",
        items: schemaRef(opsOutboxEventSchema),
      },
    },
  },
};

const opsOutboxEventResponseSchema: Schema = {
  name: "OpsOutboxEventResponse",
  schema: {
    type: "object",
    required: ["event"],
    additionalProperties: false,
    properties: {
      event: schemaRef(opsOutboxEventSchema),
    },
  },
};

const opsQueueJobSchema: Schema = {
  name: "OpsQueueJob",
  schema: {
    type: "object",
    required: [
      "id",
      "name",
      "state",
      "retryCount",
      "retryLimit",
      "data",
      "output",
      "createdOn",
      "startedOn",
      "completedOn",
    ],
    additionalProperties: false,
    properties: {
      id: { type: "string", minLength: 1 },
      name: { type: "string", minLength: 1 },
      state: { type: "string", minLength: 1 },
      retryCount: { type: "integer", minimum: 0 },
      retryLimit: { type: "integer", minimum: 0 },
      data: nullableJsonObject,
      output: nullableJsonObject,
      createdOn: nullableDateTime,
      startedOn: nullableDateTime,
      completedOn: nullableDateTime,
    },
  },
};

const listOpsFailedQueueJobsResponseSchema: Schema = {
  name: "ListOpsFailedQueueJobsResponse",
  schema: {
    type: "object",
    required: ["jobs"],
    additionalProperties: false,
    properties: {
      jobs: {
        type: "array",
        items: schemaRef(opsQueueJobSchema),
      },
    },
  },
};

const reviewOpsOutboxEventRequestSchema: Schema = {
  name: "ReviewOpsOutboxEventRequest",
  schema: {
    type: "object",
    required: ["action"],
    additionalProperties: false,
    properties: {
      action: {
        type: "string",
        enum: ["reviewed", "ignored"],
      },
      note: {
        type: ["string", "null"],
        maxLength: 2000,
      },
    },
  },
};

const replayOpsOutboxEventRequestSchema: Schema = {
  name: "ReplayOpsOutboxEventRequest",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      note: {
        type: ["string", "null"],
        maxLength: 2000,
      },
    },
  },
};

const outboxEventParam: Param = {
  ...uuidV7Param("eventId"),
  name: "OpsOutboxEventParam",
};

const limitParameter = {
  name: "limit",
  in: "query" as const,
  required: false,
  schema: {
    type: "integer",
    minimum: 1,
    maximum: 100,
    default: 50,
  },
} satisfies Param["schema"];

const queueStateParameter = {
  name: "state",
  in: "query" as const,
  required: false,
  schema: {
    type: "string",
    enum: [
      "all",
      "pending",
      "active",
      "successful",
      "created",
      "retry",
      "completed",
      "failed",
      "expired",
      "cancelled",
    ],
    default: "all",
  },
} satisfies Param["schema"];

export const tags: readonly Tag[] = Object.freeze([opsTag]);

export const schemas = Object.freeze([
  opsOverviewSchema,
  opsOutboxEventReviewSchema,
  opsOutboxEventSchema,
  listOpsOutboxEventsResponseSchema,
  opsOutboxEventResponseSchema,
  opsQueueJobSchema,
  listOpsFailedQueueJobsResponseSchema,
  reviewOpsOutboxEventRequestSchema,
  replayOpsOutboxEventRequestSchema,
]);

export const responses = Object.freeze([
  badRequestResponse,
  forbiddenResponse,
  notFoundResponse,
]);

export const params = Object.freeze([outboxEventParam]);

export const paths: Paths = Object.freeze({
  "/ops/overview": {
    get: {
      tags: [tagRef(opsTag)],
      summary: "Get ops overview",
      operationId: "getOpsOverview",
      security: [keycloakSecurityRequirement],
      responses: {
        "200": {
          description: "Operational overview.",
          content: {
            "application/json": {
              schema: schemaRef(opsOverviewSchema),
            },
          },
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
      },
    },
  },

  "/ops/outbox-events": {
    get: {
      tags: [tagRef(opsTag)],
      summary: "List failed outbox events",
      operationId: "listOpsOutboxEvents",
      security: [keycloakSecurityRequirement],
      parameters: [
        {
          name: "status",
          in: "query" as const,
          required: false,
          schema: {
            type: "string" as const,
            enum: ["all", "pending", "publishing", "published", "failed"],
            default: "failed",
          },
        },
        {
          name: "reviewState",
          in: "query" as const,
          required: false,
          schema: {
            type: "string" as const,
            enum: ["all", "unreviewed", "reviewed", "ignored"],
            default: "all",
          },
        },
        limitParameter,
      ],
      responses: {
        "200": {
          description: "Failed outbox events.",
          content: {
            "application/json": {
              schema: schemaRef(listOpsOutboxEventsResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
      },
    },
  },

  "/ops/outbox-events/{eventId}/review": {
    parameters: [paramRef(outboxEventParam)],
    post: {
      tags: [tagRef(opsTag)],
      summary: "Review failed outbox event",
      operationId: "reviewOpsOutboxEvent",
      security: [keycloakSecurityRequirement],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: schemaRef(reviewOpsOutboxEventRequestSchema),
          },
        },
      },
      responses: {
        "200": {
          description: "Outbox event review saved.",
          content: {
            "application/json": {
              schema: schemaRef(opsOutboxEventResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
      },
    },
  },

  "/ops/outbox-events/{eventId}/replay": {
    parameters: [paramRef(outboxEventParam)],
    post: {
      tags: [tagRef(opsTag)],
      summary: "Replay failed outbox event",
      operationId: "replayOpsOutboxEvent",
      security: [keycloakSecurityRequirement],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: schemaRef(replayOpsOutboxEventRequestSchema),
          },
        },
      },
      responses: {
        "200": {
          description: "Outbox event queued for replay.",
          content: {
            "application/json": {
              schema: schemaRef(opsOutboxEventResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
      },
    },
  },

  "/ops/queue-jobs/failed": {
    get: {
      tags: [tagRef(opsTag)],
      summary: "List failed queue jobs",
      operationId: "listOpsFailedQueueJobs",
      security: [keycloakSecurityRequirement],
      parameters: [limitParameter],
      responses: {
        "200": {
          description: "Failed queue jobs.",
          content: {
            "application/json": {
              schema: schemaRef(listOpsFailedQueueJobsResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
      },
    },
  },

  "/ops/queue-jobs": {
    get: {
      tags: [tagRef(opsTag)],
      summary: "List queue jobs",
      operationId: "listOpsQueueJobs",
      security: [keycloakSecurityRequirement],
      parameters: [queueStateParameter, limitParameter],
      responses: {
        "200": {
          description: "Queue jobs.",
          content: {
            "application/json": {
              schema: schemaRef(listOpsFailedQueueJobsResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
      },
    },
  },
});

export const openapi: OpenAPI = {
  openapi: "3.1.0",
  info: {
    title: "Lemma Ops API",
    version: "0.1.0",
  },
  tags: [opsTag],
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
