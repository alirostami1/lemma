import { Badge } from "@lemma/ui/components/badge";
import { Button } from "@lemma/ui/components/button";
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
  Cloud,
  FolderOpen,
  LoaderCircle,
  Redo2,
  RotateCcw,
  Send,
  Sparkles,
  Undo2,
} from "lucide-react";
import type { ReactNode } from "react";
import type { StudioRouteSearch } from "./studio-controller-types";
import type { DraftSaveConflict } from "./use-studio-draft-save-controller";

export type StudioCommandBarProps = {
  blueprintDescription: string;
  blueprintName: string;
  canGenerate: boolean;
  canRedo: boolean;
  canUndo: boolean;
  generateDisabledReason: string | null;
  routeSearch: StudioRouteSearch;
  isSaving: boolean;
  isPublishing: boolean;
  saveState: "saved" | "unsaved" | "saving" | "autosaved" | "failed";
  saveError: string | null;
  saveConflict: DraftSaveConflict | null;
  onBlueprintDescriptionChange(description: string): void;
  onBlueprintNameChange(name: string): void;
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
  canGenerate,
  canRedo,
  canUndo,
  generateDisabledReason,
  routeSearch,
  isSaving,
  isPublishing,
  saveState,
  saveError,
  saveConflict,
  onBlueprintDescriptionChange,
  onBlueprintNameChange,
  onOpenPublishDialog,
  onReloadLatestDraft,
  onSaveDraft,
  onOpenSavedBlueprints,
  onReset,
  onRedo,
  onUndo,
}: StudioCommandBarProps) {
  const status = getSaveStatusLabel({ routeSearch, saveState });
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
        <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid min-w-0 flex-1 gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="text-base font-semibold">Studio</h1>
              <Badge variant={status.variant}>
                <StatusIcon />
                {status.label}
              </Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(12rem,24rem)_minmax(12rem,1fr)]">
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
              <label className="sr-only" htmlFor="studio-blueprint-description">
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
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:self-end">
            <ToolbarIconButton
              disabled={false}
              icon={<FolderOpen />}
              label="Saved blueprints"
              onClick={onOpenSavedBlueprints}
            />
            <ToolbarIconButton
              disabled={!canUndo}
              icon={<Undo2 />}
              label="Undo"
              onClick={onUndo}
            />
            <ToolbarIconButton
              disabled={!canRedo}
              icon={<Redo2 />}
              label="Redo"
              onClick={onRedo}
            />
            <ToolbarIconButton
              disabled={false}
              icon={<RotateCcw />}
              label="Reset Studio"
              onClick={onReset}
            />
            <Button
              disabled={isSaving || saveConflict !== null}
              onClick={onSaveDraft}
              size="lg"
              type="button"
              variant="outline"
            >
              <Cloud />
              Save
            </Button>
            <Button
              disabled={!canGenerate}
              size="lg"
              title={generateDisabledReason ?? undefined}
              type="button"
              variant="outline"
            >
              <Sparkles />
              Generate
            </Button>
            <Button
              disabled={isSaving || saveConflict !== null}
              onClick={onOpenPublishDialog}
              size="lg"
              type="button"
            >
              <Send />
              {publishButtonLabel}
            </Button>
          </div>
        </div>
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

function ToolbarIconButton({
  disabled,
  icon,
  label,
  onClick,
}: {
  disabled: boolean;
  icon: ReactNode;
  label: string;
  onClick(): void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          size="icon-lg"
          type="button"
          variant="outline"
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function getSaveStatusLabel(input: {
  routeSearch: StudioRouteSearch;
  saveState: StudioCommandBarProps["saveState"];
}): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  Icon: typeof CheckCircle2;
} {
  if (input.routeSearch.draftId) {
    if (input.saveState === "saving") {
      return {
        Icon: LoaderCircle,
        label: "Saving changes",
        variant: "outline",
      };
    }
    if (input.saveState === "failed") {
      return {
        Icon: AlertCircle,
        label: "Save failed",
        variant: "destructive",
      };
    }
    if (input.saveState === "saved") {
      return {
        Icon: CheckCircle2,
        label: "Changes saved",
        variant: "secondary",
      };
    }
    if (input.saveState === "autosaved") {
      return { Icon: Cloud, label: "Autosaved locally", variant: "outline" };
    }
    return {
      Icon: AlertCircle,
      label: "Unsaved changes",
      variant: "outline",
    };
  }

  if (input.routeSearch.blueprintId) {
    if (input.saveState === "saving") {
      return {
        Icon: LoaderCircle,
        label: "Saving changes",
        variant: "outline",
      };
    }
    if (input.saveState === "failed") {
      return {
        Icon: AlertCircle,
        label: "Save failed",
        variant: "destructive",
      };
    }
    if (input.saveState === "saved") {
      return {
        Icon: CheckCircle2,
        label: "Changes saved",
        variant: "secondary",
      };
    }
    if (input.saveState === "autosaved") {
      return {
        Icon: CheckCircle2,
        label: "Autosaved locally",
        variant: "outline",
      };
    }
    return {
      Icon: CheckCircle2,
      label: "Unsaved changes",
      variant: "outline",
    };
  }

  switch (input.saveState) {
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
