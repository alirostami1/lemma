import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const trimmedUrlSchema = z.url().transform((url) => url.replace(/\/$/, ""));

export const env = createEnv({
  client: {
    LEMMA_WEB_API_URL: trimmedUrlSchema,
    LEMMA_WEB_APP_TITLE: z.string().min(1).default("Lemma"),
    LEMMA_WEB_APP_URL: trimmedUrlSchema,
    LEMMA_WEB_OIDC_CLIENT_ID: z.string().min(1),
    LEMMA_WEB_OIDC_ISSUER_URI: trimmedUrlSchema,
    LEMMA_WEB_REALTIME_URL: trimmedUrlSchema,
  },
  clientPrefix: "LEMMA_WEB_",
  emptyStringAsUndefined: true,
  runtimeEnv: import.meta.env,
});
