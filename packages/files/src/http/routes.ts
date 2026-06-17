import type { FilesService } from "../application/index.js";
import { createFilesRoutes } from "../gen/hono/index.js";
import type { RequireIdentity } from "./env.js";
import { createFilesHandlers } from "./handlers.js";

export type FilesRoutesDeps = {
  requireIdentity: RequireIdentity;
  filesService: FilesService;
};

export function filesRoutes(deps: FilesRoutesDeps) {
  return createFilesRoutes({
    requireIdentity: deps.requireIdentity,
    handlers: createFilesHandlers({
      filesService: deps.filesService,
    }),
  });
}
