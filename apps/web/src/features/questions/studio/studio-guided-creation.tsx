import { Badge } from "@lemma/ui/components/badge";
import { Button } from "@lemma/ui/components/button";
import { CheckCircle2, Circle, CircleDot, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  type ComposedEditorModel,
  extractUsedReferenceIdsFromComposedEditorModel,
} from "#/domains/questions/authoring";
import type { StudioReadiness } from "./studio-readiness";

const STORAGE_KEY = "lemma.studio.guidedCreation.dismissed";

type StudioGuidedCreationMode = "hidden" | "callout" | "guide";

export type StudioGuidedCreationState = {
  mode: StudioGuidedCreationMode;
  onDismiss(): void;
  onOpen(): void;
};

export type StudioGuidedCreationStepStatus =
  | "complete"
  | "current"
  | "not_started"
  | "optional";

export type StudioGuidedCreationStep = {
  body: string;
  id: "setup" | "blocks" | "add_reference" | "review" | "save";
  status: StudioGuidedCreationStepStatus;
  title: string;
};

export type StudioGuidedCreationViewModel = {
  calloutBody: string;
  calloutTitle: string;
  steps: StudioGuidedCreationStep[];
};

export function useStudioGuidedCreationState(): StudioGuidedCreationState {
  const [mode, setMode] = useState<StudioGuidedCreationMode>("hidden");

  useEffect(() => {
    if (!isGuideDismissed()) {
      setMode("callout");
    }
  }, []);

  const onDismiss = useCallback(() => {
    setMode("hidden");
    setGuideDismissed();
  }, []);

  const onOpen = useCallback(() => {
    setMode("guide");
  }, []);

  return { mode, onDismiss, onOpen };
}

export function StudioGuidedCreationCallout({
  onDismiss,
  onViewGuide,
  viewModel,
}: {
  onDismiss(): void;
  onViewGuide(): void;
  viewModel: StudioGuidedCreationViewModel;
}) {
  return (
    <section
      aria-label="Guided creation"
      className="rounded-lg border bg-muted/15 p-3 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">{viewModel.calloutTitle}</h2>
            <Badge variant="secondary">Optional</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {viewModel.calloutBody}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            onClick={onViewGuide}
            size="sm"
            type="button"
            variant="outline"
          >
            View guide
          </Button>
          <Button
            aria-label="Dismiss guided creation"
            className="size-8 rounded-md"
            onClick={onDismiss}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X />
          </Button>
        </div>
      </div>
    </section>
  );
}

