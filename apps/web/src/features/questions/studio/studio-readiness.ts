import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  type BlueprintReadinessIssue,
  getBlueprintReadinessIssues,
} from "#/domains/questions/blueprint-readiness";

export type StudioReadinessIssue = {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  actionLabel?: string;
  target?: {
    blockId?: string;
    cellId?: string;
    referenceId?: string;
  };
};

export type StudioReadinessContext = {
  questionName: string;
  hasWorkbookSelection: boolean;
  hasWorkbookPreview: boolean;
};

export type StudioReadiness = {
  canSave: boolean;
  canGenerate: boolean;
  issues: StudioReadinessIssue[];
};

export type StudioReadinessAction = "save" | "generate_saved_blueprint";

export function getStudioReadiness(
  model: ComposedEditorModel,
  context: StudioReadinessContext,
): StudioReadiness {
  const issues = getBlueprintReadinessIssues({
    model,
    hasWorkbookSelection: context.hasWorkbookSelection,
    hasWorkbookPreview: context.hasWorkbookPreview,
    name: context.questionName,
  }).map(mapBlueprintReadinessIssue);

  return {
    canSave: !hasBlockingIssue(issues, "save"),
    canGenerate: !hasBlockingIssue(issues, "generate_saved_blueprint"),
    issues,
  };
}

export function getFirstReadinessIssueMessage(
  readiness: StudioReadiness,
  action: StudioReadinessAction,
) {
  return (
    readiness.issues.find(
      (issue) =>
        issue.severity === "error" && issueAppliesToAction(issue.id, action),
    )?.message ?? null
  );
}

function hasBlockingIssue(
  issues: StudioReadinessIssue[],
  action: StudioReadinessAction,
) {
  return issues.some(
    (issue) =>
      issue.severity === "error" && issueAppliesToAction(issue.id, action),
  );
}

function issueAppliesToAction(issueId: string, action: StudioReadinessAction) {
  if (action === "save") {
    return issueId !== "missing_answers";
  }

  return true;
}

function mapBlueprintReadinessIssue(
  issue: BlueprintReadinessIssue,
): StudioReadinessIssue {
  switch (issue.code) {
    case "missing_name":
      return {
        id: "missing_blueprint_name",
        severity: "error",
        message: "Add a blueprint name.",
      };
    case "missing_block":
      return {
        id: "missing_blocks",
        severity: "error",
        message: "Add at least one block.",
        actionLabel: "Add block",
      };
    case "missing_answer":
      return {
        id: "missing_answers",
        severity: "error",
        message: "Add at least one answer before generating.",
        actionLabel: "Add answer",
      };
    case "invalid_reference_id":
      return {
        id: `invalid_reference_id_${issue.target?.referenceId ?? "unknown"}`,
        severity: "error",
        message: "A reference has an invalid ID.",
        target: issue.target,
      };
    case "duplicate_reference_id":
      return {
        id: `duplicate_reference_id_${issue.target?.referenceId ?? "unknown"}`,
        severity: "error",
        message: "Reference IDs must be unique.",
        target: issue.target,
      };
    case "invalid_reference_source":
      return {
        id: `reference_source_missing_${issue.target?.referenceId ?? "unknown"}`,
        severity: "error",
        message:
          "A workbook-backed reference needs a valid source cell or range.",
        target: issue.target,
      };
    case "missing_text_reference":
      return {
        id: `missing_text_reference_${issue.target?.blockId ?? "unknown"}_${issue.target?.cellId ?? issue.target?.referenceId ?? "unknown"}`,
        severity: "error",
        message: issue.target?.cellId
          ? "A content cell references a missing reference."
          : "A text reference points to a missing reference.",
        target: issue.target,
      };
    case "missing_rich_text_reference":
      return {
        id: `missing_rich_text_reference_${issue.target?.blockId ?? "unknown"}_${issue.target?.referenceId ?? "unknown"}`,
        severity: "error",
        message: "A rich text reference points to a missing reference.",
        target: issue.target,
      };
    case "missing_response_field":
      return {
        id: `missing_response_field_${issue.target?.blockId ?? "unknown"}`,
        severity: "error",
        message: "An answer block is missing its answer field.",
        target: issue.target,
      };
    case "missing_response_source":
      return {
        id: `missing_response_source_${issue.target?.blockId ?? "unknown"}`,
        severity: "error",
        message: "An answer references a missing reference.",
        target: issue.target,
      };
    case "missing_table_response_field":
      return {
        id: `missing_table_response_field_${issue.target?.blockId ?? "unknown"}_${issue.target?.cellId ?? "unknown"}`,
        severity: "error",
        message: "An answer cell is missing its answer field.",
        target: issue.target,
      };
    case "missing_table_response_source":
      return {
        id: `missing_table_response_source_${issue.target?.blockId ?? "unknown"}_${issue.target?.cellId ?? "unknown"}`,
        severity: "error",
        message: "An answer cell references a missing reference.",
        target: issue.target,
      };
    case "missing_source":
      return {
        id: "source_not_ready",
        severity: "error",
        message: "Select a workbook to reference cells.",
        actionLabel: "Select workbook",
      };
    case "missing_source_preview":
      return {
        id: "source_preview_pending",
        severity: "info",
        message: "Source preview is still loading.",
      };
  }
}
