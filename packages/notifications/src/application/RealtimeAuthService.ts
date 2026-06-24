import type { CurrentUser } from "@lemma/identity/application";
import { instrumentService } from "@lemma/observability";
import {
  buildNotificationChannel,
  getNotificationChannelAccessRequirement,
  parseNotificationChannel,
} from "../domain/index.js";
import {
  ForbiddenNotificationChannelError,
  InvalidNotificationChannelError,
} from "./errors.js";
import type {
  Clock,
  NotificationChannelAccessPort,
  RealtimeTokenSignerPort,
} from "./ports.js";

const instrumentation = instrumentService("notifications", "realtime_auth");

export type RealtimeTokenResult = {
  token: string;
  expiresAt: Date;
};

export class RealtimeAuthService {
  constructor(
    private readonly deps: {
      tokenSigner: RealtimeTokenSignerPort;
      channelAccessPort: NotificationChannelAccessPort;
      clock: Clock;
      tokenTtlSeconds: number;
    },
  ) {}

  createConnectionToken(input: {
    currentUser: CurrentUser;
  }): RealtimeTokenResult {
    const issuedAt = this.deps.clock.now();
    const expiresAt = this.expiresAt(issuedAt);
    return {
      expiresAt,
      token: this.deps.tokenSigner.sign({
        claims: {
          exp: unixSeconds(expiresAt),
          iat: unixSeconds(issuedAt),
          sub: input.currentUser.user.id,
        },
      }),
    };
  }

  async createSubscriptionToken(input: {
    currentUser: CurrentUser;
    channel: string;
  }): Promise<RealtimeTokenResult> {
    return instrumentation.run("create_subscription_token", async () => {
      const channel = parseNotificationChannel(input.channel);
      if (!channel) {
        throw new InvalidNotificationChannelError();
      }
      const accessRequirement =
        getNotificationChannelAccessRequirement(channel);
      if (
        !(await this.deps.channelAccessPort.canSubscribe({
          accessRequirement,
          channel,
          currentUser: input.currentUser,
        }))
      ) {
        throw new ForbiddenNotificationChannelError();
      }

      const issuedAt = this.deps.clock.now();
      const expiresAt = this.expiresAt(issuedAt);
      const canonicalChannel = buildNotificationChannel(channel);
      return {
        expiresAt,
        token: this.deps.tokenSigner.sign({
          claims: {
            channel: canonicalChannel,
            exp: unixSeconds(expiresAt),
            iat: unixSeconds(issuedAt),
            sub: input.currentUser.user.id,
          },
        }),
      };
    });
  }

  private expiresAt(issuedAt: Date): Date {
    return new Date(issuedAt.getTime() + this.deps.tokenTtlSeconds * 1000);
  }
}

function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}
