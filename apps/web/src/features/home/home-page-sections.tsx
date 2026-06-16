import { Button } from "@lemma/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@lemma/ui/components/card";
import { AsyncPanel } from "@lemma/ui/components/async-panel";
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

export function HomeHeroSection({
  hero,
}: {
  hero: HomePageViewModel["hero"];
}) {
  return (
    <Card>
      <CardHeader>
        <PageHeader
          title={hero.title}
          description={hero.description}
          size="launcher"
          actions={
            <>
              <HomeActionButton action={hero.primaryAction} />
              <HomeActionButton action={hero.secondaryAction} />
            </>
          }
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
          isLoading={isLoading && items.length === 0}
          errorMessage={errorMessage}
          isEmpty={items.length === 0}
          loading={<RecentWorkSectionSkeleton />}
          error={(message) => (
            <InlineError message={message} onRetry={onRetry} />
          )}
          empty={<EmptyState description={emptyMessage} />}
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
        <RecentItem key={item.id} item={item} />
      ))}
    </ResourceList>
  );
}

function RecentItem({ item }: { item: RecentHomeItem }) {
  return (
    <ResourceListItem
      variant="navigation"
      title={item.label}
      description={item.description}
      navigationAccessory={
        <ArrowRight className="size-4 text-muted-foreground" />
      }
      renderLink={(children, className) =>
        item.to === "/studio" ? (
          <Link to={item.to} search={item.search} className={className}>
            {children}
          </Link>
        ) : (
          <Link to={item.to} params={item.params} className={className}>
            {children}
          </Link>
        )
      }
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
      title={emptyState.title}
      description={emptyState.description}
      action={<HomeActionButton action={emptyState.action} />}
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
