import { instrumentService } from "@lemma/observability";
import {
  claimFileGarbageCollection,
  fileGarbageCollectionClaimToken,
  markFileDeleted,
  markFileUploadExpired,
  fileId as toFileId,
  fileUploadId as toFileUploadId,
} from "../domain/index.js";
import type {
  CollectDeletedFileContentCommand,
  HandleFileUploadExpirationCommand,
} from "./commands.js";
import {
  evaluateFileGarbageCollection,
  type FileGarbageCollectionEligibility,
} from "./file-garbage-collection-policy.js";
import type {
  Clock,
  FileGarbageCollectionTransactionPort,
  FileStorage,
  FilesRepository,
} from "./ports.js";

const instrumentation = instrumentService("files", "lifecycle_service");

export class FileLifecycleService {
  constructor(
    private readonly deps: {
      filesRepository: FilesRepository;
      garbageCollectionTransaction: FileGarbageCollectionTransactionPort;
      fileStorage: FileStorage;
      clock: Clock;
    },
  ) {}

  async collectDeletedFileContent(
    command: CollectDeletedFileContentCommand,
  ): Promise<FileCollectionResult> {
    return this.operation("collect_deleted_file_content", async () => {
      const now = this.deps.clock.now();
      const claimToken = fileGarbageCollectionClaimToken(command.claimToken);
      const claim = await this.deps.garbageCollectionTransaction.transaction(
        async (repository) => {
          const file = await repository.findFileByIdForUpdate(
            toFileId(command.fileId),
          );
          if (!file) return { status: "not_found" } as const;
          const protectedReferences =
            await repository.countProtectedFileReferences(file.id);
          const eligibility = evaluateFileGarbageCollection({
            file,
            now,
            protectedReferences,
          });
          if (!eligibility.eligible) {
            return { eligibility, status: "skipped" } as const;
          }
          const activeClaimCutoff = new Date(now.getTime() - 15 * 60 * 1000);
          if (
            file.gcClaimToken &&
            file.gcClaimToken !== claimToken &&
            file.gcClaimedAt &&
            file.gcClaimedAt > activeClaimCutoff
          ) {
            return { status: "claimed_by_another_collector" } as const;
          }
          const claimed = claimFileGarbageCollection(file, claimToken, now);
          const persisted = await repository.updateFile(claimed);
          return persisted
            ? ({ file: persisted, status: "claimed" } as const)
            : ({ status: "not_found" } as const);
        },
      );
      if (claim.status !== "claimed") return claim;

      await this.deps.fileStorage.deleteObject({
        bucket: claim.file.bucket,
        key: claim.file.objectKey,
      });

      const finalized =
        await this.deps.filesRepository.updateFileForGarbageCollection({
          claimToken,
          file: markFileDeleted(claim.file, this.deps.clock.now()),
        });
      return finalized
        ? { status: "collected" }
        : { status: "finalize_pending" };
    });
  }

  async handleFileUploadExpiration(
    command: HandleFileUploadExpirationCommand,
  ): Promise<void> {
    await this.operation("handle_file_upload_expiration", async () => {
      const upload = await this.deps.filesRepository.findFileUploadById(
        toFileUploadId(command.uploadId),
      );
      if (upload?.status !== "initiated") {
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

export type FileCollectionResult =
  | { status: "collected" | "finalize_pending" | "not_found" }
  | { status: "claimed_by_another_collector" }
  | { status: "skipped"; eligibility: FileGarbageCollectionEligibility };
