const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const {
  checkInlineBlueprintSourceText,
  checkInputPrimitiveSourceText,
  checkWebSourceText,
  inputPrimitiveImportViolation,
  inlineBlueprintImportViolation,
  webImportViolation,
} = require("./check-web-import-boundaries.cjs");

const webFile = path.join(process.cwd(), "apps/web/src/example.ts");
const inlineBlueprintFile = path.join(
  process.cwd(),
  "packages/questions/src/domain/blueprint-document/inline-blueprint.ts",
);
const inputPrimitiveFile = path.join(
  process.cwd(),
  "packages/questions/src/domain/input-primitive/index.ts",
);

function reasons(violations) {
  return violations.map((violation) => violation.reason).join("\n");
}

test("allows web to import the inline blueprint surface", () => {
  assert.equal(webImportViolation("@lemma/questions/inline-blueprint"), null);
});

test("allows web to import the input primitive surface", () => {
  assert.equal(webImportViolation("@lemma/questions/input-primitive"), null);
});

test("rejects unsafe questions package surfaces from web", () => {
  assert.match(
    webImportViolation("@lemma/questions/domain") ?? "",
    /browser-safe @lemma\/questions leaf exports/u,
  );
  assert.match(
    webImportViolation("@lemma/questions/application") ?? "",
    /browser-safe @lemma\/questions leaf exports/u,
  );
});

test("rejects server package surfaces from web", () => {
  assert.match(
    webImportViolation("@lemma/workbook/application") ?? "",
    /server\/node/u,
  );
});

test("rejects Node builtin imports from web", () => {
  assert.match(webImportViolation("node:fs") ?? "", /Node builtins/u);
  assert.match(webImportViolation("fs") ?? "", /Node builtins/u);
  assert.match(webImportViolation("node:fs/promises") ?? "", /Node builtins/u);
  assert.match(webImportViolation("fs/promises") ?? "", /Node builtins/u);
  assert.match(webImportViolation("node:path") ?? "", /Node builtins/u);
  assert.match(webImportViolation("path") ?? "", /Node builtins/u);
});

test("rejects direct source package imports from web", () => {
  assert.match(
    webImportViolation(
      "../../../../packages/questions/src/domain/blueprint-document/inline-blueprint",
    ) ?? "",
    /src or dist/u,
  );
});

test("rejects string-literal dynamic imports from web", () => {
  assert.match(
    reasons(
      checkWebSourceText(
        webFile,
        'await import("@lemma/workbook/application");',
      ),
    ),
    /server\/node/u,
  );
  assert.match(
    reasons(checkWebSourceText(webFile, 'await import("node:fs");')),
    /Node builtins/u,
  );
  assert.match(
    reasons(checkWebSourceText(webFile, 'await import("fs");')),
    /Node builtins/u,
  );
});

test("rejects non-literal dynamic imports from web", () => {
  assert.match(
    reasons(
      checkWebSourceText(
        webFile,
        'await import("@lemma/" + "workbook/application");',
      ),
    ),
    /non-literal dynamic/u,
  );
});

test("rejects require calls from web", () => {
  assert.match(
    reasons(
      checkWebSourceText(
        webFile,
        'require("@lemma/workbook/application"); require(name);',
      ),
    ),
    /CommonJS require/u,
  );
});

test("rejects createRequire imports from web", () => {
  assert.match(
    reasons(
      checkWebSourceText(
        webFile,
        'import { createRequire } from "node:module";',
      ),
    ),
    /createRequire/u,
  );
  assert.match(
    reasons(
      checkWebSourceText(webFile, 'import * as module from "node:module";'),
    ),
    /Node builtins/u,
  );
});

test("rejects server imports from inline blueprint source", () => {
  assert.match(
    inlineBlueprintImportViolation(inlineBlueprintFile, "@lemma/workbook/domain") ??
      "",
    /browser-safe/u,
  );
  assert.match(
    inlineBlueprintImportViolation(inlineBlueprintFile, "hono") ?? "",
    /browser-safe/u,
  );
  assert.match(
    inlineBlueprintImportViolation(inlineBlueprintFile, "kysely") ?? "",
    /browser-safe/u,
  );
  assert.match(
    inlineBlueprintImportViolation(inlineBlueprintFile, "node:fs") ?? "",
    /Node builtins/u,
  );
  assert.match(
    inlineBlueprintImportViolation(inlineBlueprintFile, "fs") ?? "",
    /Node builtins/u,
  );
  assert.match(
    inlineBlueprintImportViolation(inlineBlueprintFile, "path") ?? "",
    /Node builtins/u,
  );
  assert.match(
    inlineBlueprintImportViolation(inlineBlueprintFile, "module") ?? "",
    /Node builtins/u,
  );
  assert.match(
    inlineBlueprintImportViolation(
      inlineBlueprintFile,
      "../application/QuestionBlueprintDraftService.js",
    ) ?? "",
    /outside/u,
  );
  assert.match(
    inlineBlueprintImportViolation(inlineBlueprintFile, "../http/index.js") ?? "",
    /outside/u,
  );
  assert.match(
    inlineBlueprintImportViolation(
      inlineBlueprintFile,
      "../infrastructure/index.js",
    ) ?? "",
    /outside/u,
  );
  assert.match(
    inlineBlueprintImportViolation(inlineBlueprintFile, "../module.js") ?? "",
    /outside/u,
  );
});

test("rejects server imports from input primitive source", () => {
  assert.match(
    inputPrimitiveImportViolation(inputPrimitiveFile, "@lemma/workbook/domain") ??
      "",
    /browser-safe/u,
  );
  assert.match(
    inputPrimitiveImportViolation(inputPrimitiveFile, "react") ?? "",
    /browser-safe/u,
  );
  assert.match(
    inputPrimitiveImportViolation(inputPrimitiveFile, "node:fs") ?? "",
    /Node builtins/u,
  );
  assert.match(
    inputPrimitiveImportViolation(inputPrimitiveFile, "../blueprint-document/index.js") ??
      "",
    /outside/u,
  );
});

test("rejects bypass imports from inline blueprint source", () => {
  assert.match(
    reasons(
      checkInlineBlueprintSourceText(
        inlineBlueprintFile,
        'await import("@lemma/" + "workbook/domain");',
      ),
    ),
    /non-literal dynamic/u,
  );
  assert.match(
    reasons(checkInlineBlueprintSourceText(inlineBlueprintFile, 'import fs from "fs";')),
    /Node builtins/u,
  );
  assert.match(
    reasons(checkInlineBlueprintSourceText(inlineBlueprintFile, 'import path from "path";')),
    /Node builtins/u,
  );
  assert.match(
    reasons(
      checkInlineBlueprintSourceText(
        inlineBlueprintFile,
        'import { createRequire } from "module";',
      ),
    ),
    /createRequire/u,
  );
  assert.match(
    reasons(checkInlineBlueprintSourceText(inlineBlueprintFile, 'await import("fs/promises");')),
    /Node builtins/u,
  );
});

test("rejects bypass imports from input primitive source", () => {
  assert.match(
    reasons(
      checkInputPrimitiveSourceText(
        inputPrimitiveFile,
        'await import("@lemma/" + "workbook/domain");',
      ),
    ),
    /non-literal dynamic/u,
  );
  assert.match(
    reasons(checkInputPrimitiveSourceText(inputPrimitiveFile, 'import fs from "fs";')),
    /Node builtins/u,
  );
  assert.match(
    reasons(
      checkInputPrimitiveSourceText(
        inputPrimitiveFile,
        'import { createRequire } from "module";',
      ),
    ),
    /createRequire/u,
  );
});
