import {
  badRequestResponse,
  errorResponseSchema,
  forbiddenResponse,
  keycloakSecurityRequirement,
  keycloakSecurityScheme,
  notFoundResponse,
  type OpenAPI,
  type Param,
  type Paths,
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
  description: "Operational outbox and queue review tools.",
  name: "Ops",
};

const dateTime = {
  format: "date-time",
  type: "string",
} satisfies OpenApiSchema;
const nullableDateTime = {
  format: "date-time",
  type: ["string", "null"],
} satisfies OpenApiSchema;
const nullableJsonObject = {
  additionalProperties: true,
  type: ["object", "null"],
} satisfies OpenApiSchema;
const nullableString = { type: ["string", "null"] } satisfies OpenApiSchema;
const uuidString = {
  pattern:
    "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
  type: "string",
} satisfies OpenApiSchema;
const nullableUuid = {
  pattern:
    "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
  type: ["string", "null"],
} satisfies OpenApiSchema;
const nullableUuidV7 = {
  pattern:
    "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-7[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
  type: ["string", "null"],
} satisfies OpenApiSchema;

const opsOverviewSchema: Schema = {
  name: "OpsOverview",
  schema: {
    additionalProperties: false,
    properties: {
      outbox: {
        additionalProperties: false,
        properties: {
          failedCount: { minimum: 0, type: "integer" },
          oldestPendingCreatedAt: nullableDateTime,
          pendingCount: { minimum: 0, type: "integer" },
          publishedCount: { minimum: 0, type: "integer" },
          publishingCount: { minimum: 0, type: "integer" },
        },
        required: [
          "pendingCount",
          "publishingCount",
          "publishedCount",
          "failedCount",
          "oldestPendingCreatedAt",
        ],
        type: "object",
      },
      queue: {
        additionalProperties: false,
        properties: {
          available: { type: "boolean" },
          completedCount: { minimum: 0, type: "integer" },
          failedCount: { minimum: 0, type: "integer" },
          oldestPendingCreatedAt: nullableDateTime,
          pendingCount: { minimum: 0, type: "integer" },
        },
        required: [
          "available",
          "pendingCount",
          "completedCount",
          "failedCount",
          "oldestPendingCreatedAt",
        ],
        type: "object",
      },
    },
    required: ["outbox", "queue"],
    type: "object",
  },
};

const opsOutboxEventReviewSchema: Schema = {
  name: "OpsOutboxEventReview",
  schema: {
    additionalProperties: false,
    properties: {
      action: {
        enum: ["reviewed", "ignored", "replayed"],
        type: "string",
      },
      actorEmail: nullableString,
      actorUserId: nullableUuidV7,
      createdAt: dateTime,
      note: nullableString,
    },
    required: ["action", "note", "actorUserId", "actorEmail", "createdAt"],
    type: "object",
  },
};

const opsOutboxEventSchema: Schema = {
  name: "OpsOutboxEvent",
  schema: {
    additionalProperties: false,
    properties: {
      aggregateId: { minLength: 1, type: "string" },
      aggregateType: { minLength: 1, type: "string" },
      attempts: { minimum: 0, type: "integer" },
      availableAt: dateTime,
      causationId: nullableUuid,
      correlationId: uuidString,
      createdAt: dateTime,
      eventType: { minLength: 1, type: "string" },
      id: uuidV7StringSchemaObject(),
      lastError: nullableString,
      latestReview: {
        oneOf: [schemaRef(opsOutboxEventReviewSchema), { type: "null" }],
      },
      lockedAt: nullableDateTime,
      lockedBy: nullableString,
      ownerUserId: nullableUuidV7,
      publishedAt: nullableDateTime,
      requestId: uuidString,
      status: {
        enum: ["pending", "publishing", "published", "failed"],
        type: "string",
      },
      updatedAt: dateTime,
    },
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
    type: "object",
  },
};

const listOpsOutboxEventsResponseSchema: Schema = {
  name: "ListOpsOutboxEventsResponse",
  schema: {
    additionalProperties: false,
    properties: {
      events: {
        items: schemaRef(opsOutboxEventSchema),
        type: "array",
      },
    },
    required: ["events"],
    type: "object",
  },
};

const opsOutboxEventResponseSchema: Schema = {
  name: "OpsOutboxEventResponse",
  schema: {
    additionalProperties: false,
    properties: {
      event: schemaRef(opsOutboxEventSchema),
    },
    required: ["event"],
    type: "object",
  },
};