export function StudioGuidedCreationPanel({
  onDismiss,
  viewModel,
}: {
  onDismiss(): void;
  viewModel: StudioGuidedCreationViewModel;
}) {
  return (
    <section
      aria-label="Guided creation"
      className="rounded-lg border bg-background p-3 shadow-sm sm:p-4"
    >
      <div className="grid gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">Guided creation</h2>
              <Badge variant="secondary">Optional</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Use this as a quick map while you work.
            </p>
          </div>
          <Button
            aria-label="Dismiss guided creation"
            className="size-8 shrink-0 rounded-md"
            onClick={onDismiss}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X />
          </Button>
        </div>

        <ol className="grid gap-2">
          {viewModel.steps.map((step) => (
            <li
              aria-current={step.status === "current" ? "step" : undefined}
              className="grid gap-1 rounded-lg border bg-muted/15 p-3 sm:grid-cols-[minmax(10rem,14rem)_1fr] sm:items-center"
              key={step.id}
            >
              <div className="flex min-w-0 items-center gap-2">
                <GuidedStepIcon status={step.status} />
                <span className="truncate text-sm font-medium">
                  {step.title}
                </span>
                <Badge className="shrink-0" variant="outline">
                  {getStepStatusLabel(step.status)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function createStudioGuidedCreationViewModel(input: {
  model: ComposedEditorModel;
  readiness: StudioReadiness;
  saveState: "saved" | "unsaved" | "saving" | "autosaved" | "failed";
}): StudioGuidedCreationViewModel {
  const issueIds = new Set(input.readiness.issues.map((issue) => issue.id));
  const setupComplete = !issueIds.has("missing_blueprint_name");
  const blocksComplete = !issueIds.has("missing_blocks");
  const reviewComplete = input.readiness.canSave;
  const saveComplete = input.saveState === "saved";
  const usedReferenceCount = extractUsedReferenceIdsFromComposedEditorModel(
    input.model,
  ).length;
  const stepDefinitions: Array<{
    body: string;
    complete: boolean;
    id: StudioGuidedCreationStep["id"];
    optional?: boolean;
    title: string;
  }> = [
    {
      body: "Name the blueprint from the details control.",
      complete: setupComplete,
      id: "setup",
      title: "Setup",
    },
    {
      body: "Add text, answer, table, or divider blocks.",
      complete: blocksComplete,
      id: "blocks",
      title: "Blocks",
    },
    {
      body: "Use Add reference only when a block needs a workbook value or fixed value.",
      complete: usedReferenceCount > 0,
      id: "add_reference",
      optional: usedReferenceCount === 0,
      title: "Add reference",
    },
    {
      body: "Check the blueprint and fix any messages that need attention.",
      complete: reviewComplete,
      id: "review",
      title: "Review",
    },
    {
      body: getSaveStepBody(input.saveState),
      complete: saveComplete,
      id: "save",
      title: "Save",
    },
  ];
  const currentStepId = getCurrentGuidedCreationStepId({
    blocksComplete,
    reviewComplete,
    saveComplete,
    setupComplete,
  });
  const steps: StudioGuidedCreationStep[] = stepDefinitions.map((step) => ({
    body: step.body,
    id: step.id,
    status: getStepStatus(step, currentStepId),
    title: step.title,
  }));

  const currentStep = steps.find((step) => step.status === "current");
  if (!currentStep) {
    return {
      calloutBody: saveComplete
        ? "Your blueprint is saved. Keep editing, or publish when you are ready."
        : "Keep editing directly, or open the guide for a quick map.",
      calloutTitle: "Guided creation",
      steps,
    };
  }

  return {
    calloutBody: currentStep.body,
    calloutTitle: `Next: ${currentStep.title}`,
    steps,
  };
}

function getCurrentGuidedCreationStepId(input: {
  blocksComplete: boolean;
  reviewComplete: boolean;
  saveComplete: boolean;
  setupComplete: boolean;
}): StudioGuidedCreationStep["id"] | null {
  if (!input.setupComplete) {
    return "setup";
  }

  if (!input.blocksComplete) {
    return "blocks";
  }

  if (!input.reviewComplete) {
    return "review";
  }

  if (!input.saveComplete) {
    return "save";
  }

  return null;
}

function getStepStatus(
  step: {
    complete: boolean;
    id: StudioGuidedCreationStep["id"];
    optional?: boolean;
  },
  currentStepId: StudioGuidedCreationStep["id"] | null,
): StudioGuidedCreationStepStatus {
  if (step.complete) {
    return "complete";
  }

  if (step.optional) {
    return "optional";
  }

  return step.id === currentStepId ? "current" : "not_started";
}

function GuidedStepIcon({
  status,
}: {
  status: StudioGuidedCreationStepStatus;
}) {
  if (status === "complete") {
    return <CheckCircle2 aria-hidden="true" className="size-4 text-primary" />;
  }

  if (status === "current") {
    return <CircleDot aria-hidden="true" className="size-4 text-primary" />;
  }

  return <Circle aria-hidden="true" className="size-4 text-muted-foreground" />;
}

function getStepStatusLabel(status: StudioGuidedCreationStepStatus) {
  switch (status) {
    case "complete":
      return "Complete";
    case "current":
      return "Current step";
    case "not_started":
      return "Not started";
    case "optional":
      return "Optional";
  }
}

function getSaveStepBody(
  saveState: "saved" | "unsaved" | "saving" | "autosaved" | "failed",
) {
  switch (saveState) {
    case "saved":
      return "Saved.";
    case "saving":
      return "Saving now.";
    case "failed":
      return "Try saving again when the issue is fixed.";
    case "autosaved":
    case "unsaved":
      return "Save when the blueprint is ready.";
  }
}

function isGuideDismissed() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setGuideDismissed() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Local preference persistence is best-effort.
  }
}
