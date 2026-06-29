import { instrumentService } from "@lemma/observability";
import {
  completeFileUploadSession,
  createFileFromUpload,
  createFileUploadSession,
  FileStorageObjectMismatchError,
  FileUploadExpiredError,
  FileUploadNotFoundError,
  ForbiddenFileActionError,
  InvalidFileStateError,
  markFileUploadExpired,
  fileUploadId as toFileUploadId,
  type UserId,
} from "../domain/index.js";
import type {
  CompleteFileUploadCommand,
  CompleteInternalFileUploadCommand,
  CreateFileUploadCommand,
  CreateFileUploadResult,
  CreateInternalFileUploadCommand,
  FileResult,
} from "./commands.js";
import { canCompleteFileUpload, canCreateFileUpload } from "./policies.js";
import type {
  Clock,
  FileStorage,
  FilesRepository,
  FilesServiceConfig,
  IdGenerator,
} from "./ports.js";

const instrumentation = instrumentService("files", "upload_service");

export class FileUploadService {
  constructor(
    private readonly deps: {
      filesRepository: FilesRepository;
      fileStorage: FileStorage;
      idGenerator: IdGenerator;
      clock: Clock;
      config: FilesServiceConfig;
    },
  ) {}

  async createFileUpload(
    command: CreateFileUploadCommand,
  ): Promise<CreateFileUploadResult> {
    return this.createFileUploadSession(command);
  }

  async createInternalFileUpload(
    command: CreateInternalFileUploadCommand,
  ): Promise<CreateFileUploadResult> {
    return this.createFileUploadSession(command);
  }

  private async createFileUploadSession(
    command: (CreateFileUploadCommand | CreateInternalFileUploadCommand) & {
      metadata?: Record<string, unknown>;
    },
  ): Promise<CreateFileUploadResult> {
    return this.operation("create_file_upload", async () => {
      this.assertAuthorized(
        canCreateFileUpload(command.currentUser),
        "You cannot create file uploads.",
      );

      const at = this.deps.clock.now();
      const uploadId = this.deps.idGenerator.fileUploadId();
      const ownerUserId = command.currentUser.user.id;

      const upload = createFileUploadSession(
        {
          bucket: this.deps.config.bucket,
          checksumSha256: command.checksumSha256,
          contentType: command.contentType,
          createdByUserId: ownerUserId,
          expectedByteSize: command.byteSize,
          id: uploadId,
          metadata: command.metadata,
          objectKey: createUploadObjectKey({
            originalName: command.originalName,
            ownerUserId,
            uploadId,
          }),
          originalName: command.originalName,
          purpose: command.purpose,
        },
        at,
      );

      const created = await this.deps.filesRepository.createFileUpload(upload);
      const url = await this.deps.fileStorage.createUploadUrl({
        bucket: created.bucket,
        checksumSha256: created.checksumSha256,
        contentType: created.contentType,
        key: created.objectKey,
      });

      return {
        upload: created,
        uploadUrl: {
          expiresInSeconds: this.deps.config.uploadUrlExpiresInSeconds,
          headers: {
            "Content-Type": created.contentType,
            "x-amz-checksum-sha256": sha256HexToBase64(created.checksumSha256),
          },
          method: "PUT",
          url,
        },
      };
    });
  }

  async completeFileUpload(
    command: CompleteFileUploadCommand,
  ): Promise<FileResult> {
    return this.completeFileUploadForPurpose(command, ["workbook"]);
  }

  async completeInternalFileUpload(
    command: CompleteInternalFileUploadCommand,
  ): Promise<FileResult> {
    return this.completeFileUploadForPurpose(command, [command.purpose]);
  }