const opsQueueJobSchema: Schema = {
  name: "OpsQueueJob",
  schema: {
    additionalProperties: false,
    properties: {
      completedOn: nullableDateTime,
      createdOn: nullableDateTime,
      data: nullableJsonObject,
      id: { minLength: 1, type: "string" },
      name: { minLength: 1, type: "string" },
      output: nullableJsonObject,
      retryCount: { minimum: 0, type: "integer" },
      retryLimit: { minimum: 0, type: "integer" },
      startedOn: nullableDateTime,
      state: { minLength: 1, type: "string" },
    },
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
    type: "object",
  },
};

const listOpsFailedQueueJobsResponseSchema: Schema = {
  name: "ListOpsFailedQueueJobsResponse",
  schema: {
    additionalProperties: false,
    properties: {
      jobs: {
        items: schemaRef(opsQueueJobSchema),
        type: "array",
      },
    },
    required: ["jobs"],
    type: "object",
  },
};

const reviewOpsOutboxEventRequestSchema: Schema = {
  name: "ReviewOpsOutboxEventRequest",
  schema: {
    additionalProperties: false,
    properties: {
      action: {
        enum: ["reviewed", "ignored"],
        type: "string",
      },
      note: {
        maxLength: 2000,
        type: ["string", "null"],
      },
    },
    required: ["action"],
    type: "object",
  },
};

const replayOpsOutboxEventRequestSchema: Schema = {
  name: "ReplayOpsOutboxEventRequest",
  schema: {
    additionalProperties: false,
    properties: {
      note: {
        maxLength: 2000,
        type: ["string", "null"],
      },
    },
    type: "object",
  },
};

const outboxEventParam: Param = {
  ...uuidV7Param("eventId"),
  name: "OpsOutboxEventParam",
};

const limitParameter = {
  in: "query" as const,
  name: "limit",
  required: false,
  schema: {
    default: 50,
    maximum: 100,
    minimum: 1,
    type: "integer",
  },
} satisfies Param["schema"];

const queueStateParameter = {
  in: "query" as const,
  name: "state",
  required: false,
  schema: {
    default: "all",
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
    type: "string",
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
  "/ops/outbox-events": {
    get: {
      operationId: "listOpsOutboxEvents",
      parameters: [
        {
          in: "query" as const,
          name: "status",
          required: false,
          schema: {
            default: "failed",
            enum: ["all", "pending", "publishing", "published", "failed"],
            type: "string" as const,
          },
        },
        {
          in: "query" as const,
          name: "reviewState",
          required: false,
          schema: {
            default: "all",
            enum: ["all", "unreviewed", "reviewed", "ignored"],
            type: "string" as const,
          },
        },
        limitParameter,
      ],
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(listOpsOutboxEventsResponseSchema),
            },
          },
          description: "Failed outbox events.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "List failed outbox events",
      tags: [tagRef(opsTag)],
    },
  },

  "/ops/outbox-events/{eventId}/replay": {
    parameters: [paramRef(outboxEventParam)],
    post: {
      operationId: "replayOpsOutboxEvent",
      requestBody: {
        content: {
          "application/json": {
            schema: schemaRef(replayOpsOutboxEventRequestSchema),
          },
        },
        required: true,
      },
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(opsOutboxEventResponseSchema),
            },
          },
          description: "Outbox event queued for replay.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Replay failed outbox event",
      tags: [tagRef(opsTag)],
    },
  },

  "/ops/outbox-events/{eventId}/review": {
    parameters: [paramRef(outboxEventParam)],
    post: {
      operationId: "reviewOpsOutboxEvent",
      requestBody: {
        content: {
          "application/json": {
            schema: schemaRef(reviewOpsOutboxEventRequestSchema),
          },
        },
        required: true,
      },
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(opsOutboxEventResponseSchema),
            },
          },
          description: "Outbox event review saved.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Review failed outbox event",
      tags: [tagRef(opsTag)],
    },
  },
  "/ops/overview": {
    get: {
      operationId: "getOpsOverview",
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(opsOverviewSchema),
            },
          },
          description: "Operational overview.",
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Get ops overview",
      tags: [tagRef(opsTag)],
    },
  },

  "/ops/queue-jobs": {
    get: {
      operationId: "listOpsQueueJobs",
      parameters: [queueStateParameter, limitParameter],
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(listOpsFailedQueueJobsResponseSchema),
            },
          },
          description: "Queue jobs.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "List queue jobs",
      tags: [tagRef(opsTag)],
    },
  },

  "/ops/queue-jobs/failed": {
    get: {
      operationId: "listOpsFailedQueueJobs",
      parameters: [limitParameter],
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(listOpsFailedQueueJobsResponseSchema),
            },
          },
          description: "Failed queue jobs.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "List failed queue jobs",
      tags: [tagRef(opsTag)],
    },
  },
});

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
    title: "Lemma Ops API",
    version: "0.1.0",
  },
  openapi: "3.1.0",
  paths,
  tags: [opsTag],
};
