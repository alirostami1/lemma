import { Badge } from "@lemma/ui/components/badge";
import { Button } from "@lemma/ui/components/button";
import { Input } from "@lemma/ui/components/input";
import { InlineError } from "@lemma/ui/components/inline-error";
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
  Save,
  Sparkles,
  Undo2,
} from "lucide-react";
import type { ReactNode } from "react";

export type StudioCommandBarProps = {
  blueprintDescription: string;
  blueprintName: string;
  canGenerate: boolean;
  canRedo: boolean;
  canUndo: boolean;
  generateDisabledReason: string | null;
  isSaving: boolean;
  saveState: "saved" | "unsaved" | "saving" | "autosaved" | "failed";
  saveError: string | null;
  onBlueprintDescriptionChange(description: string): void;
  onBlueprintNameChange(name: string): void;
  onGenerate(): void;
  onOpenSaveDialog(): void;
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
  isSaving,
  saveState,
  saveError,
  onBlueprintDescriptionChange,
  onBlueprintNameChange,
  onGenerate,
  onOpenSaveDialog,
  onOpenSavedBlueprints,
  onReset,
  onRedo,
  onUndo,
}: StudioCommandBarProps) {
  const status = getSaveStatusView(saveState);
  const StatusIcon = status.Icon;

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
                id="studio-blueprint-name"
                aria-label="Blueprint name"
                className="h-9 font-medium"
                maxLength={160}
                value={blueprintName}
                onChange={(event) =>
                  onBlueprintNameChange(event.currentTarget.value)
                }
              />
              <label
                className="sr-only"
                htmlFor="studio-blueprint-description"
              >
                Blueprint description
              </label>
              <Input
                id="studio-blueprint-description"
                aria-label="Blueprint description"
                className="h-9"
                maxLength={500}
                placeholder="Description"
                value={blueprintDescription}
                onChange={(event) =>
                  onBlueprintDescriptionChange(event.currentTarget.value)
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:self-end">
            <ToolbarIconButton
              label="Saved blueprints"
              disabled={false}
              onClick={onOpenSavedBlueprints}
              icon={<FolderOpen />}
            />
            <ToolbarIconButton
              label="Undo"
              disabled={!canUndo}
              onClick={onUndo}
              icon={<Undo2 />}
            />
            <ToolbarIconButton
              label="Redo"
              disabled={!canRedo}
              onClick={onRedo}
              icon={<Redo2 />}
            />
            <ToolbarIconButton
              label="Reset Studio"
              disabled={false}
              onClick={onReset}
              icon={<RotateCcw />}
            />
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={!canGenerate}
              title={generateDisabledReason ?? undefined}
              onClick={onGenerate}
            >
              <Sparkles />
              Generate
            </Button>
            <Button
              type="button"
              size="lg"
              disabled={isSaving}
              onClick={onOpenSaveDialog}
            >
              <Save />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
        {saveError ? (
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
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function getSaveStatusView(
  saveState: StudioCommandBarProps["saveState"],
): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  Icon: typeof CheckCircle2;
} {
  switch (saveState) {
    case "saved":
      return { label: "Saved", variant: "secondary", Icon: CheckCircle2 };
    case "autosaved":
      return { label: "Autosaved locally", variant: "outline", Icon: Cloud };
    case "saving":
      return { label: "Saving...", variant: "outline", Icon: LoaderCircle };
    case "failed":
      return {
        label: "Save failed",
        variant: "destructive",
        Icon: AlertCircle,
      };
    case "unsaved":
      return {
        label: "Unsaved changes",
        variant: "outline",
        Icon: AlertCircle,
      };
  }
}
