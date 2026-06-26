import { Button } from "@lemma/ui/components/button";
import { InlineError } from "@lemma/ui/components/inline-error";
import { Link, useNavigate } from "@tanstack/react-router";
import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PageContainer } from "#/components/patterns";
import { useQuestionBlueprintDraftQuery } from "#/domains/questions";
import { ComposedQuestionEditor } from "#/features/questions/composed-editor";
import { WorkbookPickerProvider } from "#/features/questions/table-block-editor";
import { WorkbookPickerDialog } from "../workbook-picker-dialog";
import { PublishDraftDialog } from "./publish-draft-dialog";
import { SavedBlueprintsDialog } from "./saved-blueprints-dialog";
import { StudioSourceList } from "./source/studio-source-list";
import { StudioSourcePickerDialog } from "./source/studio-source-picker-dialog";
import { StudioCommandBar } from "./studio-command-bar";
import type { StudioController } from "./studio-controller-types";
import {
  StudioDraftRecoveryDialog,
  StudioResetConfirmationDialog,
} from "./studio-draft-recovery-dialog";
import { StudioLandingPage } from "./studio-landing-page";
import {
  isStudioRouteNormalized,
  parseStudioRouteIntent,
  type StudioRouteIntent,
} from "./studio-route-intent";
import {
  type StudioRouteSearch,
  useStudioController,
} from "./use-studio-controller";
import { useStudioEntryRoute } from "./use-studio-entry-route";

export type { StudioRouteSearch };

const stickyInspectorGap = 16;
const initialStickyRegionBottom = 176;

export function StudioPage(input: StudioRouteSearch = {}) {
  const routeIntent = parseStudioRouteIntent(input);

  if (routeIntent.type === "landing") {
    return <StudioLandingPage />;
  }

  if (routeIntent.type === "edit_draft") {
    if (!isStudioRouteNormalized(input)) {
      return <StudioDraftRouteNormalize draftId={routeIntent.draftId} />;
    }
    return <StudioDraftRouteGate draftId={routeIntent.draftId} input={input} />;
  }

  if (
    routeIntent.type === "new_draft" ||
    routeIntent.type === "edit_blueprint"
  ) {
    return <StudioEntryRouteView intent={routeIntent} />;
  }

  return null;
}

function StudioDraftRouteNormalize({ draftId }: { draftId: string }) {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({
      replace: true,
      search: { draftId },
      to: "/studio",
    });
  }, [draftId, navigate]);

  return (
    <PageContainer className="pb-8" variant="workbench">
      <section className="grid gap-3 rounded-lg border bg-background p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Studio</h1>
        <p className="text-sm text-muted-foreground">Opening blueprint...</p>
      </section>
    </PageContainer>
  );
}

function StudioDraftRouteGate({
  draftId,
  input,
}: {
  draftId: string;
  input: StudioRouteSearch;
}) {
  const draftQuery = useQuestionBlueprintDraftQuery(draftId);
  const draft = draftQuery.data?.draft ?? null;

  if (draftQuery.isLoading) {
    return (
      <PageContainer className="pb-8" variant="workbench">
        <section className="grid gap-3 rounded-lg border bg-background p-6 shadow-sm">
          <h1 className="text-lg font-semibold">Studio</h1>
          <p className="text-sm text-muted-foreground">Loading blueprint...</p>
        </section>
      </PageContainer>
    );
  }

  if (draftQuery.isError) {
    return (
      <PageContainer className="pb-8" variant="workbench">
        <section className="grid gap-3 rounded-lg border bg-background p-6 shadow-sm">
          <h1 className="text-lg font-semibold">Blueprint unavailable</h1>
          <InlineError message="This blueprint could not be loaded." />
          <Button
            onClick={() => {
              void draftQuery.refetch();
            }}
            type="button"
            variant="outline"
          >
            Retry
          </Button>
          <Button asChild variant="outline">
            <Link to="/studio">Continue where you left off</Link>
          </Button>
        </section>
      </PageContainer>
    );
  }

  if (draft && draft.status !== "draft") {
    return (
      <StudioTerminalDraftView
        blueprintId={draft.blueprintId}
        draftName={draft.name}
        onReload={() => {
          void draftQuery.refetch();
        }}
        status={draft.status}
      />
    );
  }

  return <StudioEditorEntry input={input} />;
}

