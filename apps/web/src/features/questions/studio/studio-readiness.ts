import type {
  ComposedEditorModel,
  ReferenceUsage,
} from "#/domains/questions/authoring";
import {
  type BlueprintReadinessIssue,
  getBlueprintReadinessIssues,
} from "#/domains/questions/blueprint-readiness";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import {
  getStudioSourceIntegrityIssues,
  type StudioSourceIntegrityIssue,
} from "./source/source-integrity";
import type { StudioSource } from "./source/studio-source-model";
import {
  INSERTED_VALUES_CHECKING_MESSAGE,
  INSERTED_VALUES_NEED_ATTENTION_MESSAGE,
  REVIEW_AFFECTED_VALUES_BEFORE_PUBLISHING_MESSAGE,
  WAIT_FOR_WORKBOOK_VALUES_BEFORE_PUBLISHING_MESSAGE,
} from "./studio-reference-copy";

export type StudioReadinessIssue = {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  publishMessage?: string;
  blockedActions?: readonly StudioReadinessMessageAction[];
  locations?: readonly ReferenceUsage[];
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
  sources?: readonly StudioSource[];
  hasWorkbookSelection?: boolean;
};

export type StudioReadiness = {
  canSave: boolean;
  canGenerate: boolean;
  issues: StudioReadinessIssue[];
};

export type StudioReadinessAction = "save" | "generate_saved_blueprint";
export type StudioReadinessMessageAction = StudioReadinessAction | "publish";

export function getStudioReadiness(
  model: ComposedEditorModel,
  context: StudioReadinessContext,
): StudioReadiness {
  const issues = [
    ...getBlueprintReadinessIssues({
      attachedSources: context.attachedSources,
      model,
      name: context.questionName,
    }).map(mapBlueprintReadinessIssue),
    ...(context.sources
      ? getStudioSourceIntegrityIssues({
          model,
          sources: context.sources,
        }).map(mapSourceIntegrityIssue)
      : []),
  ];

  return {
    canGenerate: !hasBlockingIssue(issues, "generate_saved_blueprint"),
    canSave: !hasBlockingIssue(issues, "save"),
    issues,
  };
}

export function getFirstReadinessIssueMessage(
  readiness: StudioReadiness,
  action: StudioReadinessMessageAction,
) {
  const issue = readiness.issues.find(
    (candidate) =>
      candidate.blockedActions?.includes(action) ??
      (candidate.severity === "error" &&
        issueAppliesToAction(candidate.id, action)),
  );

  if (!issue) {
    return null;
  }

  return action === "publish"
    ? (issue.publishMessage ?? issue.message)
    : issue.message;
}

function hasBlockingIssue(
  issues: StudioReadinessIssue[],
  action: StudioReadinessAction,
) {
  return issues.some(
    (issue) =>
      issue.blockedActions?.includes(action) ??
      (issue.severity === "error" && issueAppliesToAction(issue.id, action)),
  );
}

function issueAppliesToAction(
  issueId: string,
  action: StudioReadinessMessageAction,
) {
  if (action === "save") {
    return issueId !== "missing_answers";
  }

  return true;
}

function mapSourceIntegrityIssue(
  issue: StudioSourceIntegrityIssue,
): StudioReadinessIssue {
  if (issue.code === "inserted_value_checking") {
    return {
      blockedActions: ["publish", "generate_saved_blueprint"],
      id: `inserted_value_checking_${issue.referenceId}`,
      message: INSERTED_VALUES_CHECKING_MESSAGE,
      locations: issue.locations,
      publishMessage: WAIT_FOR_WORKBOOK_VALUES_BEFORE_PUBLISHING_MESSAGE,
      severity: "warning",
      target: { referenceId: issue.referenceId },
    };
  }

  return {
    blockedActions: ["save", "publish", "generate_saved_blueprint"],
    id: `inserted_value_unavailable_${issue.referenceId}`,
    locations: issue.locations,
    message: INSERTED_VALUES_NEED_ATTENTION_MESSAGE,
    publishMessage: REVIEW_AFFECTED_VALUES_BEFORE_PUBLISHING_MESSAGE,
    severity: "error",
    target: { referenceId: issue.referenceId },
  };
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
        message: "An added value is invalid.",
        severity: "error",
        target: issue.target,
      };
    case "duplicate_reference_id":
      return {
        id: `duplicate_reference_id_${issue.target?.referenceId ?? "unknown"}`,
        message: "Added values must be unique.",
        severity: "error",
        target: issue.target,
      };
    case "invalid_reference_source":
      return {
        id: `reference_source_missing_${issue.target?.referenceId ?? "unknown"}`,
        message: "A workbook value needs an attached workbook.",
        severity: "error",
        target: issue.target,
      };
    case "missing_text_reference":
      return {
        id: `missing_text_reference_${issue.target?.blockId ?? "unknown"}_${issue.target?.cellId ?? issue.target?.referenceId ?? "unknown"}`,
        message: issue.target?.cellId
          ? "A content cell uses a value that is no longer available."
          : "Text uses a value that is no longer available.",
        severity: "error",
        target: issue.target,
      };
    case "missing_rich_text_reference":
      return {
        id: `missing_rich_text_reference_${issue.target?.blockId ?? "unknown"}_${issue.target?.referenceId ?? "unknown"}`,
        message: "Rich text uses a value that is no longer available.",
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
        message: "An answer uses a value that is no longer available.",
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
        message: "An answer cell uses a value that is no longer available.",
        severity: "error",
        target: issue.target,
      };
    case "missing_source":
      return {
        actionLabel: "Add reference",
        id: "source_not_ready",
        message: "Add a workbook before saving.",
        severity: "error",
      };
  }

  throw new Error(`Unhandled readiness issue: ${JSON.stringify(issue)}`);
}
