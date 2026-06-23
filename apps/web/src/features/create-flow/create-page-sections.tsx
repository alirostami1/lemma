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
      description={hero.description}
      size="launcher"
      title={hero.title}
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
      action={
        <LauncherActionButton
          action={blankBlueprint.action}
          icon={<FilePlus2 />}
          size="lg"
        />
      }
      description={blankBlueprint.description}
      eyebrow="Recommended starting point"
      title={blankBlueprint.title}
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
      description={savedBlueprints.description}
      emptyMessage={savedBlueprints.emptyMessage}
      errorMessage={errorMessage}
      footer={
        <Button onClick={onChoose} type="button" variant="outline">
          <FolderOpen />
          {savedBlueprints.chooseLabel}
        </Button>
      }
      isLoading={isLoading}
      items={savedBlueprints.recentItems}
      onRetry={onRetry}
      title={savedBlueprints.title}
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
            empty={<EmptyState className="p-4" description={emptyMessage} />}
            error={(message) => (
              <InlineError message={message} onRetry={onRetry} />
            )}
            errorMessage={errorMessage}
            isEmpty={items.length === 0}
            isLoading={isLoading && items.length === 0}
            loading={
              <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                Loading saved blueprints...
              </div>
            }
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
        <CreateLauncherItem item={item} key={item.id} />
      ))}
    </ResourceList>
  );
}

export function CreateLauncherItem({ item }: { item: CreateLauncherListItem }) {
  return (
    <ResourceListItem
      description={item.description}
      navigationAccessory={
        <ArrowRight className="size-4 text-muted-foreground" />
      }
      renderLink={(children, className) => (
        <Link
          aria-label={item.action.label}
          className={className}
          search={item.action.search}
          to={item.action.to}
        >
          {children}
        </Link>
      )}
      title={item.title}
      variant="navigation"
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
        <Link search={action.search} to={action.to}>
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
