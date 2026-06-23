import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    conditions: ["source"],
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
