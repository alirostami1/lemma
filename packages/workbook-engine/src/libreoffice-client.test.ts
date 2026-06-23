import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { postWorkbookToLibreOfficeWorker } from "./libreoffice-client.js";

describe("LibreOffice worker client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the request id to the worker", async () => {
    const requestId = "019e9315-6a87-715f-9861-8654df070d10";
    const dir = await mkdtemp(join(tmpdir(), "lemma-workbook-engine-"));
    const path = join(dir, "workbook.xlsx");
    await writeFile(path, new Uint8Array([1, 2, 3]));
    const fetch = vi.fn(
      async (_url: URL, _init?: RequestInit): Promise<Response> =>
        new Response(JSON.stringify({ sheets: [] })),
    );
    vi.stubGlobal("fetch", fetch);

    try {
      await postWorkbookToLibreOfficeWorker({
        maxCachedValueBytes: 1024,
        maxCells: 100,
        maxResponseBytes: 1024,
        maxSheets: 10,
        path,
        requestId,
        serviceUrl: "http://localhost:8080",
        timeoutMs: 1000,
      });
    } finally {
      await rm(dir, { force: true, recursive: true });
    }

    const init = fetch.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get("x-request-id")).toBe(requestId);
  });

  it("rejects worker values that exceed configured cell limits", async () => {
    const state = await workbookRequestState(
      JSON.stringify({
        sheets: [
          {
            cells: { A1: "1", A2: "2" },
            name: "Sheet1",
          },
        ],
      }),
    );

    await expect(
      postWorkbookToLibreOfficeWorker({
        ...state.input,
        maxCells: 1,
      }),
    ).rejects.toMatchObject({
      code: "workbook_too_large",
    });

    await state.cleanup();
  });

  it("classifies worker server errors as calculation failures", async () => {
    const state = await workbookRequestState("failed", { status: 500 });

    await expect(postWorkbookToLibreOfficeWorker(state.input)).rejects.toEqual(
      expect.objectContaining({
        code: "calculation_failed",
      }),
    );

    await state.cleanup();
  });
});

async function workbookRequestState(
  body: string,
  responseInit?: ResponseInit,
): Promise<{
  input: Parameters<typeof postWorkbookToLibreOfficeWorker>[0];
  cleanup(): Promise<void>;
}> {
  const dir = await mkdtemp(join(tmpdir(), "lemma-workbook-engine-"));
  const path = join(dir, "workbook.xlsx");
  await writeFile(path, new Uint8Array([1, 2, 3]));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, responseInit)),
  );
  return {
    cleanup: () => rm(dir, { force: true, recursive: true }),
    input: {
      maxCachedValueBytes: 1024,
      maxCells: 100,
      maxResponseBytes: 1024,
      maxSheets: 10,
      path,
      serviceUrl: "http://localhost:8080",
      timeoutMs: 1000,
    },
  };
}
