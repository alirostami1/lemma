import type { RefObject } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { PageContainer } from "#/components/patterns";
import { ComposedQuestionEditor } from "#/features/questions/composed-editor";
import { WorkbookPickerProvider } from "#/features/questions/table-block-editor";
import { WorkbookPickerDialog } from "../workbook-picker-dialog";
import { GenerateQuestionsDialog } from "./generation/generate-questions-dialog";
import { SaveBlueprintDialog } from "./save-blueprint-dialog";
import { SavedBlueprintsDialog } from "./saved-blueprints-dialog";
import { StudioSourceList } from "./source/studio-source-list";
import { StudioSourcePickerDialog } from "./source/studio-source-picker-dialog";
import { StudioCommandBar } from "./studio-command-bar";
import {
  StudioBlueprintOpenWarningDialog,
  StudioDraftRecoveryDialog,
  StudioResetConfirmationDialog,
} from "./studio-draft-recovery-dialog";
import {
  type StudioRouteSearch,
  useStudioController,
} from "./use-studio-controller";

export type { StudioRouteSearch };

const stickyInspectorGap = 16;
const initialStickyRegionBottom = 176;

export function StudioPage(input: StudioRouteSearch = {}) {
  const studio = useStudioController(input);
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

        <StudioBlueprintOpenWarningDialog {...studio.blueprintOpenWarning} />
        <StudioDraftRecoveryDialog {...studio.draftRecovery} />
        <StudioResetConfirmationDialog {...studio.resetConfirmation} />
        <SaveBlueprintDialog {...studio.saveDialog} />
        <StudioSourcePickerDialog
          existingSources={studio.source.sources}
          onCreateSource={studio.source.actions.createSource}
          onOpenChange={studio.sourcePicker.onOpenChange}
          open={studio.sourcePicker.open}
        />
        <GenerateQuestionsDialog {...studio.generateDialog} />
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
