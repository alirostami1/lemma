import type { FileContentReaderPort } from "@lemma/files/application";
import type {
  WorkbookFileContent,
  WorkbookFileMetadata,
  WorkbookFileProviderPort,
} from "@lemma/workbook/application";

type ReadFileMetadata = Awaited<
  ReturnType<FileContentReaderPort["getFileContentMetadata"]>
>;

type ReadFileContent = Awaited<
  ReturnType<FileContentReaderPort["readFileContent"]>
>;

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
  file: ReadFileMetadata,
): WorkbookFileMetadata {
  return {
    fileId: file.fileId,
    originalName: file.originalName,
    contentType: file.contentType,
    byteSize: file.byteSize,
    checksumSha256: file.checksumSha256,
  };
}

function toWorkbookFileContent(file: ReadFileContent): WorkbookFileContent {
  return {
    ...toWorkbookFileMetadata(file),
    bytes: file.bytes,
  };
}
