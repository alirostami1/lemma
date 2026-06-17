import { PageContainer } from "#/components/patterns";
import { signIn } from "#/features/auth";
import {
  AccessDeniedPage,
  NotFoundPage,
  SignInRequiredPage,
  UnexpectedErrorPage,
} from "#/features/errors";
import {
  QuestionSetDetailHeader,
  QuestionSetGeneratedQuestionsSection,
  QuestionSetSummarySection,
} from "./question-set-detail-sections";
import { getQuestionSetDetailViewModel } from "./question-set-detail-view-model";
import { useQuestionSetDetailController } from "./use-question-set-detail-controller";

export function QuestionSetDetailPage({
  questionSetId,
}: {
  questionSetId: string;
}) {
  const controller = useQuestionSetDetailController({ questionSetId });
  if (controller.pageError) {
    switch (controller.pageError.kind) {
      case "sign_in_required":
        return (
          <SignInRequiredPage
            onSignIn={() => {
              void signIn();
            }}
          />
        );
      case "forbidden":
        return (
          <AccessDeniedPage
            description="You do not have access to this question set."
            requestId={controller.pageError.requestId}
          />
        );
      case "not_found":
        return (
          <NotFoundPage description="This question set could not be found." />
        );
      case "unexpected":
        return (
          <UnexpectedErrorPage
            description="This question set could not be loaded."
            requestId={controller.pageError.requestId}
          />
        );
    }
  }

  const questionSet =
    controller.questionSetState.status === "ready"
      ? controller.questionSetState.questionSet
      : null;
  const viewModel = getQuestionSetDetailViewModel({ questionSet });

  return (
    <PageContainer variant="resource">
      <QuestionSetDetailHeader viewModel={viewModel} />
      <QuestionSetSummarySection
        questionSet={questionSet}
        state={
          controller.questionSetState.status === "ready"
            ? { status: "ready" }
            : controller.questionSetState
        }
        viewModel={viewModel}
      />
      <QuestionSetGeneratedQuestionsSection
        questionSetId={questionSetId}
        questionItems={controller.questionItems}
        questionsState={controller.questionsState}
        viewModel={viewModel}
        onLoadMore={controller.onLoadMore}
        onRetryLoadMore={controller.onRetryLoadMore}
      />
    </PageContainer>
  );
}
