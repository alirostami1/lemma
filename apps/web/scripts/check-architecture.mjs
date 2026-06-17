import { runAppArchitectureCheck } from "../../../scripts/app-architecture-checker.mjs";

runAppArchitectureCheck({
  appRoot: new URL("..", import.meta.url),
  rules: {
    generatedApiImportAllowedFiles: [],
    generatedApiImportRestrictedPrefixes: [
      "components/",
      "features/",
      "routes/",
    ],
    routesMayImportFeaturePublicApisOnly: true,
  },
});
