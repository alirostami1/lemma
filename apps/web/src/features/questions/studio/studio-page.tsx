import { Button } from "@lemma/ui/components/button";
import { InlineError } from "@lemma/ui/components/inline-error";
import { Link, useNavigate } from "@tanstack/react-router";
import type { RefObject } from "react";
import { useLayoutEffect, useRef, useState } from "react";
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

  if (routeIntent.type !== "edit_draft" || !isStudioRouteNormalized(input)) {
    return <StudioEntryRouteView intent={routeIntent} routeSearch={input} />;
  }

  return <StudioDraftRouteGate draftId={routeIntent.draftId} input={input} />;
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
          <p className="text-sm text-muted-foreground">Loading draft...</p>
        </section>
      </PageContainer>
    );
  }

  if (draftQuery.isError) {
    return (
      <PageContainer className="pb-8" variant="workbench">
        <section className="grid gap-3 rounded-lg border bg-background p-6 shadow-sm">
          <h1 className="text-lg font-semibold">Draft unavailable</h1>
          <InlineError message="Draft could not be loaded." />
          <Button
            onClick={() => {
              void draftQuery.refetch();
            }}
            type="button"
            variant="outline"
          >
            Retry
          </Button>
        </section>
      </PageContainer>
    );
  }

  if (draft?.status === "published" || draft?.status === "discarded") {
    return (
      <StudioTerminalDraftView
        blueprintId={draft.blueprintId}
        draftName={draft.name}
        status={draft.status}
      />
    );
  }

  return <StudioEditorEntry input={input} />;
}

function StudioTerminalDraftView({
  blueprintId,
  draftName,
  status,
}: {
  blueprintId: string | null;
  draftName: string;
  status: "published" | "discarded";
}) {
  const title = status === "published" ? "Draft published" : "Draft discarded";
  const description =
    status === "published"
      ? "This draft has already been published and cannot be edited here."
      : "This draft has been discarded and cannot be edited here.";

  return (
    <PageContainer className="pb-8" variant="workbench">
      <section className="grid gap-4 rounded-lg border bg-background p-6 shadow-sm">
        <div className="grid gap-1">
          <p className="text-sm font-medium text-muted-foreground">
            Terminal draft
          </p>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {draftName}: {description}
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
                Create new edit draft
              </Link>
            </Button>
          ) : status === "discarded" ? (
            <>
              <Button asChild variant="outline">
                <Link search={{ new: "1" }} to="/studio">
                  Create new draft
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/studio">Open drafts</Link>
              </Button>
            </>
          ) : (
            <Button asChild variant="outline">
              <Link search={{ new: "1" }} to="/studio">
                Create new draft
              </Link>
            </Button>
          )}
        </div>
      </section>
    </PageContainer>
  );
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
        <p className="text-sm text-muted-foreground">Loading draft...</p>
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
              ? "This draft contains an unsupported or invalid document structure."
              : "This draft is unavailable right now."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onReloadLatestDraft} type="button" variant="outline">
            Reload latest draft
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
  routeSearch,
}: {
  intent: Exclude<StudioRouteIntent, { type: "landing" }>;
  routeSearch: StudioRouteSearch;
}) {
  const navigate = useNavigate();
  const entryRoute = useStudioEntryRoute({
    intent,
    navigate,
    routeSearch,
  });
  const message =
    intent.type === "edit_blueprint"
      ? "Opening blueprint edit draft..."
      : intent.type === "new_draft"
        ? "Creating draft..."
        : "Opening draft...";

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
