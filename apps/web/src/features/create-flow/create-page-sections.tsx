import { AsyncPanel } from "@lemma/ui/components/async-panel";
import { Button } from "@lemma/ui/components/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@lemma/ui/components/card";
import { EmptyState } from "@lemma/ui/components/empty-state";
import { InlineError } from "@lemma/ui/components/inline-error";
import { PageHeader } from "@lemma/ui/components/page-header";
import {
  ResourceList,
  ResourceListItem,
} from "@lemma/ui/components/resource-list";
import { Skeleton } from "@lemma/ui/components/skeleton";
import { Link } from "@tanstack/react-router";
import { ArrowRight, FilePlus2, FolderOpen } from "lucide-react";
import type { ReactNode } from "react";
import { PrimaryActionPanel } from "#/components/patterns";
import type {
  CreateLauncherAction,
  CreateLauncherListItem,
  CreatePageViewModel,
} from "./create-page-view-model";

export function CreateHeroSection({
  hero,
}: {
  hero: CreatePageViewModel["hero"];
}) {
  return (
    <PageHeader
      title={hero.title}
      description={hero.description}
      size="launcher"
    />
  );
}

export function BlankBlueprintPanel({
  blankBlueprint,
}: {
  blankBlueprint: CreatePageViewModel["blankBlueprint"];
}) {
  return (
    <PrimaryActionPanel
      eyebrow="Recommended starting point"
      title={blankBlueprint.title}
      description={blankBlueprint.description}
      action={
        <LauncherActionButton
          action={blankBlueprint.action}
          icon={<FilePlus2 />}
          size="lg"
        />
      }
    />
  );
}

export function SavedBlueprintPanel({
  savedBlueprints,
  isLoading,
  errorMessage,
  onChoose,
  onRetry,
}: {
  savedBlueprints: CreatePageViewModel["savedBlueprints"];
  isLoading: boolean;
  errorMessage: string | null;
  onChoose(): void;
  onRetry(): void;
}) {
  return (
    <SecondaryLauncherPanel
      title={savedBlueprints.title}
      description={savedBlueprints.description}
      items={savedBlueprints.recentItems}
      isLoading={isLoading}
      errorMessage={errorMessage}
      emptyMessage={savedBlueprints.emptyMessage}
      footer={
        <Button type="button" variant="outline" onClick={onChoose}>
          <FolderOpen />
          {savedBlueprints.chooseLabel}
        </Button>
      }
      onRetry={onRetry}
    />
  );
}

function SecondaryLauncherPanel({
  title,
  description,
  items,
  isLoading,
  errorMessage,
  emptyMessage,
  footer,
  onRetry,
}: {
  title: string;
  description: string;
  items: CreateLauncherListItem[];
  isLoading: boolean;
  errorMessage: string | null;
  emptyMessage: string;
  footer: ReactNode;
  onRetry(): void;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="grid gap-3">
          <AsyncPanel
            isLoading={isLoading && items.length === 0}
            errorMessage={errorMessage}
            isEmpty={items.length === 0}
            loading={<CreateRecentListSkeleton />}
            error={(message) => (
              <InlineError message={message} onRetry={onRetry} />
            )}
            empty={<EmptyState description={emptyMessage} className="p-4" />}
          >
            <CreateLauncherItemList items={items} />
          </AsyncPanel>
          {errorMessage && items.length > 0 ? (
            <InlineError message={errorMessage} onRetry={onRetry} />
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="flex-wrap gap-2">{footer}</CardFooter>
    </Card>
  );
}

export function CreateLauncherItemList({
  items,
}: {
  items: ReadonlyArray<CreateLauncherListItem>;
}) {
  return (
    <ResourceList>
      {items.map((item) => (
        <CreateLauncherItem key={item.id} item={item} />
      ))}
    </ResourceList>
  );
}

export function CreateLauncherItem({ item }: { item: CreateLauncherListItem }) {
  return (
    <ResourceListItem
      variant="navigation"
      title={item.title}
      description={item.description}
      navigationAccessory={
        <ArrowRight className="size-4 text-muted-foreground" />
      }
      renderLink={(children, className) => (
        <Link
          to={item.action.to}
          search={item.action.search}
          aria-label={item.action.label}
          className={className}
        >
          {children}
        </Link>
      )}
    />
  );
}

export function CreateRecentListSkeleton() {
  return (
    <output className="grid gap-2">
      <span className="sr-only">Loading items...</span>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </output>
  );
}

function LauncherActionButton({
  action,
  icon,
  size,
}: {
  action: CreateLauncherAction;
  icon?: ReactNode;
  size?: "default" | "lg";
}) {
  return (
    <Button asChild size={size}>
      {"search" in action ? (
        <Link to={action.to} search={action.search}>
          {icon}
          {action.label}
        </Link>
      ) : (
        <Link to={action.to}>
          {icon}
          {action.label}
        </Link>
      )}
    </Button>
  );
}