function StudioTerminalDraftView({
  blueprintId,
  draftName,
  onReload,
  status,
}: {
  blueprintId: string | null;
  draftName: string;
  onReload?: () => void;
  status: "publishing" | "published" | "discarded";
}) {
  const view = getTerminalDraftView(status);

  return (
    <PageContainer className="pb-8" variant="workbench">
      <section className="grid gap-4 rounded-lg border bg-background p-6 shadow-sm">
        <div className="grid gap-1">
          <p className="text-sm font-medium text-muted-foreground">Studio</p>
          <h1 className="text-xl font-semibold">{view.title}</h1>
          <p className="text-sm text-muted-foreground">
            {draftName}: {view.description}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {status === "published" && blueprintId ? (
            <Button asChild>
              <Link
                params={{ questionBlueprintId: blueprintId }}
                to="/question-blueprints/$questionBlueprintId"
              >
                Open published blueprint
              </Link>
            </Button>
          ) : null}
          {status === "published" && blueprintId ? (
            <Button asChild variant="outline">
              <Link search={{ blueprintId }} to="/studio">
                Edit this blueprint
              </Link>
            </Button>
          ) : status === "publishing" ? (
            <>
              <Button onClick={onReload} type="button" variant="outline">
                Check again
              </Button>
              <Button asChild variant="outline">
                <Link to="/studio">Back to Studio</Link>
              </Button>
            </>
          ) : status === "discarded" ? (
            <>
              <Button asChild variant="outline">
                <Link search={{ new: "1" }} to="/studio">
                  Start a new blueprint
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/studio">Continue where you left off</Link>
              </Button>
            </>
          ) : (
            <Button asChild variant="outline">
              <Link search={{ new: "1" }} to="/studio">
                Start a new blueprint
              </Link>
            </Button>
          )}
        </div>
      </section>
    </PageContainer>
  );
}

function getTerminalDraftView(
  status: "publishing" | "published" | "discarded",
) {
  switch (status) {
    case "publishing":
      return {
        description: "This work is temporarily unavailable while publishing.",
        title: "Blueprint is being published",
      };
    case "published":
      return {
        description:
          "This version has already been published and cannot be edited here.",
        title: "Blueprint published",
      };
    case "discarded":
      return {
        description: "This work is no longer available for editing.",
        title: "Blueprint unavailable",
      };
  }
}

function StudioEditorEntry({ input }: { input: StudioRouteSearch }) {
  const studio = useStudioController(input);
  if (studio.draftLoadState.status === "loading") {
    return <StudioDraftLoadingScreen />;
  }

  if (
    studio.draftLoadState.status === "document_error" ||
    studio.draftLoadState.status === "query_error"
  ) {
    return (
      <StudioDraftLoadErrorScreen
        message={studio.draftLoadState.message}
        onReloadLatestDraft={studio.commandBar.onReloadLatestDraft}
        variant={studio.draftLoadState.status}
      />
    );
  }

  return <StudioEditorWorkbench studio={studio} />;
}

function StudioDraftLoadingScreen() {
  return (
    <PageContainer className="pb-8" variant="workbench">
      <section className="grid gap-3 rounded-lg border bg-background p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Studio</h1>
        <p className="text-sm text-muted-foreground">Loading blueprint...</p>
      </section>
    </PageContainer>
  );
}

function StudioDraftLoadErrorScreen({
  message,
  onReloadLatestDraft,
  variant,
}: {
  message: string;
  onReloadLatestDraft(): void;
  variant: "document_error" | "query_error";
}) {
  return (
    <PageContainer className="pb-8" variant="workbench">
      <section className="grid gap-4 rounded-lg border bg-background p-6 shadow-sm">
        <div className="grid gap-1">
          <h1 className="text-xl font-semibold">{message}</h1>
          <p className="text-sm text-muted-foreground">
            {variant === "document_error"
              ? "This blueprint contains an unsupported or invalid document structure."
              : "This blueprint is unavailable right now."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onReloadLatestDraft} type="button" variant="outline">
            Reload latest version
          </Button>
          <Button asChild variant="outline">
            <Link to="/studio">Back to Studio</Link>
          </Button>
        </div>
      </section>
    </PageContainer>
  );
}

