import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { keycloakify } from "keycloakify/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    react(),
    keycloakify({
      accountThemeImplementation: "none",
      themeName: "lemma",
      keycloakifyBuildDirPath: "dist_keycloak",
      keycloakVersionTargets: {
        "22-to-25": false,
        "all-other-versions": "lemma-keycloak-theme.jar",
      },
    }),
  ],
});
