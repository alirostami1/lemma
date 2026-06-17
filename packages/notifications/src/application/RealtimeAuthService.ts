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
      token: this.deps.tokenSigner.sign({
        claims: {
          sub: input.currentUser.user.id,
          iat: unixSeconds(issuedAt),
          exp: unixSeconds(expiresAt),
        },
      }),
      expiresAt,
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
          currentUser: input.currentUser,
          channel,
          accessRequirement,
        }))
      ) {
        throw new ForbiddenNotificationChannelError();
      }

      const issuedAt = this.deps.clock.now();
      const expiresAt = this.expiresAt(issuedAt);
      const canonicalChannel = buildNotificationChannel(channel);
      return {
        token: this.deps.tokenSigner.sign({
          claims: {
            sub: input.currentUser.user.id,
            channel: canonicalChannel,
            iat: unixSeconds(issuedAt),
            exp: unixSeconds(expiresAt),
          },
        }),
        expiresAt,
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
