import { webOpenapi } from "@lemma/api-contract";
import { defineConfig } from "orval";

export default defineConfig({
  api: {
    input: {
      target: webOpenapi,
    },
    output: {
      clean: true,
      client: "react-query",
      formatter: "biome",
      mock: false,
      mode: "tags-split",
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          name: "authedFetch",
          path: "./src/lib/custom-fetch.ts",
        },
        query: {
          useGetQueryData: true,
          useInvalidate: true,
        },
      },
      schemas: "src/api/generated/model",
      target: "src/api/generated/api.ts",
    },
  },
});
