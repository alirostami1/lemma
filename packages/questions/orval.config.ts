import { execFile } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  prepareOpenApiDocumentForCodegen,
  writeHonoRoutesSource,
} from "@lemma/openapi-hono-generator";
import { defineConfig } from "orval";
import { openapi } from "./openapi/openapi.js";

const execFileAsync = promisify(execFile);
const generatorOpenapi = prepareOpenApiDocumentForCodegen(openapi);

async function addNodeNextImportExtensions(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await addNodeNextImportExtensions(path);
      continue;
    }
    if (!entry.name.endsWith(".ts")) {
      continue;
    }

    const source = await readFile(path, "utf8");
    const updated = source.replace(
      /(from\s+['"]\.\/[^'".]+)(['"])/g,
      "$1.js$2",
    );
    if (updated !== source) {
      await writeFile(path, updated);
    }
  }
}

async function formatGeneratedFiles(directory: string) {
  await execFileAsync("pnpm", [
    "exec",
    "biome",
    "check",
    "--write",
    "--linter-enabled=false",
    directory,
  ]);
}

export default defineConfig({
  questions: {
    hooks: {
      afterAllFilesWrite: async () => {
        await addNodeNextImportExtensions("./src/generated/types");
        await writeHonoRoutesSource({
          envType: "QuestionsAppEnv",
          envTypeImport: "@lemma/questions/http",
          input: generatorOpenapi,
          output: "./src/generated/hono/index.ts",
          requireIdentityType: "RequireIdentity",
          requireIdentityTypeImport: "@lemma/questions/http",
          routeName: "Questions",
          validationHook: "validationHook",
          validationHookImport: "@lemma/http",
          zValidatorImport: "@lemma/http",
        });
        await formatGeneratedFiles("./src/generated");
      },
    },
    input: {
      target: generatorOpenapi,
    },
    output: {
      clean: true,
      client: "zod",
      formatter: "biome",
      override: {
        zod: {
          coerce: {
            query: ["number"],
          },
          dateTimeOptions: {
            offset: true,
          },
          generateEachHttpStatus: true,
          strict: {
            body: true,
            param: true,
            response: true,
          },
        },
      },
      schemas: "./src/generated/types",
      target: "./src/generated/zod/index.ts",
    },
  },
});
