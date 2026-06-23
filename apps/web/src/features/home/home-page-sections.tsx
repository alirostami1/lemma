import { AsyncPanel } from "@lemma/ui/components/async-panel";
import { Button } from "@lemma/ui/components/button";
import { Card, CardContent, CardHeader } from "@lemma/ui/components/card";
import { EmptyState } from "@lemma/ui/components/empty-state";
import { InlineError } from "@lemma/ui/components/inline-error";
import { PageHeader } from "@lemma/ui/components/page-header";
import {
  ResourceList,
  ResourceListItem,
} from "@lemma/ui/components/resource-list";
import { Skeleton } from "@lemma/ui/components/skeleton";
import { Link } from "@tanstack/react-router";
import { ArrowRight, FilePlus2, ListChecks } from "lucide-react";
import { PrimaryActionPanel } from "#/components/patterns";
import type {
  HomeAction,
  HomePageViewModel,
  RecentHomeItem,
} from "./home-page-view-model";

export function HomeHeroSection({ hero }: { hero: HomePageViewModel["hero"] }) {
  return (
    <Card>
      <CardHeader>
        <PageHeader
          actions={
            <>
              <HomeActionButton action={hero.primaryAction} />
              <HomeActionButton action={hero.secondaryAction} />
            </>
          }
          description={hero.description}
          size="launcher"
          title={hero.title}
        />
      </CardHeader>
    </Card>
  );
}

export function RecentWorkSection({
  title,
  action,
  items,
  isLoading,
  errorMessage,
  emptyMessage,
  onRetry,
}: {
  title: string;
  action?: HomeAction;
  items: RecentHomeItem[];
  isLoading: boolean;
  errorMessage: string | null;
  emptyMessage: string;
  onRetry(): void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {action ? <HomeActionButton action={action} /> : null}
        </div>
      </CardHeader>
      <CardContent>
        <AsyncPanel
          empty={<EmptyState description={emptyMessage} />}
          error={(message) => (
            <InlineError message={message} onRetry={onRetry} />
          )}
          errorMessage={errorMessage}
          isEmpty={items.length === 0}
          isLoading={isLoading && items.length === 0}
          loading={<RecentWorkSectionSkeleton />}
        >
          <RecentItemList items={items} />
        </AsyncPanel>
        {errorMessage && items.length > 0 ? (
          <div className="pt-3">
            <InlineError message={errorMessage} onRetry={onRetry} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function RecentItemList({ items }: { items: RecentHomeItem[] }) {
  return (
    <ResourceList>
      {items.map((item) => (
        <RecentItem item={item} key={item.id} />
      ))}
    </ResourceList>
  );
}

function RecentItem({ item }: { item: RecentHomeItem }) {
  return (
    <ResourceListItem
      description={item.description}
      navigationAccessory={
        <ArrowRight className="size-4 text-muted-foreground" />
      }
      renderLink={(children, className) =>
        item.to === "/studio" ? (
          <Link className={className} search={item.search} to={item.to}>
            {children}
          </Link>
        ) : (
          <Link className={className} params={item.params} to={item.to}>
            {children}
          </Link>
        )
      }
      title={item.label}
      variant="navigation"
    />
  );
}

export function HomeEmptyState({
  emptyState,
}: {
  emptyState: NonNullable<HomePageViewModel["emptyState"]>;
}) {
  return (
    <PrimaryActionPanel
      action={<HomeActionButton action={emptyState.action} />}
      description={emptyState.description}
      title={emptyState.title}
    />
  );
}

export function RecentWorkSectionSkeleton() {
  return (
    <output className="grid gap-3">
      <span className="sr-only">Loading recent items...</span>
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </output>
  );
}

function HomeActionButton({ action }: { action: HomeAction }) {
  const icon =
    action.to === "/question-sets" ? (
      <ListChecks />
    ) : action.to === "/create" ? (
      <FilePlus2 />
    ) : null;

  return (
    <Button
      asChild
      variant={action.variant === "primary" ? "default" : "outline"}
    >
      <Link to={action.to}>
        {icon}
        {action.label}
      </Link>
    </Button>
  );
}
