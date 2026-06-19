import type { BlueprintSourceRequirement } from "#/domains/questions/source-requirements";
import type { Workbook } from "#/domains/workbooks/model";
import { getWorkbookSourceStatus } from "#/domains/workbooks/source-status";
import type { StudioSourceSessionSource } from "./source-session-registry";

type StudioSourceViewStateBase = {
  sources?: StudioSourceSessionSource[];
  activeSourceId?: string | null;
  onActivateSourceId?(sourceId: string): void;
};

export type StudioSourceViewState =
  | (StudioSourceViewStateBase & {
      status: "not_required_empty";
      title: string;
      description: string;
      canRemove: false;
    })
  | (StudioSourceViewStateBase & {
      status: "required_missing";
      title: string;
      description: string;
      issue: string;
      canRemove: false;
    })
  | (StudioSourceViewStateBase & {
      status: "loading";
      title: string;
      description: string;
      canRemove: true;
    })
  | (StudioSourceViewStateBase & {
      status: "ready";
      title: string;
      description: string;
      canRemove: true;
    })
  | (StudioSourceViewStateBase & {
      status: "invalid";
      title: string;
      description: string;
      issue: string;
      canRemove: true;
    })
  | (StudioSourceViewStateBase & {
      status: "error";
      title: string;
      description: string;
      issue: string;
      canRemove: true;
    });

export function getStudioSourceViewState(input: {
  sourceRequirement: BlueprintSourceRequirement;
  selectedWorkbookId: string | null;
  selectedWorkbook: Workbook | null;
  isWorkbooksLoading: boolean;
  previewStatus: "idle" | "loading" | "ready" | "error";
  previewError: string | null;
  isVersionBoundSource?: boolean;
}): StudioSourceViewState {
  const requiresSource = input.sourceRequirement.status === "required";

  if (!input.selectedWorkbookId) {
    if (requiresSource) {
      return {
        status: "required_missing",
        title: "Source required",
        description: "Workbook-backed references need a source attached.",
        issue: "Attach a source to resolve workbook-backed references.",
        canRemove: false,
      };
    }

    return {
      status: "not_required_empty",
      title: "No source attached",
      description:
        "Attach a source inside this blueprint if it needs workbook-backed references.",
      canRemove: false,
    };
  }

  if (!input.selectedWorkbook) {
    if (input.isWorkbooksLoading) {
      return {
        status: "loading",
        title: "Loading source",
        description: "Loading attached source.",
        canRemove: true,
      };
    }

    return {
      status: "error",
      title:
        input.isVersionBoundSource === true
          ? "Version source not found"
          : "Source not found",
      description:
        input.isVersionBoundSource === true
          ? "This blueprint version's saved source could not be found."
          : "Attached source could not be found.",
      issue:
        input.isVersionBoundSource === true
          ? "Reattach the source and save a new blueprint version."
          : "Replace the source or remove it from this blueprint.",
      canRemove: true,
    };
  }

  const workbookSourceStatus = getWorkbookSourceStatus(input.selectedWorkbook);

  if (workbookSourceStatus === "pending_validation") {
    return {
      status: "loading",
      title: input.selectedWorkbook.name,
      description: "Validating source.",
      canRemove: true,
    };
  }

  if (workbookSourceStatus !== "ready") {
    return {
      status: "invalid",
      title: input.selectedWorkbook.name,
      description: "This source is not ready yet.",
      issue: getWorkbookIssue(input.selectedWorkbook),
      canRemove: true,
    };
  }

  if (input.previewStatus === "loading") {
    return {
      status: "loading",
      title: input.selectedWorkbook.name,
      description: "Loading source preview.",
      canRemove: true,
    };
  }

  if (input.previewStatus === "error" || input.previewError) {
    return {
      status: "error",
      title: input.selectedWorkbook.name,
      description: "Source preview could not be loaded.",
      issue: input.previewError ?? "Source preview could not be loaded.",
      canRemove: true,
    };
  }

  return {
    status: "ready",
    title: input.selectedWorkbook.name,
    description: "Ready source.",
    canRemove: true,
  };
}

function getWorkbookIssue(workbook: Workbook) {
  switch (getWorkbookSourceStatus(workbook)) {
    case "pending_validation":
      return "Source validation is still running.";
    case "invalid":
      return "Source needs attention before it can be used.";
    case "archived":
      return "Source is archived.";
    case "deleted":
      return "Source is deleted.";
    default:
      return "Source is not ready.";
  }
}