  private async completeFileUploadForPurpose(
    command: CompleteFileUploadCommand,
    allowedPurposes: readonly string[],
  ): Promise<FileResult> {
    return this.operation("complete_file_upload", async () => {
      const upload = await this.deps.filesRepository.findFileUploadById(
        toFileUploadId(command.uploadId),
      );

      if (!upload) {
        throw new FileUploadNotFoundError();
      }

      this.assertAuthorized(
        canCompleteFileUpload(command.currentUser, upload),
        "You cannot complete this upload.",
      );

      if (!allowedPurposes.includes(upload.purpose)) {
        throw new FileUploadNotFoundError();
      }

      const at = this.deps.clock.now();

      try {
        const completedUpload = completeFileUploadSession(upload, at);
        await this.assertUploadedObjectMatches(upload);

        const file = createFileFromUpload(
          {
            bucket: upload.bucket,
            byteSize: upload.expectedByteSize,
            checksumSha256: upload.checksumSha256,
            contentType: upload.contentType,
            createdByUserId: upload.createdByUserId,
            id: this.deps.idGenerator.fileId(),
            metadata: upload.metadata,
            objectKey: upload.objectKey,
            originalName: upload.originalName,
            ownerUserId: upload.createdByUserId,
            purpose: upload.purpose,
            uploadId: upload.id,
          },
          at,
        );

        const existing = await this.deps.filesRepository.findFileByUploadId(
          upload.id,
        );
        if (existing) {
          throw new InvalidFileStateError(
            "File upload has already been completed.",
          );
        }

        return {
          file: await this.deps.filesRepository.createFileFromUpload({
            file,
            upload: completedUpload,
          }),
        };
      } catch (error) {
        if (error instanceof FileUploadExpiredError) {
          await this.deps.filesRepository.updateFileUpload(
            markFileUploadExpired(upload, error.message, at),
          );
        }
        throw error;
      }
    });
  }

  private async assertUploadedObjectMatches(input: {
    bucket: string;
    objectKey: string;
    expectedByteSize: number;
    checksumSha256: string;
    contentType: string;
  }): Promise<void> {
    const metadata = await this.deps.fileStorage.getObjectMetadata({
      bucket: input.bucket,
      key: input.objectKey,
    });
    const details = uploadMismatchDetails({
      actual: metadata,
      expected: {
        byteSize: input.expectedByteSize,
        checksumSha256: input.checksumSha256,
        contentType: input.contentType,
      },
    });

    if (details.length > 0) {
      throw new FileStorageObjectMismatchError(
        "uploaded object does not match declared upload",
        details,
      );
    }
  }

  private assertAuthorized(condition: boolean, message: string): void {
    if (!condition) {
      throw new ForbiddenFileActionError(message);
    }
  }

  private async operation<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return instrumentation.run(operation, fn);
  }
}

function createUploadObjectKey(input: {
  ownerUserId: UserId;
  uploadId: string;
  originalName: string;
}): string {
  return `users/${input.ownerUserId}/file-uploads/${input.uploadId}/${sanitizeFileName(input.originalName)}`;
}

function sanitizeFileName(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\\/]+/g, "-")
    .replace(/^\.+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return normalized || "file";
}

function sha256HexToBase64(value: string): string {
  return Buffer.from(value, "hex").toString("base64");
}

function uploadMismatchDetails(input: {
  actual: {
    byteSize?: number;
    checksumSha256?: string;
    contentType?: string;
  } | null;
  expected: {
    byteSize: number;
    checksumSha256: string;
    contentType: string;
  };
}): Array<{ path: string; message: string }> {
  const details: Array<{ path: string; message: string }> = [];

  if (!input.actual) {
    details.push({ message: "Uploaded object was not found.", path: "file" });
    return details;
  }

  if (input.actual.byteSize !== input.expected.byteSize) {
    details.push({
      message: "Uploaded object size does not match declared file size.",
      path: "byteSize",
    });
  }
  if (input.actual.contentType !== input.expected.contentType) {
    details.push({
      message: "Uploaded object content type does not match declared type.",
      path: "contentType",
    });
  }
  if (
    input.actual.checksumSha256?.toLowerCase() !== input.expected.checksumSha256
  ) {
    details.push({
      message: "Uploaded object checksum does not match declared checksum.",
      path: "checksumSha256",
    });
  }
  return details;
}
