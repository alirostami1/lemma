import type {
  WorkbookCalculationService,
  WorkbookService,
} from "../application/index.js";
import { createWorkbookRoutes } from "../generated/hono/index.js";
import type { RequireIdentity } from "./env.js";
import { createWorkbookHandlers } from "./handlers.js";

export type WorkbookRoutesDeps = {
  requireIdentity: RequireIdentity;
  workbookService: WorkbookService;
  workbookCalculationService: WorkbookCalculationService;
};

export function workbookRoutes(deps: WorkbookRoutesDeps) {
  return createWorkbookRoutes({
    handlers: createWorkbookHandlers({
      workbookCalculationService: deps.workbookCalculationService,
      workbookService: deps.workbookService,
    }),
    requireIdentity: deps.requireIdentity,
  });
}
