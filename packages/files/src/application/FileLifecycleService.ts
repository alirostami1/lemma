import { instrumentService } from "@lemma/observability";
import {
  markFileDeleted,
  markFileUploadExpired,
  fileId as toFileId,
  fileUploadId as toFileUploadId,
} from "../domain/index.js";
import type {
  HandleFileDeletionCommand,
  HandleFileUploadExpirationCommand,
} from "./commands.js";
import type {
  Clock,
  FileStorage,
  FilesRepository,
} from "./ports.js";

const instrumentation = instrumentService("files", "lifecycle_service");

export class FileLifecycleService {
  constructor(
    private readonly deps: {
      filesRepository: FilesRepository;
      fileStorage: FileStorage;
      clock: Clock;
    },
  ) {}

  async handleFileDeletion(command: HandleFileDeletionCommand): Promise<void> {
    await this.operation("handle_file_deletion", async () => {
      const file = await this.deps.filesRepository.findFileById(
        toFileId(command.fileId),
      );
      if (!file || file.status === "deleted") {
        return;
      }

      await this.deps.fileStorage.deleteObject({
        bucket: file.bucket,
        key: file.objectKey,
      });

      await this.deps.filesRepository.updateFile(
        markFileDeleted(file, this.deps.clock.now()),
      );
    });
  }

  async handleFileUploadExpiration(
    command: HandleFileUploadExpirationCommand,
  ): Promise<void> {
    await this.operation("handle_file_upload_expiration", async () => {
      const upload = await this.deps.filesRepository.findFileUploadById(
        toFileUploadId(command.uploadId),
      );
      if (!upload || upload.status !== "initiated") {
        return;
      }

      const expired = markFileUploadExpired(
        upload,
        "file upload expired",
        this.deps.clock.now(),
      );
      await this.deps.filesRepository.updateFileUpload(expired);
      await this.deps.fileStorage.deleteObject({
        bucket: expired.bucket,
        key: expired.objectKey,
      });
    });
  }

  private async operation<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return instrumentation.run(operation, fn);
  }
}
