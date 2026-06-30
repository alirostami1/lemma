import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  getReferenceIntegrityIssues,
  getUnavailableUsedWorkbookReferenceIdsForSource as getUnavailableUsedWorkbookReferenceIdsForSourceDomain,
  type ReferenceIntegrityIssue,
  type ReferenceIntegrityWorkbookSource,
} from "#/domains/questions/reference-integrity";
import { columnIndexToLabel } from "#/domains/questions/workbook-reference";
import {
  createLocalWorkbookCellKey,
  type LocalWorkbookParseResult,
} from "#/domains/workbooks/local-xlsx";
import type { StudioSource } from "./studio-source-model";

export type StudioSourceIntegrityIssue = ReferenceIntegrityIssue;

export function getStudioSourceIntegrityIssues(input: {
  model: ComposedEditorModel;
  sources: readonly StudioSource[];
}): ReferenceIntegrityIssue[] {
  return getReferenceIntegrityIssues({
    model: input.model,
    sources: input.sources.map(toReferenceIntegrityWorkbookSource),
  });
}

export function getUnavailableUsedReferenceIdsForParsedWorkbookReplacement(input: {
  model: ComposedEditorModel;
  sourceId: string;
  workbook: LocalWorkbookParseResult;
}): string[] {
  return getUnavailableUsedWorkbookReferenceIdsForSourceDomain({
    model: input.model,
    source: createAvailableWorkbookSource(input.sourceId, input.workbook),
    sourceId: input.sourceId,
  });
}

export function toReferenceIntegrityWorkbookSource(
  source: StudioSource,
): ReferenceIntegrityWorkbookSource {
  switch (source.backing.kind) {
    case "local_file":
      if (source.backing.parseStatus === "parsing") {
        return createWorkbookSourceWithStatus(source.sourceId, "checking");
      }
      return source.backing.parseStatus === "parsed" &&
        source.backing.parsedWorkbook
        ? createAvailableWorkbookSource(
            source.sourceId,
            source.backing.parsedWorkbook,
          )
        : createWorkbookSourceWithStatus(source.sourceId, "unavailable");
    case "draft_file":
      if (source.backing.previewStatus === "loading") {
        return createWorkbookSourceWithStatus(source.sourceId, "checking");
      }
      if (source.backing.previewStatus === "failed") {
        return createWorkbookSourceWithStatus(source.sourceId, "unavailable");
      }
      return source.backing.previewStatus === "loaded" &&
        source.backing.parsedWorkbook
        ? createAvailableWorkbookSource(
            source.sourceId,
            source.backing.parsedWorkbook,
          )
        : createWorkbookSourceWithStatus(source.sourceId, "unknown");
    case "persisted_workbook":
      return source.backing.parsedWorkbook
        ? createAvailableWorkbookSource(
            source.sourceId,
            source.backing.parsedWorkbook,
          )
        : createWorkbookSourceWithStatus(source.sourceId, "unknown");
    case "restoring_local_file":
      return createWorkbookSourceWithStatus(source.sourceId, "checking");
    case "missing_local_file":
      return createWorkbookSourceWithStatus(source.sourceId, "unavailable");
  }
}

function createAvailableWorkbookSource(
  sourceId: string,
  workbook: LocalWorkbookParseResult,
): ReferenceIntegrityWorkbookSource {
  return {
    availability: {
      hasCell: (address) =>
        workbook.cellsByKey.has(
          createLocalWorkbookCellKey(
            address.sheetName,
            `${columnIndexToLabel(address.columnIndex)}${address.rowIndex + 1}`,
          ),
        ),
      status: "available",
    },
    sourceId,
    type: "workbook",
  };
}

function createWorkbookSourceWithStatus(
  sourceId: string,
  status: Exclude<
    ReferenceIntegrityWorkbookSource["availability"]["status"],
    "available"
  >,
): ReferenceIntegrityWorkbookSource {
  return {
    availability: { status },
    sourceId,
    type: "workbook",
  };
}
