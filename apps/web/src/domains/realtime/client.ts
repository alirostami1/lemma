import {
  Centrifuge,
  type PublicationContext,
  type Subscription,
} from "centrifuge";
import { env } from "#/env";
import {
  createRealtimeConnectionToken,
  createRealtimeSubscriptionToken,
} from "./api";
import type { RealtimeNotificationMessage } from "./model";

export type RealtimeNotificationHandler = (
  message: RealtimeNotificationMessage,
) => void;

export class RealtimeNotificationClient {
  private readonly centrifuge: Centrifuge;
  private readonly subscriptions = new Map<
    string,
    {
      count: number;
      handlers: Set<RealtimeNotificationHandler>;
      subscription: Subscription;
    }
  >();

  constructor(input: {
    token: string;
    onMessage: RealtimeNotificationHandler;
  }) {
    this.centrifuge = new Centrifuge(env.LEMMA_WEB_REALTIME_URL, {
      token: input.token,
      getToken: () =>
        createRealtimeConnectionToken().then((result) => result.token),
    });
    this.onMessage = input.onMessage;
  }

  private readonly onMessage: RealtimeNotificationHandler;

  connect(): void {
    this.centrifuge.connect();
  }

  disconnect(): void {
    this.centrifuge.disconnect();
    this.subscriptions.clear();
  }

  subscribe(
    channel: string,
    handler?: RealtimeNotificationHandler,
  ): () => void {
    const existing = this.subscriptions.get(channel);
    if (existing) {
      existing.count += 1;
      if (handler) {
        existing.handlers.add(handler);
      }
      return () => this.unsubscribeHandler(channel, handler);
    }

    const handlers = new Set<RealtimeNotificationHandler>();
    if (handler) {
      handlers.add(handler);
    }
    const subscription = this.centrifuge.newSubscription(channel, {
      getToken: () =>
        createRealtimeSubscriptionToken({ channel }).then(
          (result) => result.token,
        ),
    });
    subscription.on("publication", (context) => {
      const message = parseRealtimeMessage(context);
      if (!message) {
        return;
      }
      this.onMessage(message);
      for (const nextHandler of handlers) {
        nextHandler(message);
      }
    });
    subscription.subscribe();
    this.subscriptions.set(channel, { count: 1, handlers, subscription });

    return () => this.unsubscribeHandler(channel, handler);
  }

  private unsubscribeHandler(
    channel: string,
    handler?: RealtimeNotificationHandler,
  ): void {
    const existing = this.subscriptions.get(channel);
    if (!existing) {
      return;
    }
    if (handler) {
      existing.handlers.delete(handler);
    }
    existing.count -= 1;
    if (existing.count > 0 || existing.handlers.size > 0) {
      return;
    }
    existing.subscription.unsubscribe();
    this.centrifuge.removeSubscription(existing.subscription);
    this.subscriptions.delete(channel);
  }
}

export async function createRealtimeNotificationClient(input: {
  onMessage: RealtimeNotificationHandler;
}): Promise<{ client: RealtimeNotificationClient; userId: string }> {
  const tokenResult = await createRealtimeConnectionToken();
  const userId = decodeJwtSubject(tokenResult.token);
  const client = new RealtimeNotificationClient({
    token: tokenResult.token,
    onMessage: input.onMessage,
  });
  return { client, userId };
}

function parseRealtimeMessage(
  context: PublicationContext,
): RealtimeNotificationMessage | null {
  if (!isRealtimeNotificationMessage(context.data)) {
    return null;
  }
  return context.data;
}

function isRealtimeNotificationMessage(
  input: unknown,
): input is RealtimeNotificationMessage {
  return (
    typeof input === "object" &&
    input !== null &&
    "schemaVersion" in input &&
    input.schemaVersion === 1 &&
    "eventId" in input &&
    typeof input.eventId === "string" &&
    "eventType" in input &&
    typeof input.eventType === "string" &&
    "lineage" in input &&
    isRealtimeLineage(input.lineage) &&
    "aggregate" in input &&
    typeof input.aggregate === "object" &&
    input.aggregate !== null &&
    "payload" in input &&
    typeof input.payload === "object" &&
    input.payload !== null
  );
}

function isRealtimeLineage(
  input: unknown,
): input is RealtimeNotificationMessage["lineage"] {
  return (
    typeof input === "object" &&
    input !== null &&
    "requestId" in input &&
    typeof input.requestId === "string" &&
    "correlationId" in input &&
    typeof input.correlationId === "string" &&
    "causationId" in input &&
    (typeof input.causationId === "string" || input.causationId === null)
  );
}

function decodeJwtSubject(token: string): string {
  const [, encodedPayload] = token.split(".");
  if (!encodedPayload) {
    throw new Error("Realtime connection token is malformed.");
  }
  const payload = JSON.parse(atob(toBase64(encodedPayload))) as {
    sub?: unknown;
  };
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("Realtime connection token is missing subject.");
  }
  return payload.sub;
}

function toBase64(input: string): string {
  const base64 = input.replaceAll("-", "+").replaceAll("_", "/");
  const paddingLength = (4 - (base64.length % 4)) % 4;
  return `${base64}${"=".repeat(paddingLength)}`;
}
