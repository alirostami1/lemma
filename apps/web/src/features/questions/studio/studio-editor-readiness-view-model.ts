import type {
  DocumentReadinessIssue,
  ReferenceRecoveryItem,
} from "#/features/questions/composed-editor";
import type { StudioReadiness, StudioReadinessIssue } from "./studio-readiness";

export function getStudioEditorReadinessViewModel(readiness: StudioReadiness): {
  documentIssues: readonly DocumentReadinessIssue[];
  referenceRecoveryItems: readonly ReferenceRecoveryItem[];
} {
  return {
    documentIssues: readiness.issues
      .filter((issue) => !isReferenceRecoveryIssue(issue))
      .map((issue) => ({ id: issue.id, message: issue.message })),
    referenceRecoveryItems: readiness.issues.flatMap((issue) =>
      isReferenceRecoveryIssue(issue)
        ? issue.locations.map((usage, index) => ({
            id: `${issue.id}_${index}`,
            referenceId: issue.target.referenceId,
            status: issue.severity === "warning" ? "checking" : "unavailable",
            usage,
          }))
        : [],
    ),
  };
}

function isReferenceRecoveryIssue(
  issue: StudioReadinessIssue,
): issue is StudioReadinessIssue & {
  locations: NonNullable<StudioReadinessIssue["locations"]>;
  target: { referenceId: string };
} {
  return Boolean(issue.target?.referenceId && issue.locations?.length);
}
