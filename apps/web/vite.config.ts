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
    conditions: ["source"],
    tsconfigPaths: true,
  },
});

export default config;
