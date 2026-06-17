import { instrumentService } from "@lemma/observability";
import {
  assertFileCanBeDownloaded,
  assertFileIsVisible,
  type File,
  type FileId,
  FileNotFoundError,
  type FileStatus,
  ForbiddenFileActionError,
  filePurpose,
  fileStatus,
  InvalidDomainValueError,
  markFileDeleting,
  originalFileName,
  fileId as toFileId,
  updateFile as updateFileDomain,
  VISIBLE_FILE_STATUSES,
} from "../domain/index.js";
import type {
  CompleteFileUploadCommand,
  CreateDownloadUrlCommand,
  CreateFileUploadCommand,
  CreateFileUploadResult,
  DeleteFileCommand,
  DownloadUrlResult,
  FileResult,
  FilesResult,
  GetFileCommand,
  GetFileForOwnerUserIdCommand,
  HandleFileDeletionCommand,
  HandleFileUploadExpirationCommand,
  ListFilesCommand,
  UpdateFileCommand,
} from "./commands.js";
import { FileLifecycleService } from "./FileLifecycleService.js";
import { FileUploadService } from "./FileUploadService.js";
import {
  canCreateFileDownloadUrl,
  canDeleteFile,
  canListFiles,
  canUpdateFile,
  canViewFile,
} from "./policies.js";
import type {
  Clock,
  FileStorage,
  FilesRepository,
  FilesServiceConfig,
  IdGenerator,
} from "./ports.js";

const instrumentation = instrumentService("files", "service");

export class FilesService {
  private readonly fileUploadService: FileUploadService;
  private readonly fileLifecycleService: FileLifecycleService;

  constructor(
    private readonly deps: {
      filesRepository: FilesRepository;
      fileStorage: FileStorage;
      idGenerator: IdGenerator;
      clock: Clock;
      config: FilesServiceConfig;
    },
  ) {
    this.fileUploadService = new FileUploadService(deps);
    this.fileLifecycleService = new FileLifecycleService({
      filesRepository: deps.filesRepository,
      fileStorage: deps.fileStorage,
      clock: deps.clock,
    });
  }

  async listFiles(command: ListFilesCommand): Promise<FilesResult> {
    this.assertAuthorized(
      canListFiles(command.currentUser),
      "You cannot list files.",
    );

    const limit = normalizeListLimit(command.limit);
    const statuses = listStatuses(command.status, command.currentUser.isAdmin);

    if (statuses.length === 0) {
      return { files: [], nextCursor: null };
    }

    const files = await this.deps.filesRepository.listFilesByOwnerUserId({
      ownerUserId: command.currentUser.user.id,
      statuses,
      purpose:
        command.purpose !== undefined
          ? filePurpose(command.purpose)
          : undefined,
      cursor: command.cursor ? decodeListCursor(command.cursor) : undefined,
      limit: limit + 1,
    });

    return {
      files: files.slice(0, limit),
      nextCursor:
        files.length > limit
          ? encodeListCursor(files[limit - 1]?.createdAt)
          : null,
    };
  }

  async createFileUpload(
    command: CreateFileUploadCommand,
  ): Promise<CreateFileUploadResult> {
    return this.fileUploadService.createFileUpload(command);
  }

  async getFile(command: GetFileCommand): Promise<FileResult> {
    const file = await this.findFileByIdOrThrow(toFileId(command.fileId));

    this.assertAuthorized(
      canViewFile(command.currentUser, file),
      "You cannot view this file.",
    );
    assertFileIsVisible(file);

    return { file };
  }

  async getFileForOwnerUserId(
    command: GetFileForOwnerUserIdCommand,
  ): Promise<FileResult> {
    const file = await this.findFileByIdOrThrow(toFileId(command.fileId));

    if (file.ownerUserId !== command.ownerUserId) {
      throw new FileNotFoundError();
    }
    assertFileIsVisible(file);

    return { file };
  }

  async updateFile(command: UpdateFileCommand): Promise<FileResult> {
    const file = await this.findFileByIdOrThrow(toFileId(command.fileId));

    this.assertAuthorized(
      canUpdateFile(command.currentUser, file),
      "You cannot update this file.",
    );

    const updated = updateFileDomain(
      file,
      {
        originalName:
          command.patch.originalName !== undefined
            ? originalFileName(command.patch.originalName)
            : undefined,
        purpose:
          command.patch.purpose !== undefined
            ? filePurpose(command.patch.purpose)
            : undefined,
      },
      this.deps.clock.now(),
    );

    return { file: await this.persistExistingFile(updated) };
  }

  async completeFileUpload(
    command: CompleteFileUploadCommand,
  ): Promise<FileResult> {
    return this.fileUploadService.completeFileUpload(command);
  }

  async deleteFile(command: DeleteFileCommand): Promise<void> {
    const file = await this.findFileByIdOrThrow(toFileId(command.fileId));

    this.assertAuthorized(
      canDeleteFile(command.currentUser, file),
      "You cannot delete this file.",
    );
    assertFileIsVisible(file);

    await this.persistExistingFile(
      markFileDeleting(file, this.deps.clock.now()),
    );
  }

  async createDownloadUrl(
    command: CreateDownloadUrlCommand,
  ): Promise<DownloadUrlResult> {
    return this.operation("create_download_url", async () => {
      const file = await this.findFileByIdOrThrow(toFileId(command.fileId));

      this.assertAuthorized(
        canCreateFileDownloadUrl(command.currentUser, file),
        "You cannot download this file.",
      );
      assertFileCanBeDownloaded(file);

      return {
        download: {
          url: await this.deps.fileStorage.createDownloadUrl({
            bucket: file.bucket,
            key: file.objectKey,
          }),
          method: "GET",
          expiresInSeconds: this.deps.config.downloadUrlExpiresInSeconds,
        },
      };
    });
  }

  async handleFileDeletion(command: HandleFileDeletionCommand): Promise<void> {
    await this.fileLifecycleService.handleFileDeletion(command);
  }

  async handleFileUploadExpiration(
    command: HandleFileUploadExpirationCommand,
  ): Promise<void> {
    await this.fileLifecycleService.handleFileUploadExpiration(command);
  }

  private async findFileByIdOrThrow(fileId: FileId): Promise<File> {
    const file = await this.deps.filesRepository.findFileById(fileId);

    if (!file) {
      throw new FileNotFoundError();
    }

    return file;
  }

  private async persistExistingFile(file: File): Promise<File> {
    const persisted = await this.deps.filesRepository.updateFile(file);

    if (!persisted) {
      throw new FileNotFoundError();
    }

    return persisted;
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

function normalizeListLimit(value: number | undefined): number {
  return Math.min(Math.max(value ?? 50, 1), 100);
}

function listStatuses(
  value: string | undefined,
  isAdmin: boolean,
): readonly FileStatus[] {
  if (!value) {
    return VISIBLE_FILE_STATUSES;
  }

  const status = fileStatus(value);
  if (!isAdmin && status !== "uploaded") {
    return [];
  }
  return [status];
}

function encodeListCursor(value: Date | undefined): string | null {
  return value
    ? Buffer.from(value.toISOString(), "utf8").toString("base64url")
    : null;
}

function decodeListCursor(value: string): Date {
  const decoded = new Date(Buffer.from(value, "base64url").toString("utf8"));
  if (Number.isNaN(decoded.getTime())) {
    throw new InvalidDomainValueError("cursor must be a valid list cursor.");
  }
  return decoded;
}
