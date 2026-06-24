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
  GLOBAL_ROLE_KEY_ACCEPTED_VALUES,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_ROLE_DESCRIPTION_LENGTH,
  MAX_ROLE_NAME_LENGTH,
  USER_STATUS_ACCEPTED_VALUES,
} from "../src/domain/index.ts";

const identityTag: Tag = {
  description:
    "Current user identity, user lookup, and role management operations.",
  name: "Identity",
};

const identityUserSchema: Schema = {
  name: "IdentityUser",
  schema: {
    properties: {
      createdAt: {
        example: "2026-05-03T14:30:00.000Z",
        format: "date-time",
        type: "string",
      },
      displayName: {
        example: "John Doe",
        maxLength: MAX_DISPLAY_NAME_LENGTH,
        minLength: 1,
        type: "string",
      },
      email: {
        example: "john@example.com",
        format: "email",
        minLength: 1,
        type: "string",
      },
      id: {
        ...uuidV7StringSchemaObject(),
      },
      identityId: {
        example: "2f8b6f77-0d7e-4120-9073-09f54a712941",
        minLength: 1,
        type: "string",
      },
      status: {
        enum: USER_STATUS_ACCEPTED_VALUES as unknown as string[],
        example: "active",
        type: "string",
      },
      updatedAt: {
        example: "2026-05-03T14:30:00.000Z",
        format: "date-time",
        type: "string",
      },
    },
    required: [
      "id",
      "identityId",
      "email",
      "displayName",
      "status",
      "createdAt",
      "updatedAt",
    ],
    type: "object",
  },
};

const roleSchema: Schema = {
  name: "Role",
  schema: {
    properties: {
      createdAt: {
        example: "2026-05-03T14:30:00.000Z",
        format: "date-time",
        type: "string",
      },
      description: {
        example: "Full administrative access.",
        maxLength: MAX_ROLE_DESCRIPTION_LENGTH,
        minLength: 1,
        type: "string",
      },
      id: {
        ...uuidV7StringSchemaObject(),
      },
      isSystem: {
        example: true,
        type: "boolean",
      },
      key: {
        example: "admin",
        minLength: 1,
        type: "string",
      },
      name: {
        example: "Administrator",
        maxLength: MAX_ROLE_NAME_LENGTH,
        minLength: 1,
        type: "string",
      },
      updatedAt: {
        example: "2026-05-03T14:30:00.000Z",
        format: "date-time",
        type: "string",
      },
    },
    required: [
      "id",
      "key",
      "name",
      "description",
      "isSystem",
      "createdAt",
      "updatedAt",
    ],
    type: "object",
  },
};

const userRoleSchema: Schema = {
  name: "UserRole",
  schema: {
    properties: {
      createdAt: {
        example: "2026-05-03T14:30:00.000Z",
        format: "date-time",
        type: "string",
      },
      expiresAt: {
        example: "2026-05-03T14:30:00.000Z",
        format: "date-time",
        type: "string",
      },
      grantedByUserId: {
        ...uuidV7StringSchemaObject(),
      },
      roleId: {
        ...uuidV7StringSchemaObject(),
      },
      roleKey: {
        enum: GLOBAL_ROLE_KEY_ACCEPTED_VALUES as unknown as string[],
        example: "admin",
        minLength: 1,
        type: "string",
      },
      userId: {
        ...uuidV7StringSchemaObject(),
      },
    },
    required: [
      "userId",
      "roleId",
      "roleKey",
      "grantedByUserId",
      "expiresAt",
      "createdAt",
    ],
    type: "object",
  },
};

const identityUserResponseSchema: Schema = {
  name: "IdentityUserResponse",
  schema: {
    properties: {
      user: schemaRef(identityUserSchema),
    },
    required: ["user"],
    type: "object",
  },
};

const listIdentityUsersResponseSchema: Schema = {
  name: "ListIdentityUsersResponse",
  schema: {
    properties: {
      users: {
        items: schemaRef(identityUserSchema),
        type: "array",
      },
    },
    required: ["users"],
    type: "object",
  },
};

