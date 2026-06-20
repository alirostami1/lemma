import type { Workbook } from "#/domains/workbooks/model";
import { getWorkbookSourceStatus } from "#/domains/workbooks/source-status";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";

export type StudioSourceViewState = {
  status: "empty" | "loading" | "ready" | "invalid" | "error";
  title: string;
  description: string;
  issue?: string;
  previewSourceId: string | null;
  sources: StudioSourceViewStateSource[];
};

export type StudioSourceViewStateSource = QuestionBlueprintWorkbookSource & {
  isPreview: boolean;
  canRemove: boolean;
  removeIssue?: string;
};

export function isLocalWorkbookSource(workbookId: string) {
  return workbookId.startsWith("local:");
}

export function getStudioSourceViewState(input: {
  sources: QuestionBlueprintWorkbookSource[];
  previewSourceId: string | null;
  previewSourceWorkbook: Workbook | null;
  isPreviewSourceLoading: boolean;
  previewStatus: "idle" | "loading" | "ready" | "error";
  previewError: string | null;
  sourceUsageCounts: Record<string, number>;
}): StudioSourceViewState {
  const sources = input.sources.map((source) => {
    const usageCount = input.sourceUsageCounts[source.sourceId] ?? 0;
    return {
      ...source,
      isPreview: source.sourceId === input.previewSourceId,
      canRemove: usageCount === 0,
      removeIssue:
        usageCount > 0
          ? `Used by ${usageCount} reference${usageCount === 1 ? "" : "s"}.`
          : undefined,
    };
  });

  if (sources.length === 0) {
    return {
      status: "empty",
      title: "No sources attached",
      description: "Attach a source to this blueprint.",
      previewSourceId: null,
      sources,
    };
  }

  const previewSource =
    sources.find((source) => source.sourceId === input.previewSourceId) ??
    sources[0] ??
    null;

  if (!previewSource) {
    return {
      status: "empty",
      title: "No sources attached",
      description: "Attach a source to this blueprint.",
      previewSourceId: null,
      sources,
    };
  }

  const previewSourceWorkbookStatus = input.previewSourceWorkbook
    ? getWorkbookSourceStatus(input.previewSourceWorkbook)
    : null;

  if (input.isPreviewSourceLoading) {
    return {
      status: "loading",
      title: previewSource.name,
      description: "Loading attached source.",
      previewSourceId: previewSource.sourceId,
      sources,
    };
  }

  if (!input.previewSourceWorkbook) {
    if (isLocalWorkbookSource(previewSource.workbookId)) {
      return {
        status: "ready",
        title: previewSource.name,
        description: "Local source.",
        previewSourceId: previewSource.sourceId,
        sources,
      };
    }

    return {
      status: "error",
      title: previewSource.name,
      description: "Attached source could not be found.",
      issue: "Replace the source or remove it from this blueprint.",
      previewSourceId: previewSource.sourceId,
      sources,
    };
  }

  if (previewSourceWorkbookStatus === "pending_validation") {
    return {
      status: "loading",
      title: previewSource.name,
      description: "Validating source.",
      previewSourceId: previewSource.sourceId,
      sources,
    };
  }

  if (previewSourceWorkbookStatus && previewSourceWorkbookStatus !== "ready") {
    return {
      status: "invalid",
      title: previewSource.name,
      description: "This source is not ready yet.",
      issue: getWorkbookIssue(input.previewSourceWorkbook),
      previewSourceId: previewSource.sourceId,
      sources,
    };
  }

  if (input.previewStatus === "loading") {
    return {
      status: "loading",
      title: previewSource.name,
      description: "Loading source preview.",
      previewSourceId: previewSource.sourceId,
      sources,
    };
  }

  if (input.previewStatus === "error" || input.previewError) {
    return {
      status: "error",
      title: previewSource.name,
      description: "Source preview could not be loaded.",
      issue: input.previewError ?? "Source preview could not be loaded.",
      previewSourceId: previewSource.sourceId,
      sources,
    };
  }

  return {
    status: "ready",
    title: previewSource.name,
    description: "Ready source.",
    previewSourceId: previewSource.sourceId,
    sources,
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
