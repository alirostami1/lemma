import { Button } from "@lemma/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@lemma/ui/components/popover";
import { cn } from "@lemma/ui/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CloudUpload,
  Database,
  FileSpreadsheet,
  Info,
  Lock,
  Plus,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import {
  getStudioSourceDisplayName,
  getStudioSourceTypeLabel,
} from "./source-types";
import type { StudioSourceUsageSummary } from "./source-usage";
import type { StudioSource } from "./studio-source-model";
import type { StudioSourceOperationResult } from "./use-source-controller";

export type StudioSourceListProps = {
  sources: readonly StudioSource[];
  usageBySourceId: ReadonlyMap<string, StudioSourceUsageSummary>;
  isExpanded: boolean;
  disabled?: boolean;
  onExpandedChange(expanded: boolean): void;
  onAddSource(): void;
  onReattachSource(
    sourceId: string,
    file: File,
  ): Promise<StudioSourceOperationResult>;
  onRemoveSource(sourceId: string): void;
};

export function StudioSourceList({
  sources,
  usageBySourceId,
  isExpanded,
  disabled = false,
  onExpandedChange,
  onAddSource,
  onReattachSource,
  onRemoveSource,
}: StudioSourceListProps) {
  const attachedCount = sources.length;
  const usedCount = [...usageBySourceId.values()].filter(
    (usage) => usage.isUsed,
  ).length;
  const localCount = sources.filter(
    (source) => source.backing.kind === "local_file",
  ).length;
  const errorCount = sources.filter(hasSourceIssue).length;
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

  return (
    <section
      aria-label="Blueprint sources"
      className="rounded-lg border bg-card/70"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          aria-expanded={isExpanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => onExpandedChange(!isExpanded)}
          type="button"
        >
          <Database className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Sources</span>
          <span className="text-sm text-muted-foreground">
            {attachedCount} attached
          </span>
          <span className="text-sm text-muted-foreground">
            {usedCount} used
          </span>
          {localCount > 0 ? (
            <span className="text-sm text-muted-foreground">
              {localCount} local
            </span>
          ) : null}
          {errorCount > 0 ? (
            <span className="text-sm text-destructive">{errorCount} issue</span>
          ) : null}
          <ChevronIcon className="ml-auto size-4 text-muted-foreground" />
        </button>
        <Button
          disabled={disabled}
          onClick={onAddSource}
          size="sm"
          type="button"
        >
          <Plus />
          Add source
        </Button>
      </div>

      {isExpanded ? (
        <div className="border-t px-2 py-2">
          {sources.length === 0 ? (
            <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
              No sources attached.
            </div>
          ) : (
            <div className="grid gap-1">
              {sources.map((source) => {
                const usage = usageBySourceId.get(source.sourceId) ?? {
                  isUsed: false,
                  referenceCount: 0,
                  removal: { removable: true } as const,
                  sourceId: source.sourceId,
                  usedWhere: [],
                };
                const status = getSourceRowStatus(source, usage);
                const StatusIcon = status.icon;
                const sheetCount =
                  "parsedWorkbook" in source.backing
                    ? (source.backing.parsedWorkbook?.sheetCount ?? null)
                    : null;

                return (
                  <div
                    className={cn(
                      "grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md px-2 py-2",
                      "hover:bg-muted/40",
                    )}
                    key={source.sourceId}
                  >
                    <FileSpreadsheet className="size-4 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {getStudioSourceDisplayName(source)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {getSourceSecondaryText(
                          source,
                          usage.referenceCount,
                          sheetCount,
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <StatusIcon className="size-3.5" />
                      <span>{status.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            aria-label={`Source details for ${getStudioSourceDisplayName(source)}`}
                            size="icon-xs"
                            type="button"
                            variant="ghost"
                          >
                            <Info />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-[24rem]">
                          <SourceDetails
                            onReattachSource={onReattachSource}
                            source={source}
                            usage={usage}
                          />
                        </PopoverContent>
                      </Popover>
                      <Button
                        aria-label={`Remove ${getStudioSourceDisplayName(source)}`}
                        disabled={disabled || !usage.removal.removable}
                        onClick={() => onRemoveSource(source.sourceId)}
                        size="icon-xs"
                        title={
                          usage.removal.removable
                            ? "Remove source"
                            : usage.removal.reason
                        }
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function SourceDetails({
  source,
  usage,
  onReattachSource,
}: {
  source: StudioSource;
  usage: StudioSourceUsageSummary;
  onReattachSource(
    sourceId: string,
    file: File,
  ): Promise<StudioSourceOperationResult>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reattachError, setReattachError] = useState<string | null>(null);
  const parsedWorkbook =
    "parsedWorkbook" in source.backing ? source.backing.parsedWorkbook : null;
  const shownLocations = usage.usedWhere.slice(0, 5);

  return (
    <div className="grid gap-3 text-sm">
      <div>
        <p className="font-medium">{getStudioSourceDisplayName(source)}</p>
        <p className="text-xs text-muted-foreground">
          {getStudioSourceTypeLabel(source)}
        </p>
      </div>

      <div className="grid gap-1 text-xs text-muted-foreground">
        <p>Status: {getDetailsStatusText(source, usage.isUsed)}</p>
        <p>File: {source.backing.originalName}</p>
        <p>Sheets: {parsedWorkbook?.sheetCount ?? "Unknown"}</p>
        <p>Size: {formatBytes(source.backing.byteSize)}</p>
        {source.backing.kind === "missing_local_file" ? (
          <p>{source.backing.parseError}</p>
        ) : null}
        {source.backing.kind === "restoring_local_file" ? (
          <p>Loading draft file...</p>
        ) : null}
      </div>

      {source.backing.kind === "missing_local_file" ? (
        <div className="grid gap-2">
          <input
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            aria-label={`Reattach file for ${getStudioSourceDisplayName(source)}`}
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null;
              event.currentTarget.value = "";
              if (!file) {
                return;
              }
              void onReattachSource(source.sourceId, file).then((result) => {
                if (result.status === "blocked") {
                  setReattachError(result.reason);
                  return;
                }
                setReattachError(null);
              });
            }}
            ref={fileInputRef}
            type="file"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            size="sm"
            type="button"
            variant="outline"
          >
            Reattach file
          </Button>
          {reattachError ? (
            <p className="text-xs text-destructive">{reattachError}</p>
          ) : null}
        </div>
      ) : null}

      {usage.isUsed ? (
        <div className="grid gap-1 text-xs">
          <p className="font-medium">Usage</p>
          {shownLocations.map((location) => (
            <p key={`${location.referenceId}:${location.label}`}>
              {location.label} · {location.referenceName}
            </p>
          ))}
          {usage.usedWhere.length > shownLocations.length ? (
            <p className="text-muted-foreground">
              + {usage.usedWhere.length - shownLocations.length} more
            </p>
          ) : null}
          <p className="text-muted-foreground">
            This source is used by blueprint and cannot be removed.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          This source is not referenced yet. It will not be uploaded when you
          save.
        </p>
      )}
    </div>
  );
}

function getSourceSecondaryText(
  source: StudioSource,
  referenceCount: number,
  sheetCount: number | null,
): string {
  const parts = [getStudioSourceTypeLabel(source)];

  if (sheetCount !== null) {
    parts.push(`${sheetCount} sheets`);
  } else if (source.backing.kind === "local_file") {
    parts.push("local");
  } else if (source.backing.kind === "missing_local_file") {
    parts.push("missing file");
  } else if (source.backing.kind === "restoring_local_file") {
    parts.push("restoring");
  } else if (source.backing.kind === "draft_file") {
    parts.push("saved in draft");
  } else {
    parts.push("saved");
  }

  parts.push(referenceCount > 0 ? `${referenceCount} refs` : "not used");

  return parts.join(" · ");
}

function getSourceRowStatus(
  source: StudioSource,
  usage: StudioSourceUsageSummary,
) {
  if (
    source.backing.kind === "local_file" &&
    source.backing.parseStatus === "failed"
  ) {
    return { icon: AlertTriangle, label: "error" };
  }

  if (source.backing.kind === "missing_local_file") {
    return { icon: AlertTriangle, label: "missing file" };
  }

  if (source.backing.kind === "restoring_local_file") {
    return { icon: FileSpreadsheet, label: "restoring" };
  }
  if (source.backing.kind === "draft_file") {
    return source.backing.previewStatus === "failed"
      ? { icon: AlertTriangle, label: "preview error" }
      : { icon: CheckCircle2, label: "saved in draft" };
  }

  if (usage.isUsed) {
    if (source.backing.kind === "local_file") {
      return { icon: CloudUpload, label: "uploads on save" };
    }

    return { icon: Lock, label: "used" };
  }

  if (source.backing.kind === "local_file") {
    return { icon: CloudUpload, label: "local" };
  }

  return { icon: CheckCircle2, label: "saved" };
}

function getDetailsStatusText(source: StudioSource, isUsed: boolean): string {
  if (source.backing.kind === "local_file") {
    return isUsed ? "Local · used · uploads on save" : "Local · unused";
  }

  if (source.backing.kind === "missing_local_file") {
    return isUsed ? "Missing local file · used" : "Missing local file · unused";
  }

  if (source.backing.kind === "restoring_local_file") {
    return isUsed ? "Restoring local file · used" : "Restoring local file";
  }
  if (source.backing.kind === "draft_file") {
    return isUsed ? "Saved in draft · used" : "Saved in draft · unused";
  }

  return isUsed ? "Saved · used" : "Saved · unused";
}

function hasSourceIssue(source: StudioSource): boolean {
  return (
    source.backing.kind === "missing_local_file" ||
    (source.backing.kind === "draft_file" &&
      source.backing.previewStatus === "failed") ||
    (source.backing.kind === "local_file" &&
      source.backing.parseStatus === "failed")
  );
}

function formatBytes(byteSize: number | null): string {
  if (byteSize === null) {
    return "Unknown";
  }

  if (byteSize < 1024) {
    return `${byteSize} B`;
  }

  if (byteSize < 1024 * 1024) {
    return `${Math.round(byteSize / 102.4) / 10} KB`;
  }

  return `${Math.round(byteSize / 104857.6) / 10} MB`;
}
