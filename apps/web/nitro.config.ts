import { defineConfig } from "nitro";

export default defineConfig({
  preset: "node-server",
  compatibilityDate: "2026-06-19",
  serverEntry: "./dist/server/server.js",
  publicAssets: [
    {
      baseURL: "/",
      dir: "dist/client",
      fallthrough: true,
      maxAge: 31536000,
    },
  ],
  serveStatic: "node",
});
