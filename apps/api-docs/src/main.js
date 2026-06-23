import { createApiReference } from "@scalar/api-reference";
import "@scalar/api-reference/style.css";
import { openapi } from "virtual:lemma-openapi";

createApiReference("#app", {
  content: openapi,

  // Optional:
  // theme: 'purple',
  // layout: 'modern',

  // Useful if "Try it" requests hit CORS issues:
  proxyUrl: "https://proxy.scalar.com",
});
