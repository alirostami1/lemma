import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const trimmedUrlSchema = z.url().transform((url) => url.replace(/\/$/, ""));

function displayEnvValue(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback;
}

function endpointEnvValue(
  value: string | undefined,
  localFallback: string,
): string | undefined {
  if (value && value.trim().length > 0) {
    return value;
  }

  return import.meta.env.PROD ? value : localFallback;
}

const runtimeEnv = {
  ...import.meta.env,
  LEMMA_WEB_APP_TITLE: displayEnvValue(
    import.meta.env.LEMMA_WEB_APP_TITLE,
    "Lemma",
  ),
  LEMMA_WEB_APP_URL: endpointEnvValue(
    import.meta.env.LEMMA_WEB_APP_URL,
    "http://localhost:3000",
  ),
  LEMMA_WEB_API_URL: endpointEnvValue(
    import.meta.env.LEMMA_WEB_API_URL,
    "http://localhost:3000",
  ),
  LEMMA_WEB_REALTIME_URL: endpointEnvValue(
    import.meta.env.LEMMA_WEB_REALTIME_URL,
    "ws://localhost:3000/connection/websocket",
  ),
  LEMMA_WEB_OIDC_ISSUER_URI: endpointEnvValue(
    import.meta.env.LEMMA_WEB_OIDC_ISSUER_URI,
    "http://localhost:3001",
  ),
  LEMMA_WEB_OIDC_CLIENT_ID: endpointEnvValue(
    import.meta.env.LEMMA_WEB_OIDC_CLIENT_ID,
    "lemma-web",
  ),
};

export const env = createEnv({
  clientPrefix: "LEMMA_WEB_",
  client: {
    LEMMA_WEB_APP_TITLE: z.string().min(1).default("Lemma"),
    LEMMA_WEB_APP_URL: trimmedUrlSchema,
    LEMMA_WEB_API_URL: trimmedUrlSchema,
    LEMMA_WEB_REALTIME_URL: trimmedUrlSchema,
    LEMMA_WEB_OIDC_ISSUER_URI: trimmedUrlSchema,
    LEMMA_WEB_OIDC_CLIENT_ID: z.string().min(1),
  },
  runtimeEnv,
  emptyStringAsUndefined: true,
});
