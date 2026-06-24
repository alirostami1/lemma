import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  type BlueprintReadinessIssue,
  getBlueprintReadinessIssues,
} from "#/domains/questions/blueprint-readiness";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";

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
  attachedSources: QuestionBlueprintWorkbookSource[];
  hasWorkbookSelection?: boolean;
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
    attachedSources: context.attachedSources,
    model,
    name: context.questionName,
  }).map(mapBlueprintReadinessIssue);

  return {
    canGenerate: !hasBlockingIssue(issues, "generate_saved_blueprint"),
    canSave: !hasBlockingIssue(issues, "save"),
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
        message: "Add a blueprint name.",
        severity: "error",
      };
    case "missing_block":
      return {
        actionLabel: "Add block",
        id: "missing_blocks",
        message: "Add at least one block.",
        severity: "error",
      };
    case "missing_answer":
      return {
        actionLabel: "Add answer",
        id: "missing_answers",
        message: "Add at least one answer before generating.",
        severity: "error",
      };
    case "invalid_reference_id":
      return {
        id: `invalid_reference_id_${issue.target?.referenceId ?? "unknown"}`,
        message: "A reference has an invalid ID.",
        severity: "error",
        target: issue.target,
      };
    case "duplicate_reference_id":
      return {
        id: `duplicate_reference_id_${issue.target?.referenceId ?? "unknown"}`,
        message: "Reference IDs must be unique.",
        severity: "error",
        target: issue.target,
      };
    case "invalid_reference_source":
      return {
        id: `reference_source_missing_${issue.target?.referenceId ?? "unknown"}`,
        message: "A workbook-backed reference needs an attached source.",
        severity: "error",
        target: issue.target,
      };
    case "missing_text_reference":
      return {
        id: `missing_text_reference_${issue.target?.blockId ?? "unknown"}_${issue.target?.cellId ?? issue.target?.referenceId ?? "unknown"}`,
        message: issue.target?.cellId
          ? "A content cell references a missing reference."
          : "A text reference points to a missing reference.",
        severity: "error",
        target: issue.target,
      };
    case "missing_rich_text_reference":
      return {
        id: `missing_rich_text_reference_${issue.target?.blockId ?? "unknown"}_${issue.target?.referenceId ?? "unknown"}`,
        message: "A rich text reference points to a missing reference.",
        severity: "error",
        target: issue.target,
      };
    case "missing_response_field":
      return {
        id: `missing_response_field_${issue.target?.blockId ?? "unknown"}`,
        message: "An answer block is missing its answer field.",
        severity: "error",
        target: issue.target,
      };
    case "missing_response_source":
      return {
        id: `missing_response_source_${issue.target?.blockId ?? "unknown"}`,
        message: "An answer references a missing reference.",
        severity: "error",
        target: issue.target,
      };
    case "missing_table_response_field":
      return {
        id: `missing_table_response_field_${issue.target?.blockId ?? "unknown"}_${issue.target?.cellId ?? "unknown"}`,
        message: "An answer cell is missing its answer field.",
        severity: "error",
        target: issue.target,
      };
    case "missing_table_response_source":
      return {
        id: `missing_table_response_source_${issue.target?.blockId ?? "unknown"}_${issue.target?.cellId ?? "unknown"}`,
        message: "An answer cell references a missing reference.",
        severity: "error",
        target: issue.target,
      };
    case "missing_source":
      return {
        actionLabel: "Attach source",
        id: "source_not_ready",
        message: "Attach a source before saving this blueprint.",
        severity: "error",
      };
  }

  throw new Error(`Unhandled readiness issue: ${JSON.stringify(issue)}`);
}
