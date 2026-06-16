import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildHonoRoutesSource,
  collectOperations,
  loadOpenApiDocument,
  toHonoRoutePath,
} from "./generator.js";

describe("toHonoRoutePath", () => {
  it("converts OpenAPI path params to Hono params", () => {
    expect(toHonoRoutePath("/files/{fileId}/download-url")).toBe(
      "/files/:fileId/download-url",
    );
  });
});

describe("buildHonoRoutesSource", () => {
  it("generates a registrar from an OpenAPI fixture", async () => {
    const fixturePath = join(import.meta.dirname, "fixtures/openapi.json");
    const document = await loadOpenApiDocument(fixturePath);
    const source = buildHonoRoutesSource({
      routeName: "Fixture",
      envType: "AuthenticatedAppEnv",
      validationHook: "validationHook",
      operations: collectOperations(document, {
        authSecurityScheme: "keycloakAccessToken",
      }),
    });

    expect(source).toContain("app.get(");
    expect(source).toContain("\"/files/:fileId\"");
    expect(source).toContain("deps.requireIdentity");
    expect(source).toContain(
      "zValidator(\"json\", CreateFileBody, validationHook)",
    );
    expect(source).toContain(
      "zValidator(\"query\", GetFileQueryParams, validationHook)",
    );
    expect(source).not.toContain("basePath");
    expect(source).toMatchSnapshot();
  });
});
