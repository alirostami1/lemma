import type { JsonObject } from "@lemma/domain";
import { instrumentExternal } from "@lemma/observability";
import type { RealtimePublisherPort } from "../application/index.js";

const instrumentation = instrumentExternal("notifications", "centrifugo");

export class CentrifugoRealtimePublisher implements RealtimePublisherPort {
  constructor(
    private readonly config: {
      apiUrl: string;
      apiKey: string;
    },
  ) {}

  async publish(input: {
    channel: string;
    data: JsonObject;
    idempotencyKey?: string;
  }): Promise<void> {
    return instrumentation.run(
      "publish",
      {
        attributes: { "messaging.system": "centrifugo" },
      },
      async () => {
        const response = await fetch(`${this.config.apiUrl}/publish`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": this.config.apiKey,
          },
          body: JSON.stringify({
            channel: input.channel,
            data: input.data,
            idempotency_key: input.idempotencyKey,
          }),
        });
        if (!response.ok) {
          throw new Error(
            `Centrifugo publish failed with HTTP ${response.status}.`,
          );
        }

        const body = (await response.json()) as {
          error?: { code?: number; message?: string };
        };
        if (body.error) {
          throw new Error(
            `Centrifugo publish failed: ${body.error.message ?? body.error.code ?? "unknown error"}.`,
          );
        }
      },
    );
  }
}
