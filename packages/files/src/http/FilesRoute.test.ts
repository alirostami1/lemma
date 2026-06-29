import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CurrentUser } from "@lemma/identity/application";
import { createUser } from "@lemma/identity/domain";
import { Hono } from "hono";
import type { FilesService } from "../application/index.js";
import {
  createFileFromUpload,
  createFileUploadSession,
  FileNotFoundError,
  fileId,
  userId,
} from "../domain/index.js";
import type { FilesAppEnv } from "./env.js";
import { filesRoutes } from "./routes.js";

const ownerUserId = userId("019e9315-6a87-715f-9861-8654df099001");
const testFileId = fileId("019e9315-6a87-715f-9861-8654df099002");
const at = new Date("2026-06-24T00:00:00.000Z");

describe("files route", () => {
  it("rejects public upload attempts for workbook editor output purpose", async () => {
    let called = false;
    const app = createApp({
      async createFileUpload() {
        called = true;
        return uploadResult();
      },
    });

    const response = await app.request("/file-uploads", {
      body: JSON.stringify({
        byteSize: 1234,
        checksumSha256:
          "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        originalName: "source.xlsx",
        purpose: "workbook_editor_output",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    assert.equal(response.status, 400);
    assert.equal(called, false);
  });

  it("rejects public list attempts for workbook editor output purpose", async () => {
    let called = false;
    const app = createApp({
      async listFiles() {
        called = true;
        return { files: [], nextCursor: null };
      },
    });

    const response = await app.request("/files?purpose=workbook_editor_output");

    assert.equal(response.status, 400);
    assert.equal(called, false);
  });

  it("rejects file purpose updates", async () => {
    const app = createApp();

    const response = await app.request(`/files/${testFileId}`, {
      body: JSON.stringify({
        originalName: "renamed.xlsx",
        purpose: "workbook_editor_output",
      }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });

    assert.equal(response.status, 400);
  });

  it("returns 404 for public get of an internal editor-output file", async () => {
    const app = createApp({
      async getFile() {
        throw new FileNotFoundError();
      },
    });

    const response = await app.request(`/files/${testFileId}`);

    assert.equal(response.status, 404);
  });

  it("returns 404 for public download URL creation for an internal editor-output file", async () => {
    let called = false;
    const app = createApp({
      async createDownloadUrl() {
        called = true;
        throw new FileNotFoundError();
      },
    });

    const response = await app.request(`/files/${testFileId}/download-urls`, {
      method: "POST",
    });

    assert.equal(response.status, 404);
    assert.equal(called, true);
  });

  it("returns 404 for public delete of an internal editor-output file", async () => {
    const app = createApp({
      async deleteFile() {
        throw new FileNotFoundError();
      },
    });

    const response = await app.request(`/files/${testFileId}`, {
      method: "DELETE",
    });

    assert.equal(response.status, 404);
  });

  it("returns 404 for public patch of an internal editor-output file", async () => {
    const app = createApp({
      async updateFile() {
        throw new FileNotFoundError();
      },
    });

    const response = await app.request(`/files/${testFileId}`, {
      body: JSON.stringify({ originalName: "renamed.xlsx" }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });

    assert.equal(response.status, 404);
  });

  it("returns 404 for public completion of an internal editor-output upload", async () => {
    const app = createApp({
      async completeFileUpload() {
        throw new FileNotFoundError();
      },
    });

    const response = await app.request(
      "/file-uploads/019e9315-6a87-715f-9861-8654df099003/completions",
      { method: "POST" },
    );

    assert.equal(response.status, 404);
  });

  it("updates originalName without changing purpose", async () => {
    let receivedName: string | undefined;
    const app = createApp({
      async updateFile(input: { patch: { originalName?: string } }) {
        receivedName = input.patch.originalName;
        return { file: fileFixture({ originalName: "renamed.xlsx" }) };
      },
    });

    const response = await app.request(`/files/${testFileId}`, {
      body: JSON.stringify({ originalName: "renamed.xlsx" }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });

    assert.equal(response.status, 200);
    assert.equal(receivedName, "renamed.xlsx");
    const body = (await response.json()) as {
      file: { originalName: string; purpose: string };
    };
    assert.equal(body.file.originalName, "renamed.xlsx");
    assert.equal(body.file.purpose, "workbook");
  });
});

function createApp(service: Partial<FilesService> = {}) {
  const app = new Hono<FilesAppEnv>();
  app.route(
    "/",
    filesRoutes({
      // These route tests exercise only upload creation and file update paths,
      // so the fixture implements just those FilesService methods.
      filesService: {
        async completeFileUpload() {
          return { file: fileFixture() };
        },
        async createDownloadUrl() {
          return {
            download: {
              expiresInSeconds: 900,
              method: "GET" as const,
              url: "https://storage.example/download",
            },
          };
        },
        async createFileUpload() {
          return uploadResult();
        },
        async deleteFile() {},
        async getFile() {
          return { file: fileFixture() };
        },
        async listFiles() {
          return { files: [], nextCursor: null };
        },
        async updateFile() {
          return { file: fileFixture() };
        },
        ...service,
      } as FilesService,
      requireIdentity: async (c, next) => {
        c.set("identity", currentUser());
        c.set("requestId", "019e9315-6a87-715f-9861-8654df099099");
        await next();
      },
    }),
  );
  return app;
}

function fileFixture(patch: { originalName?: string } = {}) {
  return createFileFromUpload(
    {
      bucket: "files",
      byteSize: 1234,
      checksumSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      createdByUserId: ownerUserId,
      id: testFileId,
      objectKey: "object",
      originalName: patch.originalName ?? "source.xlsx",
      ownerUserId,
      purpose: "workbook",
      uploadId: "019e9315-6a87-715f-9861-8654df099003",
    },
    at,
  );
}

function uploadFixture() {
  return createFileUploadSession(
    {
      bucket: "files",
      checksumSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      createdByUserId: ownerUserId,
      expectedByteSize: 1234,
      id: "019e9315-6a87-715f-9861-8654df099003",
      objectKey: "object",
      originalName: "source.xlsx",
      purpose: "workbook",
    },
    at,
  );
}

function uploadResult() {
  return {
    upload: uploadFixture(),
    uploadUrl: {
      expiresInSeconds: 900,
      headers: {},
      method: "PUT" as const,
      url: "https://storage.example/upload",
    },
  };
}

function currentUser(): CurrentUser {
  return {
    isAdmin: false,
    roles: [],
    user: createUser(
      {
        displayName: "Owner",
        email: "owner@example.com",
        id: ownerUserId,
        identityId: "keycloak|owner",
      },
      at,
    ),
  };
}
