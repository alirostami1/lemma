import {
  FileAliasUnavailableError,
  FileNotFoundError,
  FileNotVisibleError,
  ForbiddenFileActionError,
} from "@lemma/files/domain";

export function isExpectedDraftSourceFileUnavailableError(
  error: unknown,
): boolean {
  return (
    error instanceof FileNotFoundError ||
    error instanceof FileNotVisibleError ||
    error instanceof FileAliasUnavailableError ||
    error instanceof ForbiddenFileActionError
  );
}
