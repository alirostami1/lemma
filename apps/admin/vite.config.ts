import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { oidcSpa } from "oidc-spa/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  envPrefix: "LEMMA_ADMIN",
  plugins: [tailwindcss(), react(), oidcSpa({})],
});
