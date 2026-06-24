import { useMemo, useState } from "react";
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
import { uploadWorkbookFileRuntime } from "#/domains/workbooks/upload-runtime";
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
    onNameChange: (nextName) => {
      setName(nextName);
      setErrorMessage(null);
      setStatus("idle");
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
        setStatus("uploading");
        const workbook = await uploadWorkbookFileRuntime({
          completeFileUpload: (args) => completeFileUpload.mutateAsync(args),
          createFileUpload: async (args) => {
            setStatus("hashing");
            return createFileUpload.mutateAsync(args);
          },
          createWorkbook: async (args) => {
            setStatus("creating_source");
            return createWorkbook.mutateAsync(args);
          },
          file,
          name: trimmedName,
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
    selectedFile,
    viewModel,
  };
}

export function stripWorkbookExtension(fileName: string) {
  return fileName.replace(/\.xlsx$/iu, "");
}
