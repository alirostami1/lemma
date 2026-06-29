import { Badge } from "@lemma/ui/components/badge";
import { Button } from "@lemma/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@lemma/ui/components/dialog";
import { cn } from "@lemma/ui/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  LoaderCircle,
} from "lucide-react";
import { useRef, useState } from "react";
import { parseLocalWorkbookFile } from "#/domains/workbooks/local-xlsx";
import type { StudioWorkbookSource } from "./studio-source-model";

type SourceProviderDefinition = {
  kind: "workbook";
  label: string;
  description: string;
  acceptedFileTypes: readonly string[];
};

const WORKBOOK_PROVIDER: SourceProviderDefinition = {
  acceptedFileTypes: [".xlsx"],
  description:
    "Use an .xlsx file. Cached workbook values are read in your browser.",
  kind: "workbook",
  label: "Workbook file",
};

export function StudioSourcePickerDialog({
  open,
  existingSources,
  onOpenChange,
  onCreateSource,
}: {
  open: boolean;
  existingSources: readonly StudioWorkbookSource[];
  onOpenChange(open: boolean): void;
  onCreateSource(source: StudioWorkbookSource): void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chosenSource, setChosenSource] = useState<StudioWorkbookSource | null>(
    null,
  );
  const [status, setStatus] = useState<
    "idle" | "parsing" | "parsed" | "failed" | "duplicate"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function reset(nextOpen: boolean) {
    if (!nextOpen) {
      setChosenSource(null);
      setStatus("idle");
      setErrorMessage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }

    onOpenChange(nextOpen);
  }

  async function handleFile(file: File | null) {
    if (!file) {
      return;
    }

    setStatus("parsing");
    setErrorMessage(null);

    const outcome = await onCreateLocalWorkbookSource({
      existingSources,
      file,
    });

    if (outcome.status === "duplicate") {
      setChosenSource(null);
      setStatus("duplicate");
      setErrorMessage("This file is already attached.");
      return;
    }

    if (outcome.status === "failed") {
      setChosenSource(outcome.source);
      setStatus("failed");
      setErrorMessage(
        outcome.source.backing.kind === "local_file"
          ? (outcome.source.backing.parseError?.message ??
              "Workbook could not be parsed.")
          : "Workbook could not be parsed.",
      );
      return;
    }

    setChosenSource(outcome.source);
    setStatus("parsed");
  }

  return (
    <Dialog onOpenChange={reset} open={open}>
      <DialogContent
        className="sm:max-w-lg"
        data-reference-source-dialog="true"
      >
        <div className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Upload a new file</DialogTitle>
            <DialogDescription>
              Add a workbook to this blueprint. It stays local until you save.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-background p-2">
                <FileSpreadsheet className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{WORKBOOK_PROVIDER.label}</p>
                <p className="text-sm text-muted-foreground">
                  {WORKBOOK_PROVIDER.description}
                </p>
              </div>
            </div>
          </div>

          <button
            className={cn(
              "grid gap-2 rounded-xl border border-dashed px-4 py-8 text-center",
              "hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              void handleFile(event.dataTransfer.files[0] ?? null);
            }}
            type="button"
          >
            <FileUp className="mx-auto size-6 text-muted-foreground" />
            <span className="text-sm font-medium">
              Drag a workbook here or browse
            </span>
            <span className="text-xs text-muted-foreground">Accepts .xlsx</span>
          </button>

          <input
            accept={WORKBOOK_PROVIDER.acceptedFileTypes.join(",")}
            aria-label="Choose workbook file"
            className="hidden"
            onChange={(event) => {
              void handleFile(event.currentTarget.files?.[0] ?? null);
            }}
            ref={fileInputRef}
            type="file"
          />

          {status === "parsing" ? (
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <LoaderCircle className="size-4 animate-spin" />
              Parsing workbook...
            </div>
          ) : null}

          {chosenSource ? (
            <ParsedWorkbookSummary source={chosenSource} status={status} />
          ) : null}

          {errorMessage ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => reset(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={status !== "parsed" || chosenSource === null}
              onClick={() => {
                if (!chosenSource) {
                  return;
                }
                onCreateSource(chosenSource);
                reset(false);
              }}
              type="button"
            >
              Add workbook
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ParsedWorkbookSummary({
  source,
  status,
}: {
  source: StudioWorkbookSource;
  status: "idle" | "parsing" | "parsed" | "failed" | "duplicate";
}) {
  const parsedWorkbook =
    source.backing.kind === "local_file" ? source.backing.parsedWorkbook : null;

  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{source.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {source.backing.originalName}
          </p>
        </div>

        {status === "parsed" ? (
          <Badge className="gap-1" variant="secondary">
            <CheckCircle2 className="size-3" />
            Parsed
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">
          {parsedWorkbook?.sheetCount ?? 0} sheets
        </Badge>
        <Badge variant="outline">
          {formatBytes(source.backing.byteSize ?? 0)}
        </Badge>
      </div>
    </div>
  );
}

function formatBytes(byteSize: number): string {
  if (byteSize < 1024) {
    return `${byteSize} B`;
  }

  if (byteSize < 1024 * 1024) {
    return `${(byteSize / 1024).toFixed(1)} KB`;
  }

  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}

async function onCreateLocalWorkbookSource(input: {
  file: File;
  existingSources: readonly StudioWorkbookSource[];
}): Promise<
  | { status: "parsed"; source: StudioWorkbookSource }
  | { status: "failed"; source: StudioWorkbookSource }
  | { status: "duplicate" }
> {
  const { createLocalWorkbookSourceDraft } = await import(
    "./studio-source-utils"
  );
  const draft = createLocalWorkbookSourceDraft(input);
  if (draft.status === "duplicate") {
    return { status: "duplicate" };
  }
  const parseOutcome = await parseLocalWorkbookFile(input.file);
  const localBacking =
    draft.source.backing.kind === "local_file" ? draft.source.backing : null;

  if (!localBacking) {
    return {
      source: draft.source,
      status: "failed",
    };
  }

  if (parseOutcome.status === "failed") {
    return {
      source: {
        ...draft.source,
        backing: {
          ...localBacking,
          parseError: parseOutcome.error,
          parseStatus: "failed",
        },
      },
      status: "failed",
    };
  }

  return {
    source: {
      ...draft.source,
      backing: {
        ...localBacking,
        parsedWorkbook: parseOutcome.workbook,
        parseError: null,
        parseStatus: "parsed",
      },
    },
    status: "parsed",
  };
}