const rolesResponseSchema: Schema = {
  name: "RolesResponse",
  schema: {
    properties: {
      roles: {
        items: schemaRef(roleSchema),
        type: "array",
      },
    },
    required: ["roles"],
    type: "object",
  },
};

const userRolesResponseSchema: Schema = {
  name: "UserRolesResponse",
  schema: {
    properties: {
      roles: {
        items: schemaRef(userRoleSchema),
        type: "array",
      },
    },
    required: ["roles"],
    type: "object",
  },
};

const updateCurrentUserRequestSchema: Schema = {
  name: "UpdateCurrentUserRequest",
  schema: {
    additionalProperties: false,
    properties: {
      displayName: {
        example: "John Doe",
        maxLength: MAX_DISPLAY_NAME_LENGTH,
        minLength: 1,
        type: "string",
      },
    },
    type: "object",
  },
};

const grantUserRoleRequestSchema: Schema = {
  name: "GrantUserRoleRequest",
  schema: {
    oneOf: [
      {
        additionalProperties: false,
        properties: {
          expiresAt: { format: "date-time", type: "string" },
          roleId: uuidV7StringSchemaObject(),
        },
        required: ["roleId", "expiresAt"],
        type: "object",
      },
      {
        additionalProperties: false,
        properties: {
          expiresAt: { format: "date-time", type: "string" },
          roleKey: {
            enum: GLOBAL_ROLE_KEY_ACCEPTED_VALUES as unknown as string[],
            minLength: 1,
            type: "string",
          },
        },
        required: ["roleKey", "expiresAt"],
        type: "object",
      },
    ],
  },
};

const upstreamAuthResponse: Response = {
  name: "UpstreamAuth",
  schema: {
    content: {
      "application/json": {
        schema: schemaRef(errorResponseSchema),
      },
    },
    description: "Identity provider token verification failed.",
  },
};

const identityUserParam: Param = {
  ...uuidV7Param("userId"),
  name: "IdentityUserParam",
};

const identityRoleParam: Param = {
  ...uuidV7Param("roleId"),
  name: "IdentityRoleParam",
};

export const tags: readonly Tag[] = Object.freeze([identityTag]);

export const schemas = Object.freeze([
  identityUserSchema,
  roleSchema,
  userRoleSchema,
  identityUserResponseSchema,
  listIdentityUsersResponseSchema,
  rolesResponseSchema,
  userRolesResponseSchema,
  updateCurrentUserRequestSchema,
  grantUserRoleRequestSchema,
]);

export const responses = Object.freeze([
  upstreamAuthResponse,
  badRequestResponse,
  forbiddenResponse,
  notFoundResponse,
]);

export const params = Object.freeze([identityUserParam, identityRoleParam]);

