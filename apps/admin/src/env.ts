import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const trimmedUrlSchema = z.url().transform((url) => url.replace(/\/$/, ""));

function envValue(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback;
}

const runtimeEnv = {
  ...import.meta.env,
  LEMMA_ADMIN_APP_TITLE: envValue(
    import.meta.env.LEMMA_ADMIN_APP_TITLE,
    "Lemma Admin",
  ),
  LEMMA_ADMIN_APP_URL: envValue(
    import.meta.env.LEMMA_ADMIN_APP_URL,
    "http://localhost:3003",
  ),
  LEMMA_ADMIN_API_URL: envValue(
    import.meta.env.LEMMA_ADMIN_API_URL,
    "http://localhost:3001",
  ),
  LEMMA_ADMIN_OIDC_ISSUER_URI: envValue(
    import.meta.env.LEMMA_ADMIN_OIDC_ISSUER_URI,
    "http://localhost:8001/realms/lemma",
  ),
  LEMMA_ADMIN_OIDC_CLIENT_ID: envValue(
    import.meta.env.LEMMA_ADMIN_OIDC_CLIENT_ID,
    "lemma-admin",
  ),
};

export const env = createEnv({
  clientPrefix: "LEMMA_ADMIN_",
  client: {
    LEMMA_ADMIN_APP_TITLE: z.string().min(1).default("Lemma Admin"),
    LEMMA_ADMIN_APP_URL: trimmedUrlSchema,
    LEMMA_ADMIN_API_URL: trimmedUrlSchema,
    LEMMA_ADMIN_OIDC_ISSUER_URI: trimmedUrlSchema,
    LEMMA_ADMIN_OIDC_CLIENT_ID: z.string().min(1),
  },
  runtimeEnv,
  emptyStringAsUndefined: true,
});
