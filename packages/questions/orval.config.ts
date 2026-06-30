import { execFile } from "node:child_process";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import {
  prepareOpenApiDocumentForCodegen,
  reusableZodSchemaOptions,
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
    const matches = Array.from(
      source.matchAll(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g),
    );
    let updated = source;
    for (const match of matches.reverse()) {
      const specifier = match[2];
      const matchIndex = match.index;
      if (!specifier || matchIndex === undefined || specifier.endsWith(".js")) {
        continue;
      }
      const suffix = (await isDirectory(resolve(dirname(path), specifier)))
        ? "/index.js"
        : ".js";
      const specifierIndex = matchIndex + (match[1]?.length ?? 0);
      updated = `${updated.slice(0, specifierIndex)}${specifier}${suffix}${updated.slice(specifierIndex + specifier.length)}`;
    }
    if (updated !== source) {
      await writeFile(path, updated);
    }
  }
}

async function isDirectory(path: string) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
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
        await addNodeNextImportExtensions("./src/generated");
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
          ...reusableZodSchemaOptions(),
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
      tsconfig: {
        compilerOptions: {
          module: "nodenext",
          moduleResolution: "nodenext",
        },
      },
    },
  },
});
