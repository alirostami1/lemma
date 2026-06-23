import type { FilesService } from "../application/index.js";
import { createFilesRoutes } from "../generated/hono/index.js";
import type { RequireIdentity } from "./env.js";
import { createFilesHandlers } from "./handlers.js";

export type FilesRoutesDeps = {
  requireIdentity: RequireIdentity;
  filesService: FilesService;
};

export function filesRoutes(deps: FilesRoutesDeps) {
  return createFilesRoutes({
    handlers: createFilesHandlers({
      filesService: deps.filesService,
    }),
    requireIdentity: deps.requireIdentity,
  });
}
