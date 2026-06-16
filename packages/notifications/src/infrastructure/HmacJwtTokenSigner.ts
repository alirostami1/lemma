import { createHmac } from "node:crypto";
import type { JsonObject } from "@lemma/domain";
import type { RealtimeTokenSignerPort } from "../application/index.js";

export class HmacJwtTokenSigner implements RealtimeTokenSignerPort {
  constructor(private readonly secret: string) {}

  sign(input: { claims: JsonObject }): string {
    const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
    const payload = base64UrlJson(input.claims);
    const signature = createHmac("sha256", this.secret)
      .update(`${header}.${payload}`)
      .digest("base64url");
    return `${header}.${payload}.${signature}`;
  }
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
