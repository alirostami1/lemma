import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FileContentReaderPort } from "@lemma/files/application";
import { fileId, userId } from "@lemma/files/domain";
import { createWorkbookFileProvider } from "./workbook-file-provider.js";

const workbookFileId = fileId("019e9315-6a87-715f-9861-8654df070a01");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df070a02");
const metadata = {
  fileId: workbookFileId,
  ownerUserId,
  originalName: "budget.xlsx",
  contentType:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  byteSize: 42,
  checksumSha256: "checksum",
};

describe("createWorkbookFileProvider", () => {
  it("maps file metadata to the workbook provider contract", async () => {
    const provider = createWorkbookFileProvider(createReader());

    const result = await provider.getWorkbookFileMetadata({} as never);

    assert.deepEqual(result, {
      fileId: workbookFileId,
      originalName: "budget.xlsx",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      byteSize: 42,
      checksumSha256: "checksum",
    });
  });

  it("maps file content to the workbook provider contract", async () => {
    const provider = createWorkbookFileProvider(createReader());

    const result = await provider.readWorkbookFileContentForOwnerUserId(
      {} as never,
    );

    assert.deepEqual(result, {
      fileId: workbookFileId,
      originalName: "budget.xlsx",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      byteSize: 42,
      checksumSha256: "checksum",
      bytes: new Uint8Array([1, 2, 3]),
    });
  });
});

function createReader(): FileContentReaderPort {
  return {
    getFileContentMetadata: async () => metadata,
    getFileContentMetadataForOwnerUserId: async () => metadata,
    readFileContent: async () => ({
      ...metadata,
      bytes: new Uint8Array([1, 2, 3]),
    }),
    readFileContentForOwnerUserId: async () => ({
      ...metadata,
      bytes: new Uint8Array([1, 2, 3]),
    }),
  };
}
