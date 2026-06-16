import { DomainError } from "@lemma/error";
import {
  ForbiddenWorkbookActionError,
  WorkbookFileNotFoundError,
  WorkbookFileProviderFailureError,
  WorkbookFileUnavailableError,
} from "./errors.js";
import type {
  WorkbookFileContent,
  WorkbookFileMetadata,
  WorkbookFileProviderPort,
} from "./ports.js";

export function mapWorkbookFileProviderErrors(
  provider: WorkbookFileProviderPort,
): WorkbookFileProviderPort {
  return {
    getWorkbookFileMetadata: (input) =>
      mapWorkbookFileResult(() => provider.getWorkbookFileMetadata(input)),
    getWorkbookFileMetadataForOwnerUserId: (input) =>
      mapWorkbookFileResult(() =>
        provider.getWorkbookFileMetadataForOwnerUserId(input),
      ),
    readWorkbookFileContent: (input) =>
      mapWorkbookFileResult(() => provider.readWorkbookFileContent(input)),
    readWorkbookFileContentForOwnerUserId: (input) =>
      mapWorkbookFileResult(() =>
        provider.readWorkbookFileContentForOwnerUserId(input),
      ),
  };
}

async function mapWorkbookFileResult<
  T extends WorkbookFileMetadata | WorkbookFileContent,
>(loadFile: () => Promise<T>): Promise<T> {
  try {
    return await loadFile();
  } catch (error) {
    if (hasDomainCode(error, "FILE_NOT_FOUND")) {
      throw new WorkbookFileNotFoundError();
    }
    if (hasDomainCode(error, "FORBIDDEN_FILE_ACTION")) {
      throw new ForbiddenWorkbookActionError(
        "You cannot use this workbook file.",
      );
    }
    if (
      hasDomainCode(error, "FILE_NOT_VISIBLE") ||
      hasDomainCode(error, "INVALID_FILE_STATE")
    ) {
      throw new WorkbookFileUnavailableError("Workbook file is unavailable.", {
        cause: error,
      });
    }
    throw new WorkbookFileProviderFailureError(
      "Workbook file provider failed.",
      {
        cause: error,
      },
    );
  }
}

function hasDomainCode(error: unknown, code: string): boolean {
  return error instanceof DomainError && error.domainCode === code;
}
