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
  name: "Identity",
  description:
    "Current user identity, user lookup, and role management operations.",
};

const identityUserSchema: Schema = {
  name: "IdentityUser",
  schema: {
    type: "object",
    required: [
      "id",
      "identityId",
      "email",
      "displayName",
      "status",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      id: {
        ...uuidV7StringSchemaObject(),
      },
      identityId: {
        type: "string",
        minLength: 1,
        example: "2f8b6f77-0d7e-4120-9073-09f54a712941",
      },
      email: {
        type: "string",
        format: "email",
        minLength: 1,
        example: "john@example.com",
      },
      displayName: {
        type: "string",
        minLength: 1,
        maxLength: MAX_DISPLAY_NAME_LENGTH,
        example: "John Doe",
      },
      status: {
        type: "string",
        enum: USER_STATUS_ACCEPTED_VALUES as unknown as string[],
        example: "active",
      },
      createdAt: {
        type: "string",
        format: "date-time",
        example: "2026-05-03T14:30:00.000Z",
      },
      updatedAt: {
        type: "string",
        format: "date-time",
        example: "2026-05-03T14:30:00.000Z",
      },
    },
  },
};

const roleSchema: Schema = {
  name: "Role",
  schema: {
    type: "object",
    required: [
      "id",
      "key",
      "name",
      "description",
      "isSystem",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      id: {
        ...uuidV7StringSchemaObject(),
      },
      key: {
        type: "string",
        minLength: 1,
        example: "admin",
      },
      name: {
        type: "string",
        minLength: 1,
        maxLength: MAX_ROLE_NAME_LENGTH,
        example: "Administrator",
      },
      description: {
        type: "string",
        minLength: 1,
        maxLength: MAX_ROLE_DESCRIPTION_LENGTH,
        example: "Full administrative access.",
      },
      isSystem: {
        type: "boolean",
        example: true,
      },
      createdAt: {
        type: "string",
        format: "date-time",
        example: "2026-05-03T14:30:00.000Z",
      },
      updatedAt: {
        type: "string",
        format: "date-time",
        example: "2026-05-03T14:30:00.000Z",
      },
    },
  },
};

const userRoleSchema: Schema = {
  name: "UserRole",
  schema: {
    type: "object",
    required: [
      "userId",
      "roleId",
      "roleKey",
      "grantedByUserId",
      "expiresAt",
      "createdAt",
    ],
    properties: {
      userId: {
        ...uuidV7StringSchemaObject(),
      },
      roleId: {
        ...uuidV7StringSchemaObject(),
      },
      roleKey: {
        type: "string",
        enum: GLOBAL_ROLE_KEY_ACCEPTED_VALUES as unknown as string[],
        minLength: 1,
        example: "admin",
      },
      grantedByUserId: {
        ...uuidV7StringSchemaObject(),
      },
      expiresAt: {
        type: "string",
        format: "date-time",
        example: "2026-05-03T14:30:00.000Z",
      },
      createdAt: {
        type: "string",
        format: "date-time",
        example: "2026-05-03T14:30:00.000Z",
      },
    },
  },
};

const identityUserResponseSchema: Schema = {
  name: "IdentityUserResponse",
  schema: {
    type: "object",
    required: ["user"],
    properties: {
      user: schemaRef(identityUserSchema),
    },
  },
};

const listIdentityUsersResponseSchema: Schema = {
  name: "ListIdentityUsersResponse",
  schema: {
    type: "object",
    required: ["users"],
    properties: {
      users: {
        type: "array",
        items: schemaRef(identityUserSchema),
      },
    },
  },
};

const rolesResponseSchema: Schema = {
  name: "RolesResponse",
  schema: {
    type: "object",
    required: ["roles"],
    properties: {
      roles: {
        type: "array",
        items: schemaRef(roleSchema),
      },
    },
  },
};

const userRolesResponseSchema: Schema = {
  name: "UserRolesResponse",
  schema: {
    type: "object",
    required: ["roles"],
    properties: {
      roles: {
        type: "array",
        items: schemaRef(userRoleSchema),
      },
    },
  },
};

