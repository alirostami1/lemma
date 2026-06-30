import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { oidcSpa } from "oidc-spa/vite-plugin";
import { defineConfig } from "vite";

const config = defineConfig({
  build: {
    outDir: "dist",
  },
  envPrefix: "LEMMA_WEB",
  plugins: [
    nitro(),
    devtools(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    oidcSpa({}),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  resolve: {
    // Intentional #129 experiment: web resolves workspace package source exports
    // through the "source" condition. Architecture checks restrict web's
    // @lemma/questions imports to @lemma/questions/inline-blueprint and forbid
    // server/node package surfaces.
    conditions: ["source"],
    tsconfigPaths: true,
  },
  ssr: {
    resolve: {
      conditions: ["source"],
    },
  },
});

export default config;
