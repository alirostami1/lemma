import {
  RealtimeAuthService,
  type Clock,
  type NotificationChannelAccessPort,
} from "./application/index.js";
import type { RequireIdentity } from "./http/index.js";
import { notificationsRoutes } from "./http/index.js";
import { HmacJwtTokenSigner } from "./infrastructure/index.js";

export function createNotificationsModule(deps: {
  requireIdentity: RequireIdentity;
  channelAccessPort: NotificationChannelAccessPort;
  tokenSecret: string;
  tokenTtlSeconds: number;
  clock: Clock;
}) {
  const realtimeAuthService = new RealtimeAuthService({
    tokenSigner: new HmacJwtTokenSigner(deps.tokenSecret),
    channelAccessPort: deps.channelAccessPort,
    tokenTtlSeconds: deps.tokenTtlSeconds,
    clock: deps.clock,
  });

  const routes = notificationsRoutes({
    requireIdentity: deps.requireIdentity,
    realtimeAuthService,
  });

  return { routes, realtimeAuthService };
}
