import type { OpenAPIV3_1 } from "openapi-types";

export type OpenApiDocument = OpenAPIV3_1.Document;

export type HonoRouteOperation = {
  operationId: string;
  method: string;
  path: string;
  honoPath: string;
  pathParams: string[];
  queryParams: string[];
  hasJsonBody: boolean;
  secured: boolean;
  responses: Record<string, string>;
};

export type ImportSource = {
  name: string;
  from: string;
};

export type GenerateHonoRoutesOptions = {
  input: string | OpenApiDocument;
  output: string;
  routeName: string;

  /**
   * Hono Env type used by generated handlers and app.
   */
  envType?: string;

  /**
   * Where envType should be imported from.
   *
   * Default: @lemma/http
   */
  envTypeImport?: string;

  /**
   * Auth middleware type name.
   *
   * Default: RequireIdentity
   */
  requireIdentityType?: string;

  /**
   * Where requireIdentityType should be imported from.
   *
   * Default: @lemma/http
   */
  requireIdentityTypeImport?: string;

  /**
   * OpenAPI security scheme name.
   *
   * Default: keycloakAccessToken
   */
  authSecurityScheme?: string;

  /**
   * Optional validation hook function name.
   */
  validationHook?: string;

  /**
   * Where validationHook should be imported from.
   *
   * Default: @lemma/http
   */
  validationHookImport?: string;

  /**
   * Where zValidator should be imported from.
   *
   * Default: @lemma/http
   */
  zValidatorImport?: string;
};
