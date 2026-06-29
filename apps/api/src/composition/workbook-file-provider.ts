import type {
  FileContent,
  FileContentMetadata,
  FileContentReaderPort,
} from "@lemma/files/application";
import type {
  WorkbookFileContent,
  WorkbookFileMetadata,
  WorkbookFileProviderPort,
} from "@lemma/workbook/application";

export function createWorkbookFileProvider(
  fileContentReader: FileContentReaderPort,
): WorkbookFileProviderPort {
  return {
    getWorkbookFileMetadata: async (input) =>
      toWorkbookFileMetadata(
        await fileContentReader.getFileContentMetadata(input),
      ),
    getWorkbookFileMetadataForOwnerUserId: async (input) =>
      toWorkbookFileMetadata(
        await fileContentReader.getFileContentMetadataForOwnerUserId(input),
      ),
    readWorkbookFileContent: async (input) =>
      toWorkbookFileContent(await fileContentReader.readFileContent(input)),
    readWorkbookFileContentForOwnerUserId: async (input) =>
      toWorkbookFileContent(
        await fileContentReader.readFileContentForOwnerUserId(input),
      ),
  };
}

function toWorkbookFileMetadata(
  file: FileContentMetadata,
): WorkbookFileMetadata {
  return {
    fileId: file.fileId,
    originalName: file.originalName,
    contentType: file.contentType,
    byteSize: file.byteSize,
    checksumSha256: file.checksumSha256,
  };
}

function toWorkbookFileContent(file: FileContent): WorkbookFileContent {
  return {
    ...toWorkbookFileMetadata(file),
    bytes: file.bytes,
  };
}
