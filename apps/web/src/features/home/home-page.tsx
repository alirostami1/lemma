import { PageContainer } from "#/components/patterns";
import { signIn } from "#/features/auth";
import {
  AccessDeniedPage,
  SignInRequiredPage,
} from "#/features/errors";
import {
  HomeEmptyState,
  HomeHeroSection,
  RecentWorkSection,
} from "./home-page-sections";
import { useHomePageController } from "./use-home-page-controller";

export function HomePage() {
  const controller = useHomePageController();
  const hasSectionActivity =
    controller.viewModel.hasRecentWork ||
    controller.blueprints.isLoading ||
    controller.questionSets.isLoading ||
    controller.blueprints.errorMessage !== null ||
    controller.questionSets.errorMessage !== null;

  if (controller.pageError?.kind === "sign_in_required") {
    return (
      <SignInRequiredPage
        onSignIn={() => {
          void signIn();
        }}
      />
    );
  }

  if (controller.pageError?.kind === "forbidden") {
    return (
      <AccessDeniedPage
        description="You do not have access to recent work."
        requestId={controller.pageError.requestId}
      />
    );
  }

  return (
    <PageContainer variant="launcher">
      <HomeHeroSection hero={controller.viewModel.hero} />

      {hasSectionActivity ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {controller.viewModel.recentBlueprints.length > 0 ||
          controller.blueprints.isLoading ||
          controller.blueprints.errorMessage ? (
            <RecentWorkSection
              title="Saved blueprints"
              action={{
                label: "Create blueprint",
                to: "/create",
                variant: "secondary",
              }}
              items={controller.viewModel.recentBlueprints}
              isLoading={controller.blueprints.isLoading}
              errorMessage={controller.blueprints.errorMessage}
              emptyMessage="No saved blueprints yet."
              onRetry={controller.blueprints.onRetry}
            />
          ) : null}
          {controller.viewModel.recentQuestionSets.length > 0 ||
          controller.questionSets.isLoading ||
          controller.questionSets.errorMessage ? (
            <RecentWorkSection
              title="Recent question sets"
              action={{
                label: "View all",
                to: "/question-sets",
                variant: "secondary",
              }}
              items={controller.viewModel.recentQuestionSets}
              isLoading={controller.questionSets.isLoading}
              errorMessage={controller.questionSets.errorMessage}
              emptyMessage="No question sets yet."
              onRetry={controller.questionSets.onRetry}
            />
          ) : null}
        </div>
      ) : null}

      {!hasSectionActivity && controller.viewModel.emptyState ? (
        <HomeEmptyState emptyState={controller.viewModel.emptyState} />
      ) : null}
    </PageContainer>
  );
}
