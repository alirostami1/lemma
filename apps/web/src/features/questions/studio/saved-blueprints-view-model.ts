import type { QuestionBlueprint } from "#/domains/questions/model";
import { formatStableDateTime } from "#/lib/date-format";

export type SavedBlueprintListItem = {
  id: string;
  title: string;
  description: string | null;
  metadata: string;
};

export function buildSavedBlueprintsViewModel(
  blueprints: QuestionBlueprint[],
): SavedBlueprintListItem[] {
  return blueprints.map((blueprint) => ({
    id: blueprint.id,
    title: blueprint.name,
    description: blueprint.description,
    metadata: [
      blueprint.sources.length > 0 ? "Sources attached" : "No sources",
      `Updated ${formatStableDateTime(blueprint.updatedAt)}`,
      `Created ${formatStableDateTime(blueprint.createdAt)}`,
    ].join(" | "),
  }));
}
