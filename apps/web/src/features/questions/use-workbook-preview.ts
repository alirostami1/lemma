import { useEffect, useState } from "react";
import {
  parseWorkbookPreview,
  type WorkbookPreview,
} from "#/domains/questions/workbook-preview";

export type WorkbookPreviewStatus = "idle" | "loading" | "error";

export function useWorkbookPreview(file: File | null, open: boolean) {
  const [workbook, setWorkbook] = useState<WorkbookPreview | null>(null);
  const [status, setStatus] = useState<WorkbookPreviewStatus>("idle");

  useEffect(() => {
    if (!open || !file) {
      setWorkbook(null);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    const selectedFile = file;

    async function loadWorkbook() {
      setStatus("loading");
      try {
        const parsed = await parseWorkbookPreview(selectedFile);

        if (cancelled) {
          return;
        }

        setWorkbook(parsed);
        setStatus("idle");
      } catch {
        if (cancelled) {
          return;
        }

        setWorkbook(null);
        setStatus("error");
      }
    }

    void loadWorkbook();

    return () => {
      cancelled = true;
    };
  }, [file, open]);

  return { workbook, status };
}
