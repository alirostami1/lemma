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
        serviceUrl: "http://localhost:8080",
        path,
        timeoutMs: 1000,
        maxResponseBytes: 1024,
        requestId,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    const init = fetch.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get("x-request-id")).toBe(requestId);
  });
});
