import type {
  QuestionBlueprint,
  QuestionBlueprintDraftSummary,
} from "#/domains/questions/model";
import { formatStableDateTime } from "#/lib/date-format";

export type SavedBlueprintListItem = {
  id: string;
  title: string;
  description: string | null;
  metadata: string;
};

export type SavedDraftListItem = {
  id: string;
  title: string;
  description: string | null;
  metadata: string;
};

type DraftSummaryMetadataInput = Omit<
  QuestionBlueprintDraftSummary,
  "sourceCount"
> & {
  sourceCount?: number;
  sources?: readonly { sourceId: string }[];
};

function getDraftSourceCount(draft: DraftSummaryMetadataInput): number {
  return draft.sourceCount ?? draft.sources?.length ?? 0;
}

export function buildSavedDraftsViewModel(
  drafts: QuestionBlueprintDraftSummary[],
): SavedDraftListItem[] {
  return drafts.map((draft) => {
    const draftMetadataInput = draft as DraftSummaryMetadataInput;
    const sourceCount = getDraftSourceCount(draftMetadataInput);
    const sourceText =
      sourceCount === 1 ? "1 source" : `${sourceCount} sources`;

    return {
      description: draft.description,
      id: draft.id,
      metadata: [
        "Draft",
        sourceText,
        `Updated ${formatStableDateTime(draft.updatedAt)}`,
        `Saved ${formatStableDateTime(draft.lastSavedAt)}`,
        draft.blueprintId
          ? `Blueprint ${draft.blueprintId}`
          : "No linked blueprint",
      ].join(" | "),
      title: draft.name,
    };
  });
}

export function buildSavedBlueprintsViewModel(
  blueprints: QuestionBlueprint[],
): SavedBlueprintListItem[] {
  return blueprints.map((blueprint) => ({
    description: blueprint.description,
    id: blueprint.id,
    metadata: [
      "Published",
      blueprint.sources.length > 0 ? "Sources attached" : "No sources",
      `Updated ${formatStableDateTime(blueprint.updatedAt)}`,
      `Created ${formatStableDateTime(blueprint.createdAt)}`,
    ].join(" | "),
    title: blueprint.name,
  }));
}
