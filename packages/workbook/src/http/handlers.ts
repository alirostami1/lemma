import { rootOperationLineage } from "@lemma/domain";
import { withHttpErrorHandler } from "@lemma/http";
import type {
  WorkbookCalculationService,
  WorkbookService,
} from "../application/index.js";
import type { WorkbookHandlerMap } from "../generated/hono/index.js";
import { handleWorkbookError } from "./errors.js";
import {
  presentWorkbook,
  presentWorkbookCalculation,
  presentWorkbookCalculations,
  presentWorkbookEngineHealth,
  presentWorkbookSnapshot,
  presentWorkbookSnapshotCells,
  presentWorkbookSnapshotMetadata,
  presentWorkbookSnapshotRange,
  presentWorkbookSnapshotRangeBatch,
  presentWorkbookSnapshotSheets,
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

const IMMUTABLE_WORKBOOK_SNAPSHOT_CACHE_CONTROL =
  "private, max-age=31536000, immutable";

function setImmutableWorkbookSnapshotCacheHeaders(c: {
  header(name: string, value: string): void;
}) {
  c.header("Cache-Control", IMMUTABLE_WORKBOOK_SNAPSHOT_CACHE_CONTROL);
}

export function createWorkbookHandlers(
  deps: WorkbookHandlersDeps,
): WorkbookHandlerMap {
  return {
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
    createWorkbookCalculation: workbookHandler(
      "createWorkbookCalculation",
      async (c) => {
        const { workbookId } = c.req.valid("param");
        const body = c.req.valid("json");
        return c.json(
          presentWorkbookCalculation(
            await deps.workbookCalculationService.requestWorkbookCalculation({
              currentUser: c.var.identity,
              lineage: rootOperationLineage(c.var.requestId),
              sources: [{ sourceId: "preview", workbookId }],
              ...body,
            }),
          ),
          201,
        );
      },
    ),
    deleteWorkbook: workbookHandler("deleteWorkbook", async (c) => {
      const { workbookId } = c.req.valid("param");
      await deps.workbookService.deleteWorkbook({
        currentUser: c.var.identity,
        workbookId,
      });
      return c.body(null, 204);
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
    getWorkbookSnapshot: workbookHandler("getWorkbookSnapshot", async (c) => {
      const { workbookSnapshotId } = c.req.valid("param");
      const response = presentWorkbookSnapshot(
        await deps.workbookCalculationService.getWorkbookSnapshot({
          currentUser: c.var.identity,
          workbookSnapshotId,
        }),
      );
      setImmutableWorkbookSnapshotCacheHeaders(c);
      return c.json(response, 200);
    }),
    getWorkbookSnapshotCells: workbookHandler(
      "getWorkbookSnapshotCells",
      async (c) => {
        const { workbookSnapshotId, sheetIndex } = c.req.valid("param");
        const query = c.req.valid("query");
        const response = presentWorkbookSnapshotCells(
          await deps.workbookCalculationService.getWorkbookSnapshotCells({
            currentUser: c.var.identity,
            sheetIndex: Number(sheetIndex),
            workbookSnapshotId,
            ...query,
          }),
        );
        setImmutableWorkbookSnapshotCacheHeaders(c);
        return c.json(response, 200);
      },
    ),
    getWorkbookSnapshotMetadata: workbookHandler(
      "getWorkbookSnapshotMetadata",
      async (c) => {
        const { workbookSnapshotId } = c.req.valid("param");
        const response = presentWorkbookSnapshotMetadata(
          await deps.workbookCalculationService.getWorkbookSnapshotMetadata({
            currentUser: c.var.identity,
            workbookSnapshotId,
          }),
        );
        setImmutableWorkbookSnapshotCacheHeaders(c);
        return c.json(response, 200);
      },
    ),
    getWorkbookSnapshotRange: workbookHandler(
      "getWorkbookSnapshotRange",
      async (c) => {
        const { workbookSnapshotId } = c.req.valid("param");
        const query = c.req.valid("query");
        const response = presentWorkbookSnapshotRange(
          await deps.workbookCalculationService.getWorkbookSnapshotRange({
            currentUser: c.var.identity,
            workbookSnapshotId,
            ...query,
          }),
        );
        setImmutableWorkbookSnapshotCacheHeaders(c);
        return c.json(response, 200);
      },
    ),
    getWorkbookSnapshotRangeBatch: workbookHandler(
      "getWorkbookSnapshotRangeBatch",
      async (c) => {
        const { workbookSnapshotId } = c.req.valid("param");
        const body = c.req.valid("json");
        const response = presentWorkbookSnapshotRangeBatch(
          await deps.workbookCalculationService.getWorkbookSnapshotRangeBatch({
            currentUser: c.var.identity,
            workbookSnapshotId,
            ...body,
          }),
        );
        setImmutableWorkbookSnapshotCacheHeaders(c);
        return c.json(response, 200);
      },
    ),
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
    listWorkbookSnapshotSheets: workbookHandler(
      "listWorkbookSnapshotSheets",
      async (c) => {
        const { workbookSnapshotId } = c.req.valid("param");
        const query = c.req.valid("query");
        const response = presentWorkbookSnapshotSheets(
          await deps.workbookCalculationService.listWorkbookSnapshotSheets({
            currentUser: c.var.identity,
            workbookSnapshotId,
            ...query,
          }),
        );
        setImmutableWorkbookSnapshotCacheHeaders(c);
        return c.json(response, 200);
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
    resolveWorkbookSnapshotValue: workbookHandler(
      "resolveWorkbookSnapshotValue",
      async (c) => {
        const { workbookSnapshotId } = c.req.valid("param");
        const { ref } = c.req.valid("query");
        const response = presentWorkbookSnapshotValue(
          await deps.workbookCalculationService.resolveWorkbookSnapshotValue({
            currentUser: c.var.identity,
            source: { ref, type: "cell" },
            workbookSnapshotId,
          }),
        );
        setImmutableWorkbookSnapshotCacheHeaders(c);
        return c.json(response, 200);
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
              lineage: rootOperationLineage(c.var.requestId),
              workbookCalculationId,
            }),
          ),
          201,
        );
      },
    ),
    updateWorkbook: workbookHandler("updateWorkbook", async (c) => {
      const { workbookId } = c.req.valid("param");
      const body = c.req.valid("json");
      return c.json(
        presentWorkbook(
          await deps.workbookService.updateWorkbook({
            currentUser: c.var.identity,
            patch: body,
            workbookId,
          }),
        ),
        200,
      );
    }),
    validateWorkbook: workbookHandler("validateWorkbook", async (c) => {
      const { workbookId } = c.req.valid("param");
      return c.json(
        presentWorkbook(
          await deps.workbookService.validateWorkbook({
            currentUser: c.var.identity,
            lineage: rootOperationLineage(c.var.requestId),
            workbookId,
          }),
        ),
        200,
      );
    }),
  };
}
