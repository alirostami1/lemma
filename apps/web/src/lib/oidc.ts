import { oidcSpa } from "oidc-spa/react-spa";
import { z } from "zod";
import { env } from "#/env";

export const {
  bootstrapOidc,
  useOidc,
  getOidc,
  enforceLogin,
  OidcInitializationGate,
} = oidcSpa
  .withExpectedDecodedIdTokenShape({
    decodedIdTokenSchema: z.object({
      sub: z.string(),
      name: z.string(),
      picture: z.string().optional(),
      email: z.email().optional(),
      preferred_username: z.string().optional(),
      realm_access: z.object({ roles: z.array(z.string()) }).optional(),
    }),
  })
  .createUtils();

bootstrapOidc({
  implementation: "real",
  issuerUri: env.LEMMA_WEB_OIDC_ISSUER_URI,
  clientId: env.LEMMA_WEB_OIDC_CLIENT_ID,
  debugLogs: false,
});
