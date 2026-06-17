import { useMemo, useState } from "react";
import { computeFileSha256Hex } from "#/domains/files/checksum";
import {
  useCompleteFileUpload,
  useCreateFileUpload,
} from "#/domains/files/hooks";
import {
  type FileValidationResult,
  validateWorkbookUploadFile,
} from "#/domains/files/upload-validation";
import { useCreateWorkbook } from "#/domains/workbooks/hooks";
import type { Workbook } from "#/domains/workbooks/model";
import {
  buildWorkbookUploadViewModel,
  type WorkbookUploadStatus,
  type WorkbookUploadViewModel,
} from "./workbook-upload-view-model";

type UseWorkbookUploadControllerInput = {
  cancelLabel?: string;
  onCreated?(workbook: Workbook): void | Promise<void>;
  submitLabel?: string;
};

export type WorkbookUploadController = {
  hasSubmitted: boolean;
  name: string;
  onFileChange(file: File | null): { accepted: boolean };
  onNameChange(name: string): void;
  onSubmit(): Promise<void>;
  selectedFile: File | null;
  viewModel: WorkbookUploadViewModel;
};

const WORKBOOK_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function useWorkbookUploadController({
  cancelLabel = "Cancel",
  onCreated,
  submitLabel = "Create source",
}: UseWorkbookUploadControllerInput): WorkbookUploadController {
  const createFileUpload = useCreateFileUpload();
  const completeFileUpload = useCompleteFileUpload();
  const createWorkbook = useCreateWorkbook();
  const [name, setName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<WorkbookUploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const fileValidation = useMemo<FileValidationResult>(
    () => validateWorkbookUploadFile(selectedFile),
    [selectedFile],
  );

  const viewModel = useMemo(
    () =>
      buildWorkbookUploadViewModel({
        cancelLabel,
        errorMessage,
        fileValidation,
        hasSubmitted,
        name,
        selectedFile,
        status,
        submitLabel,
      }),
    [
      cancelLabel,
      errorMessage,
      fileValidation,
      hasSubmitted,
      name,
      selectedFile,
      status,
      submitLabel,
    ],
  );

  return {
    hasSubmitted,
    name,
    selectedFile,
    viewModel,
    onNameChange: (nextName) => {
      setName(nextName);
      setErrorMessage(null);
      setStatus("idle");
    },
    onFileChange: (file) => {
      const validation = validateWorkbookUploadFile(file);
      setErrorMessage(
        validation.status === "invalid"
          ? (validation.issues[0]?.message ?? null)
          : null,
      );
      setSelectedFile(validation.status === "valid" ? file : null);
      setStatus("idle");
      if (file && validation.status === "valid" && name.trim().length === 0) {
        setName(stripWorkbookExtension(file.name));
      }
      return {
        accepted: validation.status === "valid",
      };
    },
    onSubmit: async () => {
      setHasSubmitted(true);
      const validation = validateWorkbookUploadFile(selectedFile);
      if (validation.status === "invalid") {
        setErrorMessage(
          validation.issues[0]?.message ?? "Select an .xlsx workbook file.",
        );
        setStatus("failed");
        return;
      }

      const trimmedName = name.trim();
      if (trimmedName.length === 0) {
        setErrorMessage("Name is required.");
        setStatus("failed");
        return;
      }

      const file = selectedFile;
      if (!file) {
        setErrorMessage("Select an .xlsx workbook file.");
        setStatus("failed");
        return;
      }

      setErrorMessage(null);

      try {
        setStatus("hashing");
        const checksumSha256 = await computeFileSha256Hex(file);

        setStatus("uploading");
        const { upload, uploadUrl } = await createFileUpload.mutateAsync({
          byteSize: file.size,
          checksumSha256,
          contentType: WORKBOOK_CONTENT_TYPE,
          originalName: file.name,
          purpose: "workbook",
        });

        const storageResponse = await fetch(uploadUrl.url, {
          method: uploadUrl.method,
          headers: uploadUrl.headers,
          body: file,
        });

        if (!storageResponse.ok) {
          throw new Error("Source file upload failed.");
        }

        const completedFile = await completeFileUpload.mutateAsync({
          uploadId: upload.id,
        });

        setStatus("creating_source");
        const workbook = await createWorkbook.mutateAsync({
          name: trimmedName,
          fileId: completedFile.id,
        });

        await onCreated?.(workbook);
        setHasSubmitted(false);
        setName("");
        setSelectedFile(null);
        setErrorMessage(null);
        setStatus("idle");
      } catch (error) {
        setErrorMessage(
          error instanceof Error && error.message.length > 0
            ? error.message
            : "Source could not be uploaded.",
        );
        setStatus("failed");
      }
    },
  };
}

export function stripWorkbookExtension(fileName: string) {
  return fileName.replace(/\.xlsx$/iu, "");
}
