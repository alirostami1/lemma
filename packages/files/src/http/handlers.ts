import { withHttpErrorHandler } from "@lemma/http";
import type { FilesService } from "../application/index.js";
import type { FilesHandlerMap } from "../gen/hono/index.js";
import { handleFilesError } from "./errors.js";
import {
  presentCreateFileUpload,
  presentDownloadFileUrl,
  presentFile,
  presentFiles,
} from "./presenters.js";

export type FilesHandlersDeps = {
  filesService: FilesService;
};

function filesHandler<TKey extends keyof FilesHandlerMap>(
  _operation: TKey,
  handler: FilesHandlerMap[TKey],
): FilesHandlerMap[TKey] {
  return withHttpErrorHandler(handler, handleFilesError);
}

export function createFilesHandlers(deps: FilesHandlersDeps): FilesHandlerMap {
  return {
    listFiles: filesHandler("listFiles", async (c) => {
      const query = c.req.valid("query");
      const result = await deps.filesService.listFiles({
        currentUser: c.var.identity,
        limit: query.limit,
        cursor: query.cursor,
        status: query.status,
        purpose: query.purpose,
      });

      return c.json(presentFiles(result), 200);
    }),

    createFileUpload: filesHandler("createFileUpload", async (c) => {
      const body = c.req.valid("json");

      const result = await deps.filesService.createFileUpload({
        currentUser: c.var.identity,
        originalName: body.originalName,
        contentType: body.contentType,
        byteSize: body.byteSize,
        checksumSha256: body.checksumSha256,
        purpose: body.purpose,
      });

      return c.json(presentCreateFileUpload(result), 201);
    }),

    getFile: filesHandler("getFile", async (c) => {
      const { fileId } = c.req.valid("param");
      const result = await deps.filesService.getFile({
        currentUser: c.var.identity,
        fileId,
      });

      return c.json(presentFile(result), 200);
    }),

    updateFile: filesHandler("updateFile", async (c) => {
      const body = c.req.valid("json");

      const { fileId } = c.req.valid("param");
      const result = await deps.filesService.updateFile({
        currentUser: c.var.identity,
        fileId,
        patch: {
          originalName: body.originalName,
          purpose: body.purpose,
        },
      });

      return c.json(presentFile(result), 200);
    }),

    deleteFile: filesHandler("deleteFile", async (c) => {
      const { fileId } = c.req.valid("param");
      await deps.filesService.deleteFile({
        currentUser: c.var.identity,
        fileId,
      });

      return c.body(null, 204);
    }),

    createFileDownloadUrl: filesHandler("createFileDownloadUrl", async (c) => {
      const { fileId } = c.req.valid("param");
      const result = await deps.filesService.createDownloadUrl({
        currentUser: c.var.identity,
        fileId,
      });

      return c.json(presentDownloadFileUrl(result), 200);
    }),

    completeFileUpload: filesHandler("completeFileUpload", async (c) => {
      const { uploadId } = c.req.valid("param");
      const result = await deps.filesService.completeFileUpload({
        currentUser: c.var.identity,
        uploadId,
      });

      c.header("Location", `/files/${result.file.id}`);
      return c.json(presentFile(result), 201);
    }),
  };
}
