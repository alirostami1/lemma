import { openapi as filesOpenAPI } from "@lemma/files/openapi";
import {
  errorResponseSchema,
  keycloakSecurityScheme,
  type OpenAPI,
  type Schema,
  schemaRef,
} from "@lemma/http/openapi";
import { openapi as identityOpenAPI } from "@lemma/identity/openapi";
import { openapi as opsOpenAPI } from "@lemma/ops/openapi";
import { openapi as questionsOpenAPI } from "@lemma/questions/openapi";
import { openapi as workbookOpenAPI } from "@lemma/workbook/openapi";
import { composeOpenAPI } from "./compose.js";
import { pickOpenAPIPaths } from "./filter.js";

const healthResponseSchema: Schema = {
  name: "HealthResponse",
  schema: {
    type: "object",
    required: ["status", "checks"],
    properties: {
      status: {
        type: "string",
        enum: ["ok"],
        example: "ok",
      },
      checks: {
        type: "object",
        required: ["database"],
        properties: {
          database: {
            type: "string",
            enum: ["ok"],
            example: "ok",
          },
        },
      },
    },
  },
};

const baseOpenAPI: OpenAPI = {
  openapi: "3.1.0",
  info: {
    title: "Lemma API",
    version: "0.1.0",
    license: { name: "UNLICENSED", identifier: "UNLICENSED" },
  },
  servers: [
    {
      url: "https://dev.lemma.fr",
      description: "upstream dev server",
    },
    {
      url: "https://lemma.fr",
      description: "production server",
    },
  ],
  tags: [
    {
      name: "Health",
      description: "Service and database health check.",
    },
  ],
  components: {
    securitySchemes: {
      [keycloakSecurityScheme.name]: keycloakSecurityScheme.securitySchema,
    },
    schemas: {
      [errorResponseSchema.name]: errorResponseSchema.schema,
      [healthResponseSchema.name]: healthResponseSchema.schema,
    },
  },
  paths: {
    "/api/health": {
      get: {
        operationId: "getHealth",
        summary: "Health check",
        tags: ["Health"],
        security: [],
        responses: {
          "200": {
            description: "The service and database are healthy.",
            content: {
              "application/json": {
                schema: schemaRef(healthResponseSchema),
              },
            },
          },
          "404": {
            description: "Health endpoint not found.",
            content: {
              "application/json": {
                schema: schemaRef(errorResponseSchema),
              },
            },
          },
          "500": {
            description: "The service is unhealthy.",
            content: {
              "application/json": {
                schema: schemaRef(errorResponseSchema),
              },
            },
          },
        },
      },
    },
  },
};

const fullFragments = [
  filesOpenAPI,
  identityOpenAPI,
  opsOpenAPI,
  questionsOpenAPI,
  workbookOpenAPI,
] as const;

const webIdentityOpenAPI = pickOpenAPIPaths({
  document: identityOpenAPI,
  paths: ["/identity/me", "/identity/me/roles"],
});

const webFragments = [
  filesOpenAPI,
  webIdentityOpenAPI,
  questionsOpenAPI,
  workbookOpenAPI,
] as const;

const adminFragments = [identityOpenAPI, opsOpenAPI] as const;

export const openapi: OpenAPI = composeLemmaOpenAPI(fullFragments);
export const webOpenapi: OpenAPI = composeLemmaOpenAPI(webFragments);
export const adminOpenapi: OpenAPI = composeLemmaOpenAPI(adminFragments);

function composeLemmaOpenAPI(fragments: readonly OpenAPI[]): OpenAPI {
  return composeOpenAPI({
    base: baseOpenAPI,
    fragments,
    pathPrefix: "/api/v1",
  });
}
