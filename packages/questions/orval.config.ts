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
  questions: {
    hooks: {
      afterAllFilesWrite: async () => {
        await addNodeNextImportExtensions("./src/gen/types");
        await writeHonoRoutesSource({
          input: openapi,
          output: "./src/gen/hono/index.ts",
          routeName: "Questions",
          envType: "QuestionsAppEnv",
          envTypeImport: "@lemma/questions/http",
          requireIdentityType: "RequireIdentity",
          requireIdentityTypeImport: "@lemma/questions/http",
          validationHook: "validationHook",
          validationHookImport: "@lemma/http",
          zValidatorImport: "@lemma/http",
        });
        await formatGeneratedFiles("./src/gen");
      },
    },
    input: {
      target: openapi,
    },
    output: {
      target: "./src/gen/zod/index.ts",
      schemas: "./src/gen/types",
      client: "zod",
      clean: true,
      formatter: "biome",
      override: {
        zod: {
          strict: {
            body: true,
            param: true,
            response: true,
          },
          generateEachHttpStatus: true,
          coerce: {
            query: ["number"],
          },
          dateTimeOptions: {
            offset: true,
          },
        },
      },
    },
  },
});
