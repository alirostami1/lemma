import { openapi } from "@lemma/api-contract/source";
import { defineConfig } from "vite";

const virtualOpenapiModuleId = "virtual:lemma-openapi";
const resolvedVirtualOpenapiModuleId = `\0${virtualOpenapiModuleId}`;

const lemmaOpenapiPlugin = () => ({
  name: "lemma-openapi",
  resolveId(id) {
    if (id === virtualOpenapiModuleId) {
      return resolvedVirtualOpenapiModuleId;
    }
    return null;
  },
  load(id) {
    if (id === resolvedVirtualOpenapiModuleId) {
      return `export const openapi = ${JSON.stringify(openapi)};`;
    }
    return null;
  },
});

export default defineConfig({
  plugins: [lemmaOpenapiPlugin()],
  resolve: {
    tsconfigPaths: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
