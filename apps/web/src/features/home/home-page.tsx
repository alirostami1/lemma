import { PageContainer } from "#/components/patterns";
import { signIn } from "#/features/auth";
import { AccessDeniedPage, SignInRequiredPage } from "#/features/errors";
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
              action={{
                label: "Create blueprint",
                to: "/create",
                variant: "secondary",
              }}
              emptyMessage="No saved blueprints yet."
              errorMessage={controller.blueprints.errorMessage}
              isLoading={controller.blueprints.isLoading}
              items={controller.viewModel.recentBlueprints}
              onRetry={controller.blueprints.onRetry}
              title="Saved blueprints"
            />
          ) : null}
          {controller.viewModel.recentQuestionSets.length > 0 ||
          controller.questionSets.isLoading ||
          controller.questionSets.errorMessage ? (
            <RecentWorkSection
              action={{
                label: "View all",
                to: "/question-sets",
                variant: "secondary",
              }}
              emptyMessage="No question sets yet."
              errorMessage={controller.questionSets.errorMessage}
              isLoading={controller.questionSets.isLoading}
              items={controller.viewModel.recentQuestionSets}
              onRetry={controller.questionSets.onRetry}
              title="Recent question sets"
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
