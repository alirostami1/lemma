import { createConfig, lintFromString } from "@redocly/openapi-core";
import { openapi } from "./openapi.js";

const config = await createConfig({
  extends: ["recommended"],
  rules: {
    "no-unused-components": "off",
  },
});

const problems = await lintFromString({
  source: JSON.stringify(openapi, null, 2),
  absoluteRef: "/virtual/openapi.json",
  config,
});

for (const problem of problems) {
  const location = problem.location?.[0];
  const pointer = location?.pointer ? ` ${location.pointer}` : "";
  const ruleId = problem.ruleId ? ` [${problem.ruleId}]` : "";

  console.error(
    `${problem.severity.toUpperCase()}${ruleId}${pointer}: ${problem.message}`,
  );
}

const errorCount = problems.filter(
  (problem) => problem.severity === "error",
).length;

if (errorCount > 0) {
  process.exitCode = 1;
}
