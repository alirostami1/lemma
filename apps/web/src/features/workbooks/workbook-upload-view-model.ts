import type { FileValidationResult } from "#/domains/files/upload-validation";

export type WorkbookUploadViewModel = {
  selectedFileLabel: string | null;
  submitLabel: string;
  cancelLabel: string;
  isSubmitDisabled: boolean;
  isFileSelectDisabled: boolean;
  isCancelDisabled: boolean;
  errorMessage: string | null;
  helperText: string | null;
  nameError: string | null;
};

export type WorkbookUploadStatus =
  | "idle"
  | "hashing"
  | "uploading"
  | "creating_source"
  | "succeeded"
  | "failed";

export function buildWorkbookUploadViewModel(input: {
  cancelLabel: string;
  errorMessage: string | null;
  fileValidation: FileValidationResult;
  hasSubmitted: boolean;
  name: string;
  selectedFile: File | null;
  status: WorkbookUploadStatus;
  submitLabel: string;
}): WorkbookUploadViewModel {
  return {
    cancelLabel: input.cancelLabel,
    errorMessage: input.errorMessage,
    helperText: input.selectedFile
      ? `Selected ${formatWorkbookBytes(input.selectedFile.size)}`
      : null,
    isCancelDisabled: isPending(input.status),
    isFileSelectDisabled: isPending(input.status),
    isSubmitDisabled:
      isPending(input.status) ||
      input.fileValidation.status === "invalid" ||
      input.name.trim().length === 0,
    nameError:
      input.name.trim().length === 0 &&
      (input.hasSubmitted || input.errorMessage === "Name is required.")
        ? "Name is required."
        : null,
    selectedFileLabel: input.selectedFile?.name ?? null,
    submitLabel: getSubmitLabel(input.status, input.submitLabel),
  };
}

function getSubmitLabel(
  status: WorkbookUploadStatus,
  defaultLabel: string,
): string {
  switch (status) {
    case "hashing":
      return "Preparing upload...";
    case "uploading":
      return "Uploading source...";
    case "creating_source":
      return "Creating source...";
    default:
      return defaultLabel;
  }
}

function isPending(status: WorkbookUploadStatus) {
  return (
    status === "hashing" ||
    status === "uploading" ||
    status === "creating_source"
  );
}

export function formatWorkbookBytes(byteSize: number) {
  if (byteSize < 1024) {
    return `${byteSize} B`;
  }
  if (byteSize < 1024 * 1024) {
    return `${(byteSize / 1024).toFixed(1)} KB`;
  }
  return `${(byteSize / 1024 / 1024).toFixed(1)} MB`;
}