const updateCurrentUserRequestSchema: Schema = {
  name: "UpdateCurrentUserRequest",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      displayName: {
        type: "string",
        minLength: 1,
        maxLength: MAX_DISPLAY_NAME_LENGTH,
        example: "John Doe",
      },
    },
  },
};

const grantUserRoleRequestSchema: Schema = {
  name: "GrantUserRoleRequest",
  schema: {
    oneOf: [
      {
        type: "object",
        additionalProperties: false,
        required: ["roleId", "expiresAt"],
        properties: {
          roleId: uuidV7StringSchemaObject(),
          expiresAt: { type: "string", format: "date-time" },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["roleKey", "expiresAt"],
        properties: {
          roleKey: {
            type: "string",
            enum: GLOBAL_ROLE_KEY_ACCEPTED_VALUES as unknown as string[],
            minLength: 1,
          },
          expiresAt: { type: "string", format: "date-time" },
        },
      },
    ],
  },
};

const upstreamAuthResponse: Response = {
  name: "UpstreamAuth",
  schema: {
    description: "Identity provider token verification failed.",
    content: {
      "application/json": {
        schema: schemaRef(errorResponseSchema),
      },
    },
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
      tags: [tagRef(identityTag)],
      summary: "Get current identity user",
      operationId: "getCurrentIdentity",
      security: [keycloakSecurityRequirement],
      responses: {
        "200": {
          description: "Current identity user.",
          content: {
            "application/json": {
              schema: schemaRef(identityUserResponseSchema),
            },
          },
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "502": responseRef(upstreamAuthResponse),
      },
    },
    patch: {
      tags: [tagRef(identityTag)],
      summary: "Update current identity user",
      operationId: "updateCurrentIdentity",
      security: [keycloakSecurityRequirement],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: schemaRef(updateCurrentUserRequestSchema),
          },
        },
      },
      responses: {
        "200": {
          description: "Updated current identity user.",
          content: {
            "application/json": {
              schema: schemaRef(identityUserResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamAuthResponse),
      },
    },
  },

  "/identity/me/roles": {
    get: {
      tags: [tagRef(identityTag)],
      summary: "Get current identity user roles",
      operationId: "getCurrentIdentityRoles",
      security: [keycloakSecurityRequirement],
      responses: {
        "200": {
          description: "Current identity user roles.",
          content: {
            "application/json": {
              schema: schemaRef(userRolesResponseSchema),
            },
          },
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "502": responseRef(upstreamAuthResponse),
      },
    },
  },

  "/identity/users": {
    get: {
      tags: [tagRef(identityTag)],
      summary: "List identity users",
      operationId: "listIdentityUsers",
      security: [keycloakSecurityRequirement],
      parameters: [
        {
          name: "search",
          in: "query",
          required: false,
          schema: {
            type: "string",
            minLength: 1,
            maxLength: 200,
          },
        },
        {
          name: "status",
          in: "query",
          required: false,
          schema: {
            type: "string",
            enum: USER_STATUS_ACCEPTED_VALUES as unknown as string[],
          },
        },
        {
          name: "limit",
          in: "query",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            maximum: 200,
            default: 50,
          },
        },
      ],
      responses: {
        "200": {
          description: "Identity users.",
          content: {
            "application/json": {
              schema: schemaRef(listIdentityUsersResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "502": responseRef(upstreamAuthResponse),
      },
    },
  },

  "/identity/users/{userId}": {
    get: {
      tags: [tagRef(identityTag)],
      summary: "Get identity user by id",
      operationId: "getIdentityUser",
      security: [keycloakSecurityRequirement],
      parameters: [paramRef(identityUserParam)],
      responses: {
        "200": {
          description: "Identity user.",
          content: {
            "application/json": {
              schema: schemaRef(identityUserResponseSchema),
            },
          },
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamAuthResponse),
      },
    },
    patch: {
      tags: [tagRef(identityTag)],
      summary: "Update identity user by id",
      operationId: "updateIdentityUser",
      security: [keycloakSecurityRequirement],
      parameters: [paramRef(identityUserParam)],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: schemaRef(updateCurrentUserRequestSchema),
          },
        },
      },
      responses: {
        "200": {
          description: "Updated identity user.",
          content: {
            "application/json": {
              schema: schemaRef(identityUserResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamAuthResponse),
      },
    },
    delete: {
      tags: [tagRef(identityTag)],
      summary: "Delete identity user by id",
      operationId: "deleteIdentityUser",
      security: [keycloakSecurityRequirement],
      parameters: [paramRef(identityUserParam)],
      responses: {
        "200": {
          description: "Deleted identity user.",
          content: {
            "application/json": {
              schema: schemaRef(identityUserResponseSchema),
            },
          },
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamAuthResponse),
      },
    },
  },

  "/identity/users/{userId}/activate": {
    post: {
      tags: [tagRef(identityTag)],
      summary: "Activate identity user by id",
      operationId: "activateIdentityUser",
      security: [keycloakSecurityRequirement],
      parameters: [paramRef(identityUserParam)],
      responses: {
        "200": {
          description: "Activated identity user.",
          content: {
            "application/json": {
              schema: schemaRef(identityUserResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamAuthResponse),
      },
    },
  },

  "/identity/users/{userId}/disable": {
    post: {
      tags: [tagRef(identityTag)],
      summary: "Disable identity user by id",
      operationId: "disableIdentityUser",
      security: [keycloakSecurityRequirement],
      parameters: [paramRef(identityUserParam)],
      responses: {
        "200": {
          description: "Disabled identity user.",
          content: {
            "application/json": {
              schema: schemaRef(identityUserResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamAuthResponse),
      },
    },
  },

  "/identity/users/{userId}/roles": {
    get: {
      tags: [tagRef(identityTag)],
      summary: "Get identity user roles",
      operationId: "getIdentityUserRoles",
      security: [keycloakSecurityRequirement],
      parameters: [paramRef(identityUserParam)],
      responses: {
        "200": {
          description: "Identity user roles.",
          content: {
            "application/json": {
              schema: schemaRef(userRolesResponseSchema),
            },
          },
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamAuthResponse),
      },
    },
    post: {
      tags: [tagRef(identityTag)],
      summary: "Grant role to identity user",
      operationId: "grantIdentityUserRole",
      security: [keycloakSecurityRequirement],
      parameters: [paramRef(identityUserParam)],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: schemaRef(grantUserRoleRequestSchema),
          },
        },
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
    },
  },

  "/identity/users/{userId}/roles/{roleId}": {
    delete: {
      tags: [tagRef(identityTag)],
      summary: "Revoke role from identity user",
      operationId: "revokeIdentityUserRole",
      security: [keycloakSecurityRequirement],
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
    },
  },

  "/identity/roles": {
    get: {
      tags: [tagRef(identityTag)],
      summary: "List identity roles",
      operationId: "listIdentityRoles",
      security: [keycloakSecurityRequirement],
      responses: {
        "200": {
          description: "Identity roles.",
          content: {
            "application/json": {
              schema: schemaRef(rolesResponseSchema),
            },
          },
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "502": responseRef(upstreamAuthResponse),
      },
    },
  },
});

export const openapi: OpenAPI = {
  openapi: "3.1.0",
  info: {
    title: "Lemma Identity API",
    version: "0.1.0",
  },
  tags: [identityTag],
  components: {
    securitySchemes: Object.fromEntries([
      [keycloakSecurityScheme.name, keycloakSecurityScheme.securitySchema],
    ]),
    schemas: Object.fromEntries([
      ...schemas.map((schema) => [schema.name, schema.schema]),
      [errorResponseSchema.name, errorResponseSchema.schema],
    ]),
    responses: Object.fromEntries([
      ...responses.map((resp) => [resp.name, resp.schema]),
      [unauthorizedResponse.name, unauthorizedResponse.schema],
    ]),
    parameters: Object.fromEntries(
      params.map((param) => [param.name, param.schema]),
    ),
  },
  paths,
};
