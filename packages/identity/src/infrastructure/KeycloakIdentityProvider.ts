import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";
import { instrumentExternal } from "@lemma/observability";
import type {
  IdentityProvider,
  VerifiedIdentity,
} from "../application/index.js";
import { identityId } from "../domain/index.js";
import { IdentityProviderVerificationError } from "./errors.js";

export type KeycloakIdentityProviderConfig = {
  issuerUrl: string;
  audience: string;
  jwksUrl: string;
};

const instrumentation = instrumentExternal("identity", "keycloak");

export class KeycloakIdentityProvider implements IdentityProvider {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: KeycloakIdentityProviderConfig) {
    this.jwks = createRemoteJWKSet(new URL(config.jwksUrl));
  }

  async verifyAccessToken(accessToken: string): Promise<VerifiedIdentity> {
    return instrumentation.run(
      "verify_access_token",
      {
        attributes: { "identity.provider": "keycloak" },
      },
      async () => {
        try {
          const { payload } = await jwtVerify(accessToken, this.jwks, {
            issuer: this.config.issuerUrl,
            audience: this.config.audience,
          });

          return verifiedIdentityFromJwtPayload(payload);
        } catch (cause) {
          throw new IdentityProviderVerificationError(
            "access token verification failed",
            {
              cause,
            },
          );
        }
      },
    );
  }
}

function verifiedIdentityFromJwtPayload(payload: JWTPayload): VerifiedIdentity {
  if (!payload.sub) {
    throw new Error("Keycloak access token is missing subject.");
  }

  const preferredUsername = stringClaimOrNull(payload, "preferred_username");
  const email = stringClaimOrNull(payload, "email");
  const displayName = stringClaimOrNull(payload, "name") ?? preferredUsername;

  return {
    identityId: identityId(payload.sub),
    sessionId: stringClaimOrNull(payload, "sid") ?? "",
    email: email ?? `${payload.sub}@identity.local`,
    displayName: displayName ?? payload.sub,
    preferredUsername: preferredUsername ?? payload.sub,
  };
}

function stringClaimOrNull(payload: JWTPayload, claim: string): string | null {
  const value = payload[claim];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return null;
}
