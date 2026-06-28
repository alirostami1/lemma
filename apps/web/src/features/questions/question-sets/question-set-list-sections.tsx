import { AsyncPanel } from "@lemma/ui/components/async-panel";
import { Button } from "@lemma/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lemma/ui/components/card";
import { EmptyState } from "@lemma/ui/components/empty-state";
import { InlineError } from "@lemma/ui/components/inline-error";
import { PageHeader } from "@lemma/ui/components/page-header";
import { PaginatedList } from "@lemma/ui/components/paginated-list";
import {
  ResourceList,
  ResourceListItem,
} from "@lemma/ui/components/resource-list";
import { Link } from "@tanstack/react-router";
import { ArrowRight, FilePlus2 } from "lucide-react";
import { CreateQuestionSetDialogController } from "../create-question-set-dialog";
import type { QuestionSetListController } from "./use-question-set-list-controller";

export function QuestionSetListHeader({
  viewModel,
}: Pick<QuestionSetListController, "viewModel">) {
  return (
    <PageHeader
      actions={<CreateQuestionSetDialogController />}
      description={viewModel.description}
      title={viewModel.title}
    />
  );
}

export function QuestionSetListSection({
  controller,
}: {
  controller: QuestionSetListController;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{controller.viewModel.sectionTitle}</CardTitle>
        <CardDescription>
          {controller.viewModel.sectionDescription}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AsyncPanel
          empty={
            <EmptyState
              action={
                <>
                  <CreateQuestionSetDialogController />
                  <Button asChild variant="outline">
                    <Link to="/studio">
                      <FilePlus2 />
                      Create blueprint
                    </Link>
                  </Button>
                </>
              }
              className="p-6"
              description={controller.viewModel.emptyDescription}
            />
          }
          error={(message) => (
            <InlineError message={message} onRetry={controller.onRetry} />
          )}
          errorMessage={controller.initialErrorMessage}
          isEmpty={controller.questionSets.length === 0}
          isLoading={controller.isInitialLoading}
          loading={<QuestionSetListSkeleton />}
        >
          <PaginatedList
            hasMore={controller.hasMore}
            isLoadingMore={controller.isLoadingMore}
            loadMoreErrorMessage={controller.loadMoreErrorMessage}
            onLoadMore={controller.onLoadMore}
            onRetryLoadMore={controller.onRetryLoadMore}
          >
            <ResourceList>
              {controller.viewModel.items.map((item) => (
                <ResourceListItem
                  key={item.id}
                  metadata={item.metadata}
                  navigationAccessory={
                    <ArrowRight className="size-4 text-muted-foreground" />
                  }
                  renderLink={(children, className) => (
                    <Link
                      aria-label={`Open ${item.title}`}
                      className={className}
                      params={{ questionSetId: item.id }}
                      to="/question-sets/$questionSetId"
                    >
                      {children}
                    </Link>
                  )}
                  title={item.title}
                  variant="navigation"
                />
              ))}
            </ResourceList>
          </PaginatedList>
        </AsyncPanel>
      </CardContent>
    </Card>
  );
}

function QuestionSetListSkeleton() {
  return (
    <output className="grid gap-2">
      <span className="sr-only">Loading question sets...</span>
      <div className="h-14 rounded-lg border bg-muted/30" />
      <div className="h-14 rounded-lg border bg-muted/30" />
      <div className="h-14 rounded-lg border bg-muted/30" />
    </output>
  );
}
