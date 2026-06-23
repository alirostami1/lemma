import type { QuestionBlueprint } from "#/domains/questions/model";

export const CREATE_RECENT_ITEM_LIMIT = 3;
export const CREATE_CHOOSER_PAGE_SIZE = 10;

export type BlankBlueprintAction = {
  type: "blank_blueprint";
  label: string;
  to: "/studio";
};

export type SavedBlueprintAction = {
  type: "saved_blueprint";
  label: string;
  to: "/studio";
  search: { blueprintId: string };
};

export type CreateLauncherAction = BlankBlueprintAction | SavedBlueprintAction;

export type CreateBlueprintListItem = {
  id: string;
  title: string;
  description: string;
  action: SavedBlueprintAction;
};

export type CreateLauncherListItem = CreateBlueprintListItem;

export type CreatePageViewModel = {
  hero: {
    title: string;
    description: string;
  };
  blankBlueprint: {
    title: string;
    description: string;
    action: BlankBlueprintAction;
  };
  savedBlueprints: {
    title: string;
    description: string;
    recentItems: CreateBlueprintListItem[];
    emptyMessage: string;
    chooseLabel: string;
  };
};

type BlueprintListSource = Pick<
  QuestionBlueprint,
  "id" | "name" | "status" | "visibility" | "sources"
>;

export function buildCreatePageViewModel(input: {
  blueprints: BlueprintListSource[];
}): CreatePageViewModel {
  return {
    blankBlueprint: {
      action: {
        label: "Open Studio",
        to: "/studio",
        type: "blank_blueprint",
      },
      description: "Build a blueprint from scratch in Studio.",
      title: "Start blank",
    },
    hero: {
      description: "Choose how you want to start.",
      title: "Create blueprint",
    },
    savedBlueprints: {
      chooseLabel: "Choose blueprint",
      description: "Continue editing a blueprint you already saved.",
      emptyMessage: "No saved blueprints yet.",
      recentItems: buildBlueprintListItems(input.blueprints).slice(
        0,
        CREATE_RECENT_ITEM_LIMIT,
      ),
      title: "Open saved blueprint",
    },
  };
}

export function buildBlueprintListItems(
  blueprints: BlueprintListSource[],
): CreateBlueprintListItem[] {
  return blueprints
    .filter(
      (blueprint) =>
        blueprint.status !== "deleted" && blueprint.visibility !== "system",
    )
    .map((blueprint) => ({
      action: {
        label: "Open blueprint",
        search: { blueprintId: blueprint.id },
        to: "/studio",
        type: "saved_blueprint",
      },
      description:
        blueprint.sources.length > 0
          ? "Sources attached"
          : "No sources attached",
      id: blueprint.id,
      title: blueprint.name,
    }));
}
