import { Badge } from "@lemma/ui/components/badge";
import { Button } from "@lemma/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@lemma/ui/components/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@lemma/ui/components/dropdown-menu";
import { InlineError } from "@lemma/ui/components/inline-error";
import { Input } from "@lemma/ui/components/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@lemma/ui/components/tooltip";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Cloud,
  FolderOpen,
  ListChecks,
  LoaderCircle,
  MoreHorizontal,
  Redo2,
  RotateCcw,
  Send,
  Sparkles,
  Undo2,
} from "lucide-react";
import { ContextualHelpPopover } from "../shared/contextual-help-popover";
import type { StudioGenerationAction } from "./studio-controller-types";
import type { DraftSaveConflict } from "./use-studio-draft-save-controller";

export type StudioCommandBarProps = {
  blueprintDescription: string;
  blueprintName: string;
  canRedo: boolean;
  canUndo: boolean;
  generationAction: StudioGenerationAction;
  isSaving: boolean;
  isPublishing: boolean;
  saveState: "saved" | "unsaved" | "saving" | "autosaved" | "failed";
  saveError: string | null;
  saveConflict: DraftSaveConflict | null;
  onBlueprintDescriptionChange(description: string): void;
  onBlueprintNameChange(name: string): void;
  onOpenGuide?: () => void;
  onOpenPublishDialog(): void;
  onReloadLatestDraft(): void;
  onSaveDraft(): void;
  onOpenSavedBlueprints(): void;
  onReset(): void;
  onRedo(): void;
  onUndo(): void;
};

export function StudioCommandBar({
  blueprintDescription,
  blueprintName,
  canRedo,
  canUndo,
  generationAction,
  isSaving,
  isPublishing,
  saveState,
  saveError,
  saveConflict,
  onBlueprintDescriptionChange,
  onBlueprintNameChange,
  onOpenGuide,
  onOpenPublishDialog,
  onReloadLatestDraft,
  onSaveDraft,
  onOpenSavedBlueprints,
  onReset,
  onRedo,
  onUndo,
}: StudioCommandBarProps) {
  const status = getSaveStatusLabel(saveState);
  const StatusIcon = status.Icon;
  let publishButtonLabel = "Publish";
  if (isPublishing) {
    publishButtonLabel = "Publishing...";
  } else if (isSaving) {
    publishButtonLabel = "Saving...";
  }

  return (
    <TooltipProvider>
      <section className="rounded-lg border bg-background/95 shadow-sm">
        <Collapsible>
          <div className="flex flex-col gap-2 p-2 sm:p-3">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <CollapsibleTrigger asChild>
                  <Button
                    aria-label="Blueprint details"
                    className="size-8 shrink-0 rounded-md"
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <ChevronDown />
                  </Button>
                </CollapsibleTrigger>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h1 className="truncate text-base font-semibold">
                      {blueprintName || "Studio"}
                    </h1>
                    <Badge
                      className="hidden shrink-0 sm:inline-flex"
                      variant={status.variant}
                    >
                      <StatusIcon />
                      {status.label}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <Button
                  disabled={isSaving || saveConflict !== null}
                  onClick={onSaveDraft}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Cloud />
                  Save
                </Button>
                <Button
                  disabled={isSaving || saveConflict !== null}
                  onClick={onOpenPublishDialog}
                  size="sm"
                  type="button"
                >
                  <Send />
                  {publishButtonLabel}
                </Button>
                <ContextualHelpPopover
                  label="Help for saving and publishing"
                  title="Save and publish"
                >
                  Save keeps your current work available later. Publish makes
                  the blueprint available for use after you review the name,
                  blocks, and added values.
                </ContextualHelpPopover>
                <SecondaryActionsMenu
                  canRedo={canRedo}
                  canUndo={canUndo}
                  generationAction={generationAction}
                  onOpenGuide={onOpenGuide}
                  onOpenSavedBlueprints={onOpenSavedBlueprints}
                  onRedo={onRedo}
                  onReset={onReset}
                  onUndo={onUndo}
                />
              </div>
            </div>

            <CollapsibleContent>
              <div className="grid gap-2 border-t pt-3 sm:grid-cols-[minmax(12rem,24rem)_minmax(12rem,1fr)]">
                <label className="sr-only" htmlFor="studio-blueprint-name">
                  Blueprint name
                </label>
                <Input
                  aria-label="Blueprint name"
                  className="h-9 font-medium"
                  id="studio-blueprint-name"
                  maxLength={160}
                  onChange={(event) =>
                    onBlueprintNameChange(event.currentTarget.value)
                  }
                  value={blueprintName}
                />
                <label
                  className="sr-only"
                  htmlFor="studio-blueprint-description"
                >
                  Blueprint description
                </label>
                <Input
                  aria-label="Blueprint description"
                  className="h-9"
                  id="studio-blueprint-description"
                  maxLength={500}
                  onChange={(event) =>
                    onBlueprintDescriptionChange(event.currentTarget.value)
                  }
                  placeholder="Description"
                  value={blueprintDescription}
                />
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
        {saveConflict ? (
          <div className="grid gap-3 border-t p-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <InlineError message={saveConflict.message} />
            <Button
              onClick={onReloadLatestDraft}
              type="button"
              variant="destructive"
            >
              Reload latest work
            </Button>
          </div>
        ) : saveError ? (
          <div className="border-t p-3">
            <InlineError message={saveError} />
          </div>
        ) : null}
      </section>
    </TooltipProvider>
  );
}

