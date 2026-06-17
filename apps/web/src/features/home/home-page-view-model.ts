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
    hero: {
      title: "Lemma",
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
    },
    recentBlueprints,
    recentQuestionSets,
    hasRecentWork,
    emptyState: hasRecentWork
      ? null
      : {
          title: "Create your first blueprint",
          description:
            "Start in Studio, save your blueprint, then generate questions into a question set.",
          action: {
            label: "Create blueprint",
            to: "/create",
            variant: "primary",
          },
        },
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
      id: item.id,
      label: item.name,
      description: "Open in Studio",
      to: "/studio" as const,
      search: {
        blueprintId: item.id,
      },
    }));
}

export function buildRecentQuestionSetItems(
  questionSets: QuestionSet[],
): RecentHomeItem[] {
  return questionSets.map((item) => ({
    id: item.id,
    label: item.name,
    description: item.description ?? undefined,
    to: "/question-sets/$questionSetId" as const,
    params: {
      questionSetId: item.id,
    },
  }));
}