function StudioEntryRouteView({
  intent,
}: {
  intent: Exclude<StudioRouteIntent, { type: "landing" | "edit_draft" }>;
}) {
  const navigate = useNavigate();
  const entryRoute = useStudioEntryRoute({
    intent,
    navigate,
  });
  const message =
    intent.type === "edit_blueprint"
      ? "Opening blueprint..."
      : intent.type === "new_draft"
        ? "Starting blueprint..."
        : "Opening blueprint...";

  return (
    <PageContainer className="pb-8" variant="workbench">
      <section className="grid gap-3 rounded-lg border bg-background p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Studio</h1>
        {entryRoute.errorMessage ? (
          <InlineError message={entryRoute.errorMessage} />
        ) : (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </section>
    </PageContainer>
  );
}

function StudioEditorWorkbench({ studio }: { studio: StudioController }) {
  const stickyRegionRef = useRef<HTMLDivElement>(null);
  const [isSourcePanelExpanded, setIsSourcePanelExpanded] = useState(false);
  const stickyRegionBottom = useStickyRegionBottom(stickyRegionRef);
  const inspectorStickyOffset = stickyRegionBottom + stickyInspectorGap;

  return (
    <WorkbookPickerProvider
      value={{ openWorkbookPicker: studio.workbookPicker.openWorkbookPicker }}
    >
      <PageContainer className="pb-8" variant="workbench">
        <div
          className="sticky top-0 z-30 grid gap-2 bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
          ref={stickyRegionRef}
        >
          <StudioCommandBar {...studio.commandBar} />
          <StudioSourceList
            isExpanded={isSourcePanelExpanded}
            onAddSource={studio.source.actions.addSource}
            onExpandedChange={setIsSourcePanelExpanded}
            onReattachSource={studio.source.actions.reattachSource}
            onRemoveSource={studio.source.actions.removeSource}
            sources={studio.source.sources}
            usageBySourceId={studio.source.usageBySourceId}
          />
        </div>

        <section className="rounded-lg border bg-background p-3 shadow-sm sm:p-4">
          <div className="max-w-none">
            <ComposedQuestionEditor
              inspectorStickyOffset={inspectorStickyOffset}
              model={studio.editor.authoringModel}
              onModelChange={studio.editor.onAuthoringModelChange}
              referencePreviewCache={studio.editor.referencePreviewCache}
              sources={studio.editor.sources}
              workbookSheetNamesBySourceId={
                studio.editor.workbookSheetNamesBySourceId
              }
            />
          </div>
        </section>

        <StudioDraftRecoveryDialog {...studio.draftRecovery} />
        <StudioResetConfirmationDialog {...studio.resetConfirmation} />
        <PublishDraftDialog {...studio.publishDialog} />
        <StudioSourcePickerDialog
          existingSources={studio.source.sources}
          onCreateSource={studio.source.actions.createSource}
          onOpenChange={studio.sourcePicker.onOpenChange}
          open={studio.sourcePicker.open}
        />
        <SavedBlueprintsDialog {...studio.savedBlueprints} />
        <WorkbookPickerDialog
          fileName={studio.workbookPicker.fileName}
          hasMoreSheets={studio.workbookPicker.hasMoreWorkbookSheets}
          isLoadingMoreSheets={
            studio.workbookPicker.isLoadingMoreWorkbookSheets
          }
          localWorkbook={studio.workbookPicker.localWorkbook}
          onLoadMoreSheets={studio.workbookPicker.onLoadMoreWorkbookSheets}
          onOpenChange={studio.workbookPicker.onOpenChange}
          onSelectRange={studio.workbookPicker.onSelect}
          open={studio.workbookPicker.open}
          selectionRequirement={
            studio.workbookPicker.request?.selectionRequirement ?? {}
          }
          sourceId={studio.workbookPicker.request?.sourceId ?? null}
          workbookSheets={studio.workbookPicker.workbookSheets}
          workbookSnapshotId={studio.workbookPicker.workbookSnapshotId}
        />
      </PageContainer>
    </WorkbookPickerProvider>
  );
}

function useStickyRegionBottom<TElement extends HTMLElement>(
  ref: RefObject<TElement | null>,
) {
  const [bottom, setBottom] = useState(initialStickyRegionBottom);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observedElement = element;

    let animationFrame = 0;

    function readBottom() {
      setBottom(Math.max(0, observedElement.getBoundingClientRect().bottom));
    }

    function scheduleBottomUpdate() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(readBottom);
    }

    readBottom();
    window.addEventListener("scroll", scheduleBottomUpdate, { passive: true });
    window.addEventListener("resize", scheduleBottomUpdate);

    if (typeof ResizeObserver === "undefined") {
      return () => {
        window.cancelAnimationFrame(animationFrame);
        window.removeEventListener("scroll", scheduleBottomUpdate);
        window.removeEventListener("resize", scheduleBottomUpdate);
      };
    }

    const observer = new ResizeObserver(scheduleBottomUpdate);
    observer.observe(element);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", scheduleBottomUpdate);
      window.removeEventListener("resize", scheduleBottomUpdate);
      observer.disconnect();
    };
  }, [ref]);

  return bottom;
}
