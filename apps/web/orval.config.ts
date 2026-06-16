import { webOpenapi } from "@lemma/api-contract";
import { defineConfig } from "orval";

export default defineConfig({
  api: {
    output: {
      mode: "tags-split",
      target: "src/api/generated/api.ts",
      schemas: "src/api/generated/model",
      client: "react-query",
      mock: false,
      clean: true,
      formatter: "biome",
      override: {
        mutator: {
          path: "./src/lib/custom-fetch.ts",
          name: "authedFetch",
        },
        fetch: {
          includeHttpResponseReturnType: false,
        },
        query: {
          useInvalidate: true,
          useGetQueryData: true,
        },
      },
    },
    input: {
      target: webOpenapi,
    },
  },
});
