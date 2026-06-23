import type { QuestionBlueprint, QuestionSet } from "#/domains/questions/model";

export type HomeAction = {
  label: string;
  to: "/" | "/create" | "/question-sets";
  variant: "primary" | "secondary";
};

export type RecentHomeItem =
  | {
      id: string;
      label: string;
      description?: string;
      to: "/studio";
      search: {
        blueprintId: string;
      };
    }
  | {
      id: string;
      label: string;
      description?: string;
      to: "/question-sets/$questionSetId";
      params: {
        questionSetId: string;
      };
    };

export type HomePageViewModel = {
  hero: {
    title: string;
    description: string;
    primaryAction: HomeAction;
    secondaryAction: HomeAction;
  };
  recentBlueprints: RecentHomeItem[];
  recentQuestionSets: RecentHomeItem[];
  hasRecentWork: boolean;
  emptyState: {
    title: string;
    description: string;
    action: HomeAction;
  } | null;
};

type BuildHomePageViewModelInput = {
  questionSets: QuestionSet[];
  blueprints: QuestionBlueprint[];
};

export const HOME_RECENT_ITEM_LIMIT = 3;

export function buildHomePageViewModel({
  questionSets,
  blueprints,
}: BuildHomePageViewModelInput): HomePageViewModel {
  const recentBlueprints = buildRecentBlueprintItems(blueprints).slice(
    0,
    HOME_RECENT_ITEM_LIMIT,
  );

  const recentQuestionSets = buildRecentQuestionSetItems(questionSets).slice(
    0,
    HOME_RECENT_ITEM_LIMIT,
  );

  const hasRecentWork =
    recentBlueprints.length > 0 || recentQuestionSets.length > 0;

  return {
    emptyState: hasRecentWork
      ? null
      : {
          action: {
            label: "Create blueprint",
            to: "/create",
            variant: "primary",
          },
          description:
            "Start in Studio, save your blueprint, then generate questions into a question set.",
          title: "Create your first blueprint",
        },
    hasRecentWork,
    hero: {
      description:
        "Create reusable blueprints and generate questions into question sets.",
      primaryAction: {
        label: "Create blueprint",
        to: "/create",
        variant: "primary",
      },
      secondaryAction: {
        label: "Question sets",
        to: "/question-sets",
        variant: "secondary",
      },
      title: "Lemma",
    },
    recentBlueprints,
    recentQuestionSets,
  };
}

export function buildRecentBlueprintItems(
  blueprints: QuestionBlueprint[],
): RecentHomeItem[] {
  return blueprints
    .filter(
      (blueprint) =>
        blueprint.status !== "deleted" && blueprint.visibility !== "system",
    )
    .map((item) => ({
      description: "Open in Studio",
      id: item.id,
      label: item.name,
      search: {
        blueprintId: item.id,
      },
      to: "/studio" as const,
    }));
}

export function buildRecentQuestionSetItems(
  questionSets: QuestionSet[],
): RecentHomeItem[] {
  return questionSets.map((item) => ({
    description: item.description ?? undefined,
    id: item.id,
    label: item.name,
    params: {
      questionSetId: item.id,
    },
    to: "/question-sets/$questionSetId" as const,
  }));
}
