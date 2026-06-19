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
  "id" | "name" | "status" | "visibility" | "workbookId"
>;

export function buildCreatePageViewModel(input: {
  blueprints: BlueprintListSource[];
}): CreatePageViewModel {
  return {
    hero: {
      title: "Create blueprint",
      description: "Choose how you want to start.",
    },
    blankBlueprint: {
      title: "Start blank",
      description: "Build a blueprint from scratch in Studio.",
      action: {
        type: "blank_blueprint",
        label: "Open Studio",
        to: "/studio",
      },
    },
    savedBlueprints: {
      title: "Open saved blueprint",
      description: "Continue editing a blueprint you already saved.",
      recentItems: buildBlueprintListItems(input.blueprints).slice(
        0,
        CREATE_RECENT_ITEM_LIMIT,
      ),
      emptyMessage: "No saved blueprints yet.",
      chooseLabel: "Choose blueprint",
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
      id: blueprint.id,
      title: blueprint.name,
      description: blueprint.workbookId
        ? "Source attached"
        : "No source attached",
      action: {
        type: "saved_blueprint",
        label: "Open blueprint",
        to: "/studio",
        search: { blueprintId: blueprint.id },
      },
    }));
}
