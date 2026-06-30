import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { generate } from "orval";
import { describe, expect, it } from "vitest";
import {
  buildHonoRoutesSource,
  collectOperations,
  loadOpenApiDocument,
  normalizeIntegerSchemasForZod,
  resolveOpenApiDocument,
  toHonoRoutePath,
} from "./generator.js";
import { reusableZodSchemaOptions } from "./orval.js";

const execFileAsync = promisify(execFile);

describe("toHonoRoutePath", () => {
  it("converts OpenAPI path params to Hono params", () => {
    expect(toHonoRoutePath("/files/{fileId}/download-url")).toBe(
      "/files/:fileId/download-url",
    );
  });
});

describe("normalizeIntegerSchemasForZod", () => {
  it("adds integer validation without changing number schemas", () => {
    const input = {
      integer: { minimum: 1, type: "integer" },
      number: { minimum: 1, type: "number" },
    } as const;

    expect(normalizeIntegerSchemasForZod(input)).toEqual({
      integer: { minimum: 1, multipleOf: 1, type: "integer" },
      number: { minimum: 1, type: "number" },
    });
    expect(input.integer).not.toHaveProperty("multipleOf");
  });
});

describe("resolveOpenApiDocument", () => {
  it("normalizes integer schemas for generation entrypoints", async () => {
    const document = await resolveOpenApiDocument({
      openapi: "3.1.0",
      info: { title: "Fixture", version: "1.0.0" },
      paths: {},
      components: {
        schemas: {
          Body: {
            type: "object",
            properties: {
              expectedRevision: { type: "integer", minimum: 1 },
            },
          },
        },
      },
    });

    expect(document.components?.schemas?.Body).toEqual({
      type: "object",
      properties: {
        expectedRevision: { type: "integer", minimum: 1, multipleOf: 1 },
      },
    });
  });
});

describe("recursive Orval Zod configuration", () => {
  it("emits and executes lazy validators for recursive component schemas", async () => {
    const outputDirectory = await mkdtemp(
      join(process.cwd(), ".recursive-zod-"),
    );
    const target = join(outputDirectory, "operations.ts");
    const schemas = join(outputDirectory, "schemas");

    try {
      await generate({
        input: {
          target: join(import.meta.dirname, "fixtures/recursive-openapi.json"),
        },
        output: {
          clean: true,
          client: "zod",
          override: {
            zod: {
              ...reusableZodSchemaOptions(),
              strict: {
                body: true,
                header: true,
                param: true,
                query: true,
                response: true,
              },
            },
          },
          schemas,
          target,
        },
      });

      const nodeSchemaPath = join(schemas, "node.zod.ts");
      const source = await readFile(nodeSchemaPath, "utf8");
      expect(source).toContain("zod.lazy");

      const moduleUrl = pathToFileURL(nodeSchemaPath).href;
      await execFileAsync(process.execPath, [
        "--input-type=module",
        "--eval",
        `const { Node } = await import(${JSON.stringify(moduleUrl)});
const valid = Node.safeParse({ kind: "node", children: [{ kind: "node", children: [] }] });
const invalid = Node.safeParse({ kind: "node", children: [{}] });
if (!valid.success || invalid.success) process.exit(1);`,
      ]);
    } finally {
      await rm(outputDirectory, { force: true, recursive: true });
    }
  });
});

describe("buildHonoRoutesSource", () => {
  it("generates a registrar from an OpenAPI fixture", async () => {
    const fixturePath = join(import.meta.dirname, "fixtures/openapi.json");
    const document = await loadOpenApiDocument(fixturePath);
    const source = buildHonoRoutesSource({
      envType: "AuthenticatedAppEnv",
      operations: collectOperations(document, {
        authSecurityScheme: "keycloakAccessToken",
      }),
      routeName: "Fixture",
      validationHook: "validationHook",
    });

    expect(source).toContain("app.get(");
    expect(source).toContain('"/files/:fileId"');
    expect(source).toContain("deps.requireIdentity");
    expect(source).toContain(
      'zValidator("json", CreateFileBody, validationHook)',
    );
    expect(source).toContain(
      'zValidator("query", GetFileQueryParams, validationHook)',
    );
    expect(source).toContain(
      "type EmptyHandlerInput = Record<PropertyKey, never>;",
    );
    expect(source).toContain(
      'health: Handler<AuthenticatedAppEnv, "/health", EmptyHandlerInput, TypedHandlerResponse<HealthResponses>>;',
    );
    expect(source).not.toContain("Record<keyof any, never>");
    expect(source).not.toContain(", {},");
    expect(source).not.toContain("basePath");
    expect(source).toMatchSnapshot();
  });
});
