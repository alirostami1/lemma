import { instrumentService } from "@lemma/observability";
import {
  assertFileCanBeDownloaded,
  type File,
  type FileId,
  FileNotFoundError,
  ForbiddenFileActionError,
} from "../domain/index.js";
import { canCreateFileDownloadUrl } from "./policies.js";
import type {
  FileContentReaderPort,
  FileStorage,
  FilesRepository,
} from "./ports.js";

const instrumentation = instrumentService("files", "content_reader");

export class FileContentReader implements FileContentReaderPort {
  constructor(
    private readonly deps: {
      filesRepository: FilesRepository;
      fileStorage: FileStorage;
    },
  ) {}

  async getFileContentMetadata(
    input: Parameters<FileContentReaderPort["getFileContentMetadata"]>[0],
  ): ReturnType<FileContentReaderPort["getFileContentMetadata"]> {
    return this.operation("get_file_content_metadata", async () => {
      const file = await this.findFileByIdOrThrow(input.fileId);

      if (!canCreateFileDownloadUrl(input.currentUser, file)) {
        throw new ForbiddenFileActionError("You cannot download this file.");
      }

      return this.getUploadedFileMetadata(file);
    });
  }

  async getFileContentMetadataForOwnerUserId(
    input: Parameters<
      FileContentReaderPort["getFileContentMetadataForOwnerUserId"]
    >[0],
  ): ReturnType<FileContentReaderPort["getFileContentMetadataForOwnerUserId"]> {
    return this.operation(
      "get_file_content_metadata_for_owner_user_id",
      async () => {
        const file = await this.findFileByIdOrThrow(input.fileId);

        if (file.ownerUserId !== input.ownerUserId) {
          throw new FileNotFoundError();
        }

        return this.getUploadedFileMetadata(file);
      },
    );
  }

  async readFileContent(
    input: Parameters<FileContentReaderPort["readFileContent"]>[0],
  ): ReturnType<FileContentReaderPort["readFileContent"]> {
    return this.operation("read_file_content", async () => {
      const file = await this.findFileByIdOrThrow(input.fileId);

      if (!canCreateFileDownloadUrl(input.currentUser, file)) {
        throw new ForbiddenFileActionError("You cannot download this file.");
      }

      return this.readUploadedFileContent(file);
    });
  }

  async readFileContentForOwnerUserId(
    input: Parameters<
      FileContentReaderPort["readFileContentForOwnerUserId"]
    >[0],
  ): ReturnType<FileContentReaderPort["readFileContentForOwnerUserId"]> {
    return this.operation("read_file_content_for_owner_user_id", async () => {
      const file = await this.findFileByIdOrThrow(input.fileId);

      if (file.ownerUserId !== input.ownerUserId) {
        throw new FileNotFoundError();
      }

      return this.readUploadedFileContent(file);
    });
  }

  private async findFileByIdOrThrow(fileId: FileId): Promise<File> {
    const file = await this.deps.filesRepository.findFileById(fileId);

    if (!file) {
      throw new FileNotFoundError();
    }

    return file;
  }

  private getUploadedFileMetadata(file: File) {
    assertFileCanBeDownloaded(file);

    return {
      byteSize: file.byteSize,
      checksumSha256: file.checksumSha256,
      contentType: file.contentType,
      fileId: file.id,
      originalName: file.originalName,
      ownerUserId: file.ownerUserId,
    };
  }

  private async readUploadedFileContent(file: File) {
    return {
      ...this.getUploadedFileMetadata(file),
      bytes: await this.deps.fileStorage.getObjectBytes({
        bucket: file.bucket,
        key: file.objectKey,
      }),
    };
  }

  private operation<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    return instrumentation.run(operation, fn);
  }
}
