// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readStudioDraftWorkbookFile } from "./studio-draft-assets-store";
import {
  listStudioDraftKeys,
  readStudioDraftSnapshot,
} from "./studio-draft-store";

describe("studio draft storage module imports", () => {
  it("does not touch browser storage during node import", async () => {
    expect(listStudioDraftKeys()).toEqual([]);
    expect(readStudioDraftSnapshot("new:default")).toEqual({
      error: "storage_unavailable",
      ok: false,
    });

    await expect(
      readStudioDraftWorkbookFile({
        draftKey: "new:default",
        sourceId: "source-1",
      }),
    ).resolves.toEqual({
      error: "indexeddb_unavailable",
      ok: false,
    });
  });
});
