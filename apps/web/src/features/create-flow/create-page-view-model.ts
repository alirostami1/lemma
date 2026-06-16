import type { QuestionBlueprint } from "#/domains/questions/model";
import type { Workbook } from "#/domains/workbooks/model";

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

export type SourceBackedBlueprintAction = {
  type: "source_backed_blueprint";
  label: string;
  to: "/studio";
  search: { workbookId: string };
};

export type CreateLauncherAction =
  | BlankBlueprintAction
  | SavedBlueprintAction
  | SourceBackedBlueprintAction;

export type CreateBlueprintListItem = {
  id: string;
  title: string;
  description: string;
  action: SavedBlueprintAction;
};

export type CreateSourceListItem = {
  id: string;
  title: string;
  description: string;
  statusLabel: string;
  action: SourceBackedBlueprintAction;
};

export type CreateLauncherListItem =
  | CreateBlueprintListItem
  | CreateSourceListItem;

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
  sourceBackedBlueprint: {
    title: string;
    description: string;
    recentItems: CreateSourceListItem[];
    emptyMessage: string;
    chooseLabel: string;
    uploadLabel: string;
  };
};

type BlueprintListSource = Pick<
  QuestionBlueprint,
  "id" | "name" | "status" | "visibility" | "workbookId"
>;

type SourceListSource = Pick<Workbook, "id" | "name" | "originalName">;

export function buildCreatePageViewModel(input: {
  blueprints: BlueprintListSource[];
  sources: SourceListSource[];
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
    sourceBackedBlueprint: {
      title: "Start from source",
      description: "Start Studio with a source already selected.",
      recentItems: buildSourceListItems(input.sources).slice(
        0,
        CREATE_RECENT_ITEM_LIMIT,
      ),
      emptyMessage: "No ready sources yet.",
      chooseLabel: "Choose source",
      uploadLabel: "Upload source",
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

export function buildSourceListItems(
  sources: SourceListSource[],
): CreateSourceListItem[] {
  return sources.map((source) => ({
    id: source.id,
    title: source.name,
    description: source.originalName,
    statusLabel: "Ready",
    action: {
      type: "source_backed_blueprint",
      label: "Open with source",
      to: "/studio",
      search: { workbookId: source.id },
    },
  }));
}
