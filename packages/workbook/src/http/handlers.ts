import { rootOperationLineage } from "@lemma/domain";
import { withHttpErrorHandler } from "@lemma/http";
import type {
  WorkbookCalculationService,
  WorkbookService,
} from "../application/index.js";
import type { WorkbookHandlerMap } from "../gen/hono/index.js";
import { handleWorkbookError } from "./errors.js";
import {
  presentWorkbook,
  presentWorkbookCalculation,
  presentWorkbookCalculations,
  presentWorkbookEngineHealth,
  presentWorkbookSnapshot,
  presentWorkbookSnapshots,
  presentWorkbookSnapshotValue,
  presentWorkbooks,
} from "./presenters.js";

export type WorkbookHandlersDeps = {
  workbookService: WorkbookService;
  workbookCalculationService: WorkbookCalculationService;
};

function workbookHandler<TKey extends keyof WorkbookHandlerMap>(
  _operation: TKey,
  handler: WorkbookHandlerMap[TKey],
): WorkbookHandlerMap[TKey] {
  return withHttpErrorHandler(handler, handleWorkbookError);
}

export function createWorkbookHandlers(
  deps: WorkbookHandlersDeps,
): WorkbookHandlerMap {
  return {
    listWorkbooks: workbookHandler("listWorkbooks", async (c) => {
      const query = c.req.valid("query");
      return c.json(
        presentWorkbooks(
          await deps.workbookService.listWorkbooks({
            currentUser: c.var.identity,
            ...query,
          }),
        ),
        200,
      );
    }),
    createWorkbook: workbookHandler("createWorkbook", async (c) => {
      const body = c.req.valid("json");
      return c.json(
        presentWorkbook(
          await deps.workbookService.createWorkbook({
            currentUser: c.var.identity,
            lineage: rootOperationLineage(c.var.requestId),
            ...body,
          }),
        ),
        201,
      );
    }),
    getWorkbook: workbookHandler("getWorkbook", async (c) => {
      const { workbookId } = c.req.valid("param");
      return c.json(
        presentWorkbook(
          await deps.workbookService.getWorkbook({
            currentUser: c.var.identity,
            workbookId,
          }),
        ),
        200,
      );
    }),
    updateWorkbook: workbookHandler("updateWorkbook", async (c) => {
      const { workbookId } = c.req.valid("param");
      const body = c.req.valid("json");
      return c.json(
        presentWorkbook(
          await deps.workbookService.updateWorkbook({
            currentUser: c.var.identity,
            workbookId,
            patch: body,
          }),
        ),
        200,
      );
    }),
    deleteWorkbook: workbookHandler("deleteWorkbook", async (c) => {
      const { workbookId } = c.req.valid("param");
      await deps.workbookService.deleteWorkbook({
        currentUser: c.var.identity,
        workbookId,
      });
      return c.body(null, 204);
    }),
    validateWorkbook: workbookHandler("validateWorkbook", async (c) => {
      const { workbookId } = c.req.valid("param");
      return c.json(
        presentWorkbook(
          await deps.workbookService.validateWorkbook({
            currentUser: c.var.identity,
            workbookId,
            lineage: rootOperationLineage(c.var.requestId),
          }),
        ),
        200,
      );
    }),
    listWorkbookCalculations: workbookHandler(
      "listWorkbookCalculations",
      async (c) => {
        const { workbookId } = c.req.valid("param");
        const query = c.req.valid("query");
        return c.json(
          presentWorkbookCalculations(
            await deps.workbookCalculationService.listWorkbookCalculations({
              currentUser: c.var.identity,
              workbookId,
              ...query,
            }),
          ),
          200,
        );
      },
    ),
    createWorkbookCalculation: workbookHandler(
      "createWorkbookCalculation",
      async (c) => {
        const { workbookId } = c.req.valid("param");
        const body = c.req.valid("json");
        return c.json(
          presentWorkbookCalculation(
            await deps.workbookCalculationService.requestWorkbookCalculation({
              currentUser: c.var.identity,
              workbookId,
              lineage: rootOperationLineage(c.var.requestId),
              ...body,
            }),
          ),
          201,
        );
      },
    ),
    getWorkbookCalculation: workbookHandler(
      "getWorkbookCalculation",
      async (c) => {
        const { workbookCalculationId } = c.req.valid("param");
        return c.json(
          presentWorkbookCalculation(
            await deps.workbookCalculationService.getWorkbookCalculation({
              currentUser: c.var.identity,
              workbookCalculationId,
            }),
          ),
          200,
        );
      },
    ),
    cancelWorkbookCalculation: workbookHandler(
      "cancelWorkbookCalculation",
      async (c) => {
        const { workbookCalculationId } = c.req.valid("param");
        await deps.workbookCalculationService.cancelWorkbookCalculation({
          currentUser: c.var.identity,
          workbookCalculationId,
        });
        return c.body(null, 204);
      },
    ),
    retryWorkbookCalculation: workbookHandler(
      "retryWorkbookCalculation",
      async (c) => {
        const { workbookCalculationId } = c.req.valid("param");
        return c.json(
          presentWorkbookCalculation(
            await deps.workbookCalculationService.retryWorkbookCalculation({
              currentUser: c.var.identity,
              workbookCalculationId,
              lineage: rootOperationLineage(c.var.requestId),
            }),
          ),
          201,
        );
      },
    ),
    listWorkbookSnapshots: workbookHandler(
      "listWorkbookSnapshots",
      async (c) => {
        const { workbookCalculationId } = c.req.valid("param");
        const query = c.req.valid("query");
        return c.json(
          presentWorkbookSnapshots(
            await deps.workbookCalculationService.listWorkbookSnapshots({
              currentUser: c.var.identity,
              workbookCalculationId,
              ...query,
            }),
          ),
          200,
        );
      },
    ),
    getWorkbookSnapshot: workbookHandler("getWorkbookSnapshot", async (c) => {
      const { workbookSnapshotId } = c.req.valid("param");
      return c.json(
        presentWorkbookSnapshot(
          await deps.workbookCalculationService.getWorkbookSnapshot({
            currentUser: c.var.identity,
            workbookSnapshotId,
          }),
        ),
        200,
      );
    }),
    resolveWorkbookSnapshotValue: workbookHandler(
      "resolveWorkbookSnapshotValue",
      async (c) => {
        const { workbookSnapshotId } = c.req.valid("param");
        const { ref } = c.req.valid("query");
        return c.json(
          presentWorkbookSnapshotValue(
            await deps.workbookCalculationService.resolveWorkbookSnapshotValue({
              currentUser: c.var.identity,
              workbookSnapshotId,
              source: { type: "cell", ref },
            }),
          ),
          200,
        );
      },
    ),
    getWorkbookEngineHealth: workbookHandler(
      "getWorkbookEngineHealth",
      async (c) => {
        return c.json(
          presentWorkbookEngineHealth(
            await deps.workbookCalculationService.engineHealth(),
          ),
          200,
        );
      },
    ),
  };
}
