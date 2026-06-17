import type { HttpErrorResponse } from "@lemma/error";
import type { RequireIdentity as FilesRequireIdentity } from "@lemma/files/http";
import type { CurrentUser } from "@lemma/identity/application";
import type { RequireIdentity as IdentityRequireIdentity } from "@lemma/identity/http";
import type { RequireIdentity as NotificationsRequireIdentity } from "@lemma/notifications/http";
import type { RequireIdentity as OpsRequireIdentity } from "@lemma/ops/http";
import type { RequireIdentity as QuestionsRequireIdentity } from "@lemma/questions/http";
import type { RequireIdentity as WorkbookRequireIdentity } from "@lemma/workbook/http";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { logApiWarn } from "./logging.js";

type ApiAuthEnv = {
  Variables: {
    identity: CurrentUser;
    requestId: string;
  };
};

export type ApiRequireIdentity = IdentityRequireIdentity &
  FilesRequireIdentity &
  NotificationsRequireIdentity &
  OpsRequireIdentity &
  QuestionsRequireIdentity &
  WorkbookRequireIdentity;

type CurrentUserResolver = {
  fromAccessToken(accessToken: string): Promise<CurrentUser>;
};

function unauthenticated(c: Context<ApiAuthEnv>, message: string) {
  return {
    error: {
      code: "UNAUTHENTICATED",
      message,
      requestId: c.get("requestId"),
    },
  } satisfies HttpErrorResponse;
}

export function createRequireIdentity(
  currentUserResolver: CurrentUserResolver,
): ApiRequireIdentity {
  const middleware = createMiddleware<ApiAuthEnv>(async (c, next) => {
    const authorization = c.req.header("authorization");
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!accessToken) {
      return c.json(
        unauthenticated(c, "Authentication credentials are required."),
        401,
      );
    }

    try {
      const currentUser =
        await currentUserResolver.fromAccessToken(accessToken);

      c.set("identity", currentUser);
      return next();
    } catch (error) {
      logApiWarn("authentication failed", {
        "http.path": c.req.path,
        "http.request_id": c.get("requestId"),
        "auth.failure_reason": getAuthErrorSummary(error),
      });

      return c.json(
        unauthenticated(
          c,
          "Authentication credentials are invalid, expired, or not allowed.",
        ),
        401,
      );
    }
  });

  return middleware as ApiRequireIdentity;
}

function getAuthErrorSummary(error: unknown): string {
  const parts: string[] = [];
  let current = error;

  while (current instanceof Error && parts.length < 4) {
    parts.push(`${current.name}: ${current.message}`);
    current = current.cause;
  }

  if (parts.length > 0) {
    return parts.join(" <- ");
  }

  return String(error);
}
