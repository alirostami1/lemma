import { withHttpErrorHandler } from "@lemma/http";
import type { OpsService } from "../application/index.js";
import type { OpsHandlerMap } from "../generated/hono/index.js";
import { handleOpsError } from "./errors.js";
import {
  presentOpsFailedQueueJobs,
  presentOpsOutboxEvent,
  presentOpsOutboxEvents,
  presentOpsOverview,
  presentOpsQueueJobs,
} from "./presenters.js";

export type OpsHandlersDeps = {
  opsService: OpsService;
};

function opsHandler<TKey extends keyof OpsHandlerMap>(
  _operation: TKey,
  handler: OpsHandlerMap[TKey],
): OpsHandlerMap[TKey] {
  return withHttpErrorHandler(handler, handleOpsError);
}

export function createOpsHandlers(deps: OpsHandlersDeps): OpsHandlerMap {
  return {
    getOpsOverview: opsHandler("getOpsOverview", async (c) => {
      const overview = await deps.opsService.getOverview({
        currentUser: c.var.identity,
      });
      return c.json(presentOpsOverview(overview), 200);
    }),

    listOpsFailedQueueJobs: opsHandler("listOpsFailedQueueJobs", async (c) => {
      const query = c.req.valid("query");
      const jobs = await deps.opsService.listFailedQueueJobs({
        currentUser: c.var.identity,
        limit: query.limit,
      });
      return c.json(presentOpsFailedQueueJobs(jobs), 200);
    }),

    listOpsOutboxEvents: opsHandler("listOpsOutboxEvents", async (c) => {
      const query = c.req.valid("query");
      const events = await deps.opsService.listOutboxEvents({
        currentUser: c.var.identity,
        limit: query.limit,
        reviewState: query.reviewState,
        status: query.status,
      });
      return c.json(presentOpsOutboxEvents(events), 200);
    }),

    listOpsQueueJobs: opsHandler("listOpsQueueJobs", async (c) => {
      const query = c.req.valid("query");
      const jobs = await deps.opsService.listQueueJobs({
        currentUser: c.var.identity,
        limit: query.limit,
        state: query.state,
      });
      return c.json(presentOpsQueueJobs(jobs), 200);
    }),

    replayOpsOutboxEvent: opsHandler("replayOpsOutboxEvent", async (c) => {
      const { eventId } = c.req.valid("param");
      const body = c.req.valid("json");
      const event = await deps.opsService.replayOutboxEvent({
        currentUser: c.var.identity,
        eventId,
        note: body?.note,
      });
      return c.json(presentOpsOutboxEvent(event), 200);
    }),

    reviewOpsOutboxEvent: opsHandler("reviewOpsOutboxEvent", async (c) => {
      const { eventId } = c.req.valid("param");
      const body = c.req.valid("json");
      const event = await deps.opsService.reviewOutboxEvent({
        action: body.action,
        currentUser: c.var.identity,
        eventId,
        note: body.note,
      });
      return c.json(presentOpsOutboxEvent(event), 200);
    }),
  };
}
