import type { Context } from "hono";
import { Hono } from "hono";
import {
  ForbiddenNotificationChannelError,
  InvalidNotificationChannelError,
  type RealtimeAuthService,
} from "../application/index.js";
import type { NotificationsAppEnv, RequireIdentity } from "./env.js";
import { presentRealtimeToken } from "./presenters.js";

export type NotificationsRoutesDeps = {
  requireIdentity: RequireIdentity;
  realtimeAuthService: RealtimeAuthService;
};

export function notificationsRoutes(deps: NotificationsRoutesDeps) {
  const app = new Hono<NotificationsAppEnv>();

  app.post("/notifications/connection-token", deps.requireIdentity, (c) => {
    const result = deps.realtimeAuthService.createConnectionToken({
      currentUser: c.var.identity,
    });
    return c.json(presentRealtimeToken(result), 200);
  });

  app.post(
    "/notifications/subscription-token",
    deps.requireIdentity,
    async (c) => {
      const body = await readJsonBody(c.req.raw);
      if (!isSubscriptionTokenRequest(body)) {
        return c.json(
          badRequest(c, "BAD_REQUEST", "channel is required."),
          400,
        );
      }

      try {
        const result = await deps.realtimeAuthService.createSubscriptionToken({
          channel: body.channel,
          currentUser: c.var.identity,
        });
        return c.json(presentRealtimeToken(result), 200);
      } catch (error) {
        return handleNotificationsError(c, error);
      }
    },
  );

  return app;
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isSubscriptionTokenRequest(
  input: unknown,
): input is { channel: string } {
  return (
    typeof input === "object" &&
    input !== null &&
    "channel" in input &&
    typeof input.channel === "string"
  );
}

function handleNotificationsError(
  c: Context<NotificationsAppEnv>,
  error: unknown,
) {
  if (error instanceof InvalidNotificationChannelError) {
    return c.json(badRequest(c, "BAD_REQUEST", error.message), 400);
  }
  if (error instanceof ForbiddenNotificationChannelError) {
    return c.json(
      badRequest(c, "FORBIDDEN_NOTIFICATION_CHANNEL", error.message),
      403,
    );
  }
  throw error;
}

function badRequest(
  c: Context<NotificationsAppEnv>,
  code: string,
  message: string,
) {
  return {
    error: {
      code,
      message,
      requestId: c.get("requestId"),
    },
  };
}
