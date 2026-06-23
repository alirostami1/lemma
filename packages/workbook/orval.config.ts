import { execFile } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { writeHonoRoutesSource } from "@lemma/openapi-hono-generator";
import { defineConfig } from "orval";
import { openapi } from "./openapi/openapi.js";

const execFileAsync = promisify(execFile);

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
  workbook: {
    hooks: {
      afterAllFilesWrite: async () => {
        await addNodeNextImportExtensions("./src/generated/types");
        await writeHonoRoutesSource({
          envType: "WorkbookAppEnv",
          envTypeImport: "@lemma/workbook/http",
          input: openapi,
          output: "./src/generated/hono/index.ts",
          requireIdentityType: "RequireIdentity",
          requireIdentityTypeImport: "@lemma/workbook/http",
          routeName: "Workbook",
          validationHook: "validationHook",
          validationHookImport: "@lemma/http",
          zValidatorImport: "@lemma/http",
        });
        await formatGeneratedFiles("./src/generated");
      },
    },
    input: {
      target: openapi,
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
