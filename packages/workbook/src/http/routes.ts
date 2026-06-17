import type {
  WorkbookCalculationService,
  WorkbookService,
} from "../application/index.js";
import { createWorkbookRoutes } from "../gen/hono/index.js";
import type { RequireIdentity } from "./env.js";
import { createWorkbookHandlers } from "./handlers.js";

export type WorkbookRoutesDeps = {
  requireIdentity: RequireIdentity;
  workbookService: WorkbookService;
  workbookCalculationService: WorkbookCalculationService;
};

export function workbookRoutes(deps: WorkbookRoutesDeps) {
  return createWorkbookRoutes({
    requireIdentity: deps.requireIdentity,
    handlers: createWorkbookHandlers({
      workbookService: deps.workbookService,
      workbookCalculationService: deps.workbookCalculationService,
    }),
  });
}
