import { authedFetch } from "#/lib/custom-fetch";
import type { RealtimeTokenResult } from "./model";

export function createRealtimeConnectionToken(): Promise<RealtimeTokenResult> {
  return authedFetch<RealtimeTokenResult>(
    "/api/v1/notifications/connection-token",
    { method: "POST" },
  );
}

export function createRealtimeSubscriptionToken(input: {
  channel: string;
}): Promise<RealtimeTokenResult> {
  return authedFetch<RealtimeTokenResult>(
    "/api/v1/notifications/subscription-token",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}
