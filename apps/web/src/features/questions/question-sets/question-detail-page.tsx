import { Button } from "@lemma/ui/components/button";
import { DetailSection } from "@lemma/ui/components/detail-section";
import { InlineError } from "@lemma/ui/components/inline-error";
import { PageHeader } from "@lemma/ui/components/page-header";
import { Skeleton } from "@lemma/ui/components/skeleton";
import { Link } from "@tanstack/react-router";
import { PageContainer } from "#/components/patterns";
import { signIn } from "#/features/auth";
import {
  AccessDeniedPage,
  NotFoundPage,
  SignInRequiredPage,
  UnexpectedErrorPage,
} from "#/features/errors";
import {
  QuestionPlayer,
  questionToPresentableQuestion,
} from "../question-player";
import { useQuestionDetailController } from "./use-question-detail-controller";

export function QuestionDetailPage({
  questionId,
  questionSetId,
}: {
  questionId: string;
  questionSetId: string;
}) {
  const controller = useQuestionDetailController({ questionId, questionSetId });

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
            description="You do not have access to this question."
            requestId={controller.pageError.requestId}
          />
        );
      case "not_found":
        return <NotFoundPage description="This question could not be found." />;
      case "unexpected":
        return (
          <UnexpectedErrorPage
            description="This question could not be loaded."
            requestId={controller.pageError.requestId}
          />
        );
    }
  }

  return (
    <PageContainer variant="resource">
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link params={{ questionSetId }} to="/question-sets/$questionSetId">
              Back to question set
            </Link>
          </Button>
        }
        description={
          controller.questionSet
            ? `From ${controller.questionSet.name}`
            : "Review generated question."
        }
        title="Question"
      />
      <DetailSection
        description="Review this generated question."
        title="Question"
      >
        {controller.isLoading || !controller.question ? (
          <QuestionDetailSkeleton />
        ) : (
          <div className="grid gap-4">
            <QuestionPlayer
              answer={controller.answer}
              feedback={controller.grade}
              mode="practice"
              onAnswerChange={controller.onAnswerChange}
              question={questionToPresentableQuestion(controller.question)}
            />
            {controller.checkAnswerError ? (
              <InlineError message={controller.checkAnswerError} />
            ) : null}
            <div>
              <Button
                disabled={!controller.canCheckAnswer}
                onClick={controller.onCheckAnswer}
                type="button"
              >
                {controller.isCheckingAnswer
                  ? "Checking answer..."
                  : controller.grade
                    ? "Check again"
                    : "Check answer"}
              </Button>
            </div>
          </div>
        )}
      </DetailSection>
    </PageContainer>
  );
}

function QuestionDetailSkeleton() {
  return (
    <output className="grid gap-3">
      <span className="sr-only">Loading question...</span>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-24 w-full" />
    </output>
  );
}
