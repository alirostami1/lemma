import { Button } from "@lemma/ui/components/button";
import { DetailSection } from "@lemma/ui/components/detail-section";
import { PageHeader } from "@lemma/ui/components/page-header";
import { PaginatedList } from "@lemma/ui/components/paginated-list";
import { Skeleton } from "@lemma/ui/components/skeleton";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, FilePlus2 } from "lucide-react";
import type { QuestionSet } from "#/domains/questions";
import type { QuestionListItemViewModel } from "./question-list-view-model";
import type { QuestionSetDetailViewModel } from "./question-set-detail-view-model";
import { QuestionSetQuestionList } from "./question-set-question-list";

export function QuestionSetDetailHeader({
  viewModel,
}: {
  viewModel: QuestionSetDetailViewModel;
}) {
  return (
    <PageHeader
      title={viewModel.title}
      description={viewModel.description}
      actions={
        <>
          <Button asChild variant="outline">
            <Link to="/question-sets">
              <ArrowLeft />
              {viewModel.backLabel}
            </Link>
          </Button>
          <Button asChild>
            <Link to="/create">
              <FilePlus2 />
              {viewModel.createLabel}
            </Link>
          </Button>
        </>
      }
    />
  );
}

export function QuestionSetSummarySection({
  questionSet,
  state,
  viewModel,
}: {
  questionSet: QuestionSet | null;
  state: { status: "loading" } | { status: "ready" };
  viewModel: QuestionSetDetailViewModel;
}) {
  return (
    <DetailSection
      title={viewModel.summaryTitle}
      description={viewModel.summaryDescription}
    >
      <div className="grid gap-2 text-sm">
        {state.status === "loading" ? (
          <QuestionSetSummarySkeleton />
        ) : (
          <>
            <p className="font-medium">{questionSet?.name}</p>
            {questionSet?.description ? (
              <p className="text-muted-foreground">{questionSet.description}</p>
            ) : (
              <p className="text-muted-foreground">
                No description yet for this question set.
              </p>
            )}
          </>
        )}
      </div>
    </DetailSection>
  );
}

export function QuestionSetGeneratedQuestionsSection({
  questionSetId,
  questionItems,
  questionsState,
  viewModel,
  onLoadMore,
  onRetryLoadMore,
}: {
  questionSetId: string;
  questionItems: QuestionListItemViewModel[];
  questionsState: {
    isInitialLoading: boolean;
    initialErrorMessage: string | null;
    loadMoreErrorMessage: string | null;
    isLoadMorePending: boolean;
    hasMore: boolean;
    hasLoadedQuestions: boolean;
  };
  viewModel: QuestionSetDetailViewModel;
  onLoadMore(): void;
  onRetryLoadMore(): void;
}) {
  return (
    <DetailSection
      title={viewModel.generatedQuestionsTitle}
      description={viewModel.generatedQuestionsDescription}
    >
      <div className="grid gap-4">
        <QuestionSetQuestionList
          questionSetId={questionSetId}
          items={questionItems}
          isLoading={questionsState.isInitialLoading}
          isError={questionsState.initialErrorMessage !== null}
        />
        {questionsState.hasMore ? (
          <PaginatedList
            children={null}
            hasMore={questionsState.hasMore}
            isLoadingMore={questionsState.isLoadMorePending}
            loadMoreErrorMessage={questionsState.loadMoreErrorMessage}
            onLoadMore={onLoadMore}
            onRetryLoadMore={onRetryLoadMore}
          />
        ) : questionsState.hasLoadedQuestions ? (
          <p className="text-center text-sm text-muted-foreground">
            {viewModel.endOfListLabel}
          </p>
        ) : null}
      </div>
    </DetailSection>
  );
}

function QuestionSetSummarySkeleton() {
  return (
    <output className="grid gap-2">
      <span className="sr-only">Loading question set...</span>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </output>
  );
}
