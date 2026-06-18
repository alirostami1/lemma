import { presentDate } from "@lemma/http";
import type { RealtimeTokenResult } from "../application/index.js";

export type RealtimeTokenResponseDto = {
  token: string;
  expiresAt: string;
};

export function presentRealtimeToken(
  result: RealtimeTokenResult,
): RealtimeTokenResponseDto {
  return toRealtimeTokenDto(result);
}

function toRealtimeTokenDto(
  result: RealtimeTokenResult,
): RealtimeTokenResponseDto {
  return {
    token: result.token,
    expiresAt: presentDate(result.expiresAt),
  };
}
