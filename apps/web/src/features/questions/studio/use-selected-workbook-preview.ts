import { useEffect, useRef, useState } from "react";
import { useCreateFileDownloadUrl } from "#/domains/files/hooks";
import {
  parseWorkbookPreview,
  type WorkbookPreview,
} from "#/domains/questions/workbook-preview";

export type SelectedWorkbookPreviewController = {
  workbookFile: File | null;
  workbookPreview: WorkbookPreview | null;
  workbookPreviewError: string | null;
  isWorkbookPreviewPending: boolean;
  previewStatus: "idle" | "loading" | "ready" | "error";
};

export function useSelectedWorkbookPreview({
  selectedWorkbook,
}: {
  selectedWorkbook: {
    fileId: string;
    originalName: string;
    status: string;
  } | null;
}): SelectedWorkbookPreviewController {
  const {
    mutateAsync: createDownloadUrl,
    isPending: isWorkbookPreviewPending,
  } = useCreateFileDownloadUrl();
  const createDownloadUrlRef = useRef(createDownloadUrl);
  const loadedFileKeyRef = useRef<string | null>(null);
  const [workbookFile, setWorkbookFile] = useState<File | null>(null);
  const [workbookPreview, setWorkbookPreview] =
    useState<WorkbookPreview | null>(null);
  const [workbookPreviewError, setWorkbookPreviewError] = useState<
    string | null
  >(null);
  const [previewStatus, setPreviewStatus] =
    useState<SelectedWorkbookPreviewController["previewStatus"]>("idle");

  useEffect(() => {
    createDownloadUrlRef.current = createDownloadUrl;
  }, [createDownloadUrl]);

  const selectedFileId = selectedWorkbook?.fileId ?? "";
  const selectedOriginalName = selectedWorkbook?.originalName ?? "";
  const selectedStatus = selectedWorkbook?.status ?? "";
  const selectedFileKey = selectedFileId
    ? `${selectedFileId}:${selectedOriginalName}:${selectedStatus}`
    : "";

  useEffect(() => {
    let cancelled = false;

    async function loadWorkbookFile() {
      if (!selectedFileId) {
        loadedFileKeyRef.current = null;
        setWorkbookFile(null);
        setWorkbookPreview(null);
        setWorkbookPreviewError(null);
        setPreviewStatus("idle");
        return;
      }

      if (loadedFileKeyRef.current === selectedFileKey) {
        return;
      }

      loadedFileKeyRef.current = selectedFileKey;
      setWorkbookFile(null);
      setWorkbookPreview(null);
      setWorkbookPreviewError(null);
      setPreviewStatus("loading");

      if (selectedStatus !== "valid") {
        setWorkbookPreviewError("Source is not ready.");
        setPreviewStatus("error");
        return;
      }

      try {
        const download = await createDownloadUrlRef.current({
          fileId: selectedFileId,
        });

        if (cancelled) {
          return;
        }

        const response = await fetch(download.url, {
          method: download.method,
        });

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setWorkbookPreviewError("Source file download failed.");
          setPreviewStatus("error");
          return;
        }

        const file = new File([await response.blob()], selectedOriginalName, {
          type: selectedOriginalName.endsWith(".xlsm")
            ? "application/vnd.ms-excel.sheet.macroEnabled.12"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const preview = await parseWorkbookPreview(file);

        if (!cancelled) {
          setWorkbookFile(file);
          setWorkbookPreview(preview);
          setWorkbookPreviewError(null);
          setPreviewStatus("ready");
        }
      } catch {
        if (!cancelled) {
          loadedFileKeyRef.current = null;
          setWorkbookFile(null);
          setWorkbookPreview(null);
          setWorkbookPreviewError("Source preview could not be loaded.");
          setPreviewStatus("error");
        }
      }
    }

    void loadWorkbookFile();

    return () => {
      cancelled = true;
    };
  }, [selectedFileId, selectedFileKey, selectedOriginalName, selectedStatus]);

  return {
    workbookFile,
    workbookPreview,
    workbookPreviewError,
    isWorkbookPreviewPending,
    previewStatus,
  };
}
