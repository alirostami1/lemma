import { EmptyState } from "@lemma/ui/components/empty-state";
import { InlineError } from "@lemma/ui/components/inline-error";
import {
  ResourceList,
  ResourceListItem,
} from "@lemma/ui/components/resource-list";
import { Skeleton } from "@lemma/ui/components/skeleton";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { QuestionListItemViewModel } from "./question-list-view-model";

export type QuestionSetQuestionListProps = {
  questionSetId: string;
  items: QuestionListItemViewModel[];
  isLoading: boolean;
  isError?: boolean;
};

export function QuestionSetQuestionList({
  questionSetId,
  items,
  isLoading,
  isError = false,
}: QuestionSetQuestionListProps) {
  if (isLoading) {
    return <QuestionSetQuestionListSkeleton />;
  }

  if (isError) {
    return <InlineError message="Generated questions could not be loaded." />;
  }

  if (items.length === 0) {
    return (
      <EmptyState description="Generate questions from a blueprint to see them here." />
    );
  }

  return (
    <ResourceList>
      {items.map((item) => (
        <ResourceListItem
          description={item.description}
          key={item.id}
          metadata={item.metadata}
          navigationAccessory={
            <ArrowRight className="size-4 text-muted-foreground" />
          }
          renderLink={(children, className) => (
            <Link
              aria-label={`Open ${item.title}`}
              className={className}
              params={{ questionId: item.id, questionSetId }}
              to="/question-sets/$questionSetId/questions/$questionId"
            >
              {children}
            </Link>
          )}
          title={item.title}
          variant="navigation"
        />
      ))}
    </ResourceList>
  );
}

function QuestionSetQuestionListSkeleton() {
  return (
    <output className="grid gap-2">
      <span className="sr-only">Loading generated questions...</span>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </output>
  );
}
