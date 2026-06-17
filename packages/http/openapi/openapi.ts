import type { OpenAPIV3_1 } from "openapi-types";

export type SecuritySchema = {
  name: string;
  securitySchema: OpenAPIV3_1.SecuritySchemeObject;
};

export type Schema = {
  name: string;
  schema: OpenAPIV3_1.SchemaObject;
};

export type Tag = OpenAPIV3_1.TagObject;

export type Response = {
  name: string;
  schema: OpenAPIV3_1.ResponseObject;
};

export type Param = {
  name: string;
  schema: OpenAPIV3_1.ParameterObject;
};

export function schemaRef<S extends Schema = Schema>(schema: S) {
  return {
    $ref: `#/components/schemas/${schema.name}`,
  };
}

export function responseRef<R extends Response = Response>(resp: R) {
  return {
    $ref: `#/components/responses/${resp.name}`,
  };
}

export function paramRef<P extends Param = Param>(param: P) {
  return {
    $ref: `#/components/parameters/${param.name}`,
  };
}

export function tagRef<T extends Tag = Tag>(tag: T) {
  return tag.name;
}

export const keycloakSecurityScheme: SecuritySchema = {
  name: "keycloakAccessToken",
  securitySchema: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  },
};

export const keycloakSecurityRequirement: OpenAPIV3_1.SecurityRequirementObject =
  {
    [keycloakSecurityScheme.name]: [],
  };

export type SchemaObject = Readonly<OpenAPIV3_1.SchemaObject>;
export type OpenAPI = Readonly<OpenAPIV3_1.Document>;
export type Paths = Readonly<OpenAPIV3_1.PathsObject>;

export type MutableJsonSchema = Record<string, unknown>;
type ParameterSchema = NonNullable<OpenAPIV3_1.ParameterObject["schema"]>;

export const UUID_V7_OPENAPI_PATTERN =
  "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-7[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$";

export function uuidV7StringSchemaObject(
  example = "019e8278-6746-768e-b90b-3c6d2fb8267f",
): OpenAPIV3_1.SchemaObject {
  return {
    type: "string",
    pattern: UUID_V7_OPENAPI_PATTERN,
    example,
  };
}

export function uuidV7Param(name: string, example?: string): Param {
  return {
    name,
    schema: {
      name,
      in: "path",
      required: true,
      schema: uuidV7StringSchemaObject(example) as ParameterSchema,
    },
  };
}

export const errorResponseSchema: Schema = {
  name: "ErrorResponse",
  schema: {
    type: "object",
    required: ["error"],
    properties: {
      error: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: {
            type: "string",
          },
          message: {
            type: "string",
          },
          requestId: {
            type: "string",
          },
          details: {},
        },
      },
    },
  },
};

export const unauthorizedResponse: Response = {
  name: "Unauthorized",
  schema: {
    description: "Missing or invalid access token.",
    content: {
      "application/json": {
        schema: schemaRef(errorResponseSchema),
      },
    },
  },
};

export const badRequestResponse: Response = {
  name: "BadRequest",
  schema: {
    description: "Bad request.",
    content: {
      "application/json": {
        schema: schemaRef(errorResponseSchema),
      },
    },
  },
};

export const forbiddenResponse: Response = {
  name: "Forbidden",
  schema: {
    description: "Forbidden.",
    content: {
      "application/json": {
        schema: schemaRef(errorResponseSchema),
      },
    },
  },
};

export const notFoundResponse: Response = {
  name: "NotFound",
  schema: {
    description: "Not found.",
    content: {
      "application/json": {
        schema: schemaRef(errorResponseSchema),
      },
    },
  },
};

export const conflictResponse: Response = {
  name: "Conflict",
  schema: {
    description: "Conflict.",
    content: {
      "application/json": {
        schema: schemaRef(errorResponseSchema),
      },
    },
  },
};
