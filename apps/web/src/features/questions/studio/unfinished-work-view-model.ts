import type { QuestionBlueprintDraftSummary } from "#/domains/questions/model";
import { formatStableDateTime } from "#/lib/date-format";

export type StudioContinueCardViewModel = {
  draftId: string;
  lastEditedLabel: string;
  title: string;
  unpublishedChangesLabel: string;
};

export function buildStudioContinueCardViewModel(
  drafts: readonly QuestionBlueprintDraftSummary[],
): StudioContinueCardViewModel | null {
  const latestDraft = selectLatestUnfinishedWork(drafts);
  if (!latestDraft) {
    return null;
  }

  return {
    draftId: latestDraft.id,
    lastEditedLabel: formatUnfinishedWorkLastEditedLabel(latestDraft),
    title: latestDraft.name,
    unpublishedChangesLabel: "Unpublished changes",
  };
}

export function selectLatestUnfinishedWork(
  drafts: readonly QuestionBlueprintDraftSummary[],
): QuestionBlueprintDraftSummary | null {
  return drafts.reduce<QuestionBlueprintDraftSummary | null>(
    (latest, draft) => {
      if (draft.status !== "draft") {
        return latest;
      }

      if (!latest) {
        return draft;
      }

      return compareDraftRecency(draft, latest) > 0 ? draft : latest;
    },
    null,
  );
}

export function formatUnfinishedWorkLastEditedLabel(
  draft: QuestionBlueprintDraftSummary,
): string {
  return `Last edited ${formatStableDateTime(getUnfinishedWorkLastEditedAt(draft))}`;
}

function compareDraftRecency(
  left: QuestionBlueprintDraftSummary,
  right: QuestionBlueprintDraftSummary,
): number {
  const lastEditedDifference =
    getUnfinishedWorkLastEditedAt(left).getTime() -
    getUnfinishedWorkLastEditedAt(right).getTime();
  if (lastEditedDifference !== 0) {
    return lastEditedDifference;
  }

  const updatedDifference =
    left.updatedAt.getTime() - right.updatedAt.getTime();
  if (updatedDifference !== 0) {
    return updatedDifference;
  }

  return left.id.localeCompare(right.id);
}

function getUnfinishedWorkLastEditedAt(
  draft: QuestionBlueprintDraftSummary,
): Date {
  return draft.lastSavedAt.getTime() >= draft.updatedAt.getTime()
    ? draft.lastSavedAt
    : draft.updatedAt;
}