function SecondaryActionsMenu({
  canRedo,
  canUndo,
  generationAction,
  onOpenGuide,
  onOpenSavedBlueprints,
  onReset,
  onRedo,
  onUndo,
}: {
  canRedo: boolean;
  canUndo: boolean;
  generationAction: StudioGenerationAction;
  onOpenGuide?: () => void;
  onOpenSavedBlueprints(): void;
  onReset(): void;
  onRedo(): void;
  onUndo(): void;
}) {
  const generateDisabled =
    !generationAction.available || !generationAction.onGenerate;
  const generateDisabledReason =
    generationAction.disabledReason ?? "Generation is unavailable.";

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="More workspace actions"
              className="size-8 rounded-md"
              size="icon"
              type="button"
              variant="outline"
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>More workspace actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem className="gap-2" onSelect={onOpenSavedBlueprints}>
          <FolderOpen className="size-4" />
          Saved blueprints
        </DropdownMenuItem>
        {onOpenGuide ? (
          <DropdownMenuItem className="gap-2" onSelect={onOpenGuide}>
            <ListChecks className="size-4" />
            Guided creation
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2"
          disabled={!canUndo}
          onSelect={onUndo}
        >
          <Undo2 className="size-4" />
          Undo
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2"
          disabled={!canRedo}
          onSelect={onRedo}
        >
          <Redo2 className="size-4" />
          Redo
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          aria-describedby={
            generateDisabled ? "studio-generate-disabled-reason" : undefined
          }
          aria-label="Generate"
          className="items-start gap-2"
          disabled={generateDisabled}
          onSelect={
            generateDisabled
              ? undefined
              : (generationAction.onGenerate ?? undefined)
          }
        >
          <Sparkles className="mt-0.5 size-4" />
          <span className="grid gap-0.5">
            <span>Generate</span>
            {generateDisabled ? (
              <span
                className="text-xs text-muted-foreground"
                id="studio-generate-disabled-reason"
              >
                {generateDisabledReason}
              </span>
            ) : null}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onSelect={onReset}>
          <RotateCcw className="size-4" />
          Reset workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getSaveStatusLabel(saveState: StudioCommandBarProps["saveState"]): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  Icon: typeof CheckCircle2;
} {
  switch (saveState) {
    case "saved":
      return {
        Icon: CheckCircle2,
        label: "Changes saved",
        variant: "outline",
      };
    case "autosaved":
      return { Icon: Cloud, label: "Autosaved locally", variant: "outline" };
    case "saving":
      return {
        Icon: LoaderCircle,
        label: "Saving changes",
        variant: "outline",
      };
    case "failed":
      return {
        Icon: AlertCircle,
        label: "Save failed",
        variant: "destructive",
      };
    case "unsaved":
      return {
        Icon: AlertCircle,
        label: "Unsaved changes",
        variant: "outline",
      };
  }
}