export const paths: Paths = Object.freeze({
  "/identity/me": {
    get: {
      operationId: "getCurrentIdentity",
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(identityUserResponseSchema),
            },
          },
          description: "Current identity user.",
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "502": responseRef(upstreamAuthResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Get current identity user",
      tags: [tagRef(identityTag)],
    },
    patch: {
      operationId: "updateCurrentIdentity",
      requestBody: {
        content: {
          "application/json": {
            schema: schemaRef(updateCurrentUserRequestSchema),
          },
        },
        required: true,
      },
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(identityUserResponseSchema),
            },
          },
          description: "Updated current identity user.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamAuthResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Update current identity user",
      tags: [tagRef(identityTag)],
    },
  },

  "/identity/me/roles": {
    get: {
      operationId: "getCurrentIdentityRoles",
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(userRolesResponseSchema),
            },
          },
          description: "Current identity user roles.",
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "502": responseRef(upstreamAuthResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Get current identity user roles",
      tags: [tagRef(identityTag)],
    },
  },

  "/identity/roles": {
    get: {
      operationId: "listIdentityRoles",
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(rolesResponseSchema),
            },
          },
          description: "Identity roles.",
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "502": responseRef(upstreamAuthResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "List identity roles",
      tags: [tagRef(identityTag)],
    },
  },

  "/identity/users": {
    get: {
      operationId: "listIdentityUsers",
      parameters: [
        {
          in: "query",
          name: "search",
          required: false,
          schema: {
            maxLength: 200,
            minLength: 1,
            type: "string",
          },
        },
        {
          in: "query",
          name: "status",
          required: false,
          schema: {
            enum: USER_STATUS_ACCEPTED_VALUES as unknown as string[],
            type: "string",
          },
        },
        {
          in: "query",
          name: "limit",
          required: false,
          schema: {
            default: 50,
            maximum: 200,
            minimum: 1,
            type: "integer",
          },
        },
      ],
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(listIdentityUsersResponseSchema),
            },
          },
          description: "Identity users.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "502": responseRef(upstreamAuthResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "List identity users",
      tags: [tagRef(identityTag)],
    },
  },

  "/identity/users/{userId}": {
    delete: {
      operationId: "deleteIdentityUser",
      parameters: [paramRef(identityUserParam)],
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(identityUserResponseSchema),
            },
          },
          description: "Deleted identity user.",
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamAuthResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Delete identity user by id",
      tags: [tagRef(identityTag)],
    },
    get: {
      operationId: "getIdentityUser",
      parameters: [paramRef(identityUserParam)],
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(identityUserResponseSchema),
            },
          },
          description: "Identity user.",
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamAuthResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Get identity user by id",
      tags: [tagRef(identityTag)],
    },
    patch: {
      operationId: "updateIdentityUser",
      parameters: [paramRef(identityUserParam)],
      requestBody: {
        content: {
          "application/json": {
            schema: schemaRef(updateCurrentUserRequestSchema),
          },
        },
        required: true,
      },
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(identityUserResponseSchema),
            },
          },
          description: "Updated identity user.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamAuthResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Update identity user by id",
      tags: [tagRef(identityTag)],
    },
  },

  "/identity/users/{userId}/activate": {
    post: {
      operationId: "activateIdentityUser",
      parameters: [paramRef(identityUserParam)],
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(identityUserResponseSchema),
            },
          },
          description: "Activated identity user.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamAuthResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Activate identity user by id",
      tags: [tagRef(identityTag)],
    },
  },

  "/identity/users/{userId}/disable": {
    post: {
      operationId: "disableIdentityUser",
      parameters: [paramRef(identityUserParam)],
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(identityUserResponseSchema),
            },
          },
          description: "Disabled identity user.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamAuthResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Disable identity user by id",
      tags: [tagRef(identityTag)],
    },
  },

  "/identity/users/{userId}/roles": {
    get: {
      operationId: "getIdentityUserRoles",
      parameters: [paramRef(identityUserParam)],
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(userRolesResponseSchema),
            },
          },
          description: "Identity user roles.",
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamAuthResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Get identity user roles",
      tags: [tagRef(identityTag)],
    },
    post: {
      operationId: "grantIdentityUserRole",
      parameters: [paramRef(identityUserParam)],
      requestBody: {
        content: {
          "application/json": {
            schema: schemaRef(grantUserRoleRequestSchema),
          },
        },
        required: true,
      },
      responses: {
        "204": {
          description: "Role granted.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamAuthResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Grant role to identity user",
      tags: [tagRef(identityTag)],
    },
  },

  "/identity/users/{userId}/roles/{roleId}": {
    delete: {
      operationId: "revokeIdentityUserRole",
      parameters: [paramRef(identityUserParam), paramRef(identityRoleParam)],
      responses: {
        "204": {
          description: "Role revoked.",
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamAuthResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Revoke role from identity user",
      tags: [tagRef(identityTag)],
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
    title: "Lemma Identity API",
    version: "0.1.0",
  },
  openapi: "3.1.0",
  paths,
  tags: [identityTag],
};
