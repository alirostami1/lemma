import type { FileContentType } from "./model";

export type FileValidationIssue =
  | {
      code: "missing_file";
      message: string;
    }
  | {
      code: "unsupported_content_type";
      message: string;
    }
  | {
      code: "empty_file";
      message: string;
    };

export type FileValidationResult =
  | {
      status: "valid";
    }
  | {
      status: "invalid";
      issues: FileValidationIssue[];
    };

const WORKBOOK_CONTENT_TYPES: FileContentType[] = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const WORKBOOK_FALLBACK_CONTENT_TYPES = [
  "application/octet-stream",
  "application/zip",
];

export function validateWorkbookUploadFile(
  file: File | null,
): FileValidationResult {
  if (!file) {
    return invalid({
      code: "missing_file",
      message: "Select an .xlsx workbook file.",
    });
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return invalid({
      code: "unsupported_content_type",
      message: "Select a file with an .xlsx filename.",
    });
  }

  if (file.size === 0) {
    return invalid({
      code: "empty_file",
      message: "Select a non-empty .xlsx workbook.",
    });
  }

  if (
    file.type &&
    !isWorkbookContentType(file.type) &&
    !WORKBOOK_FALLBACK_CONTENT_TYPES.includes(file.type.toLowerCase())
  ) {
    return invalid({
      code: "unsupported_content_type",
      message: "Selected file type does not look like an .xlsx workbook.",
    });
  }

  return { status: "valid" };
}

export function isWorkbookContentType(
  contentType: string,
): contentType is FileContentType {
  return WORKBOOK_CONTENT_TYPES.includes(
    contentType.toLowerCase() as FileContentType,
  );
}

function invalid(issue: FileValidationIssue): FileValidationResult {
  return {
    issues: [issue],
    status: "invalid",
  };
}
