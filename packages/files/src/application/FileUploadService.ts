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
  CreateFileUploadCommand,
  CreateFileUploadResult,
  FileResult,
} from "./commands.js";
import {
  canCompleteFileUpload,
  canCreateFileUpload,
} from "./policies.js";
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
          id: uploadId,
          createdByUserId: ownerUserId,
          bucket: this.deps.config.bucket,
          objectKey: createUploadObjectKey({
            ownerUserId,
            uploadId,
            originalName: command.originalName,
          }),
          originalName: command.originalName,
          contentType: command.contentType,
          expectedByteSize: command.byteSize,
          checksumSha256: command.checksumSha256,
          purpose: command.purpose,
        },
        at,
      );

      const created = await this.deps.filesRepository.createFileUpload(upload);
      const url = await this.deps.fileStorage.createUploadUrl({
        bucket: created.bucket,
        key: created.objectKey,
        contentType: created.contentType,
        checksumSha256: created.checksumSha256,
      });

      return {
        upload: created,
        uploadUrl: {
          url,
          method: "PUT",
          expiresInSeconds: this.deps.config.uploadUrlExpiresInSeconds,
          headers: {
            "Content-Type": created.contentType,
            "x-amz-checksum-sha256": sha256HexToBase64(
              created.checksumSha256,
            ),
          },
        },
      };
    });
  }

  async completeFileUpload(
    command: CompleteFileUploadCommand,
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

      const at = this.deps.clock.now();

      try {
        const completedUpload = completeFileUploadSession(upload, at);
        await this.assertUploadedObjectMatches(upload);

        const file = createFileFromUpload(
          {
            id: this.deps.idGenerator.fileId(),
            uploadId: upload.id,
            ownerUserId: upload.createdByUserId,
            createdByUserId: upload.createdByUserId,
            bucket: upload.bucket,
            objectKey: upload.objectKey,
            originalName: upload.originalName,
            contentType: upload.contentType,
            byteSize: upload.expectedByteSize,
            checksumSha256: upload.checksumSha256,
            purpose: upload.purpose,
            metadata: upload.metadata,
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
    details.push({ path: "file", message: "Uploaded object was not found." });
    return details;
  }

  if (input.actual.byteSize !== input.expected.byteSize) {
    details.push({
      path: "byteSize",
      message: "Uploaded object size does not match declared file size.",
    });
  }
  if (input.actual.contentType !== input.expected.contentType) {
    details.push({
      path: "contentType",
      message: "Uploaded object content type does not match declared type.",
    });
  }
  if (
    input.actual.checksumSha256?.toLowerCase() !== input.expected.checksumSha256
  ) {
    details.push({
      path: "checksumSha256",
      message: "Uploaded object checksum does not match declared checksum.",
    });
  }
  return details;
}
