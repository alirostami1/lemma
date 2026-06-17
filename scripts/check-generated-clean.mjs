import { spawnSync } from "node:child_process";

const generatedOutputs = [
  "apps/web/src/api/generated",
  "apps/web/src/routeTree.gen.ts",
  "apps/keycloak-theme/src/kc.gen.tsx",
  "packages/db/src/types.d.ts",
  "packages/files/src/gen",
  "packages/identity/src/gen",
  "packages/ops/src/gen",
  "packages/questions/src/gen",
  "packages/workbook/src/gen",
];

const result = spawnSync(
  "git",
  ["status", "--porcelain", "--", ...generatedOutputs],
  {
    encoding: "utf8",
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const output = result.stdout.trim();
if (output.length > 0) {
  console.error("Generated output is not clean.");
  console.error(
    "Run the owning generator command, then review and commit the diff.",
  );
  console.error("");
  console.error(output);
  process.exit(1);
}

console.log("Generated OpenAPI output is clean.");
