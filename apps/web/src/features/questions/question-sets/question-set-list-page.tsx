import { PageContainer } from "#/components/patterns";
import { signIn } from "#/features/auth";
import {
  AccessDeniedPage,
  SignInRequiredPage,
  UnexpectedErrorPage,
} from "#/features/errors";
import {
  QuestionSetListHeader,
  QuestionSetListSection,
} from "./question-set-list-sections";
import { useQuestionSetListController } from "./use-question-set-list-controller";

export function QuestionSetListPage() {
  const controller = useQuestionSetListController();

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
            description="You do not have access to these question sets."
            requestId={controller.pageError.requestId}
          />
        );
      case "unexpected":
        return (
          <UnexpectedErrorPage
            description="Question sets could not be loaded."
            requestId={controller.pageError.requestId}
          />
        );
    }
  }

  return (
    <PageContainer variant="resource">
      <QuestionSetListHeader viewModel={controller.viewModel} />
      <QuestionSetListSection controller={controller} />
    </PageContainer>
  );
}
