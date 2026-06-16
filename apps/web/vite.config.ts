import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { oidcSpa } from "oidc-spa/vite-plugin";
import { defineConfig } from "vite";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  envPrefix: "LEMMA_WEB",
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    oidcSpa({}),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});

export default config;
