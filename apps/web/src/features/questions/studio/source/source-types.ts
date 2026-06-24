import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  FileSpreadsheet,
  Lock,
} from "lucide-react";
import type { StudioSource } from "./studio-source-model";

export function getStudioSourceDisplayName(source: StudioSource): string {
  return source.name.trim().length > 0 ? source.name : "Workbook source";
}

export function getStudioSourceTypeLabel(source: StudioSource): string {
  if (source.type === "workbook") {
    return "Workbook";
  }

  throw new Error(`Unknown source type: ${JSON.stringify(source)}`);
}

export function getStudioSourceStableKey(source: StudioSource): string {
  return source.sourceId;
}

export function getStudioSourcePrimaryStatus(input: {
  source: StudioSource;
  isUsed: boolean;
}): {
  label: string;
  icon: LucideIcon;
  tone: "default" | "secondary" | "outline";
} {
  const { source, isUsed } = input;

  if (source.backing.kind === "local_file") {
    if (source.backing.parseStatus === "failed") {
      return {
        icon: AlertTriangle,
        label: "Needs attention",
        tone: "secondary",
      };
    }

    if (isUsed) {
      return {
        icon: CloudUpload,
        label: "Will upload on save",
        tone: "default",
      };
    }

    return {
      icon: FileSpreadsheet,
      label: "Local · not saved",
      tone: "outline",
    };
  }

  if (source.backing.kind === "missing_local_file") {
    return {
      icon: AlertTriangle,
      label: "Missing file",
      tone: "secondary",
    };
  }

  if (source.backing.kind === "draft_file") {
    return {
      icon:
        source.backing.previewStatus === "failed"
          ? AlertTriangle
          : CheckCircle2,
      label:
        source.backing.previewStatus === "failed"
          ? "Saved in draft · preview error"
          : "Saved in draft",
      tone: "outline",
    };
  }

  if (source.backing.kind === "restoring_local_file") {
    return {
      icon: FileSpreadsheet,
      label: "Restoring",
      tone: "outline",
    };
  }

  if (isUsed) {
    return {
      icon: Lock,
      label: "Used",
      tone: "secondary",
    };
  }

  return {
    icon: CheckCircle2,
    label: "Saved",
    tone: "outline",
  };
}
