import {
  type Clock,
  type NotificationChannelAccessPort,
  RealtimeAuthService,
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
    channelAccessPort: deps.channelAccessPort,
    clock: deps.clock,
    tokenSigner: new HmacJwtTokenSigner(deps.tokenSecret),
    tokenTtlSeconds: deps.tokenTtlSeconds,
  });

  const routes = notificationsRoutes({
    realtimeAuthService,
    requireIdentity: deps.requireIdentity,
  });

  return { realtimeAuthService, routes };
}
