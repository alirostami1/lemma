import type { RefObject } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { PageContainer } from "#/components/patterns";
import { ComposedQuestionEditor } from "#/features/questions/composed-editor";
import { WorkbookPickerProvider } from "#/features/questions/table-block-editor";
import { WorkbookPickerDialog } from "../workbook-picker-dialog";
import { GenerateQuestionsDialog } from "./generation/generate-questions-dialog";
import { SaveBlueprintDialog } from "./save-blueprint-dialog";
import { SavedBlueprintsDialog } from "./saved-blueprints-dialog";
import { StudioSourceBar } from "./source/studio-source-bar";
import { WorkbookUploadInline } from "./source/workbook-upload-inline";
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
  const stickyRegionBottom = useStickyRegionBottom(stickyRegionRef);
  const inspectorStickyOffset = stickyRegionBottom + stickyInspectorGap;

  return (
    <WorkbookPickerProvider
      value={{ openWorkbookPicker: studio.workbookPicker.openWorkbookPicker }}
    >
      <PageContainer variant="workbench" className="pb-8">
        <div
          ref={stickyRegionRef}
          className="sticky top-0 z-30 grid gap-2 bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        >
          <StudioCommandBar {...studio.commandBar} />
          <StudioSourceBar
            sourceCard={studio.source.sourceCard}
            onAddSource={studio.source.actions.addSource}
            onChangeSource={studio.source.actions.changeSource}
            onRemoveSource={studio.source.actions.removeSource}
          />
        </div>

        <section className="rounded-lg border bg-background p-3 shadow-sm sm:p-4">
          <div className="max-w-none">
            <ComposedQuestionEditor
              model={studio.editor.authoringModel}
              onModelChange={studio.editor.onAuthoringModelChange}
              referencePreviewCache={studio.editor.referencePreviewCache}
              workbookTools={{
                hasWorkbookFile: studio.editor.canUseWorkbookTools,
              }}
              inspectorStickyOffset={inspectorStickyOffset}
            />
          </div>
        </section>

        <StudioBlueprintOpenWarningDialog {...studio.blueprintOpenWarning} />
        <StudioDraftRecoveryDialog {...studio.draftRecovery} />
        <StudioResetConfirmationDialog {...studio.resetConfirmation} />
        <SaveBlueprintDialog {...studio.saveDialog} />
        <GenerateQuestionsDialog {...studio.generateDialog} />
        <SavedBlueprintsDialog {...studio.savedBlueprints} />
        <WorkbookUploadInline
          open={studio.source.uploadDialog.open}
          onOpenChange={studio.source.uploadDialog.onOpenChange}
          onCreated={studio.source.uploadDialog.onCreated}
        />
        <WorkbookPickerDialog
          workbookSnapshotId={studio.workbookPicker.workbookSnapshotId}
          workbookSheets={studio.workbookPicker.workbookSheets}
          hasMoreSheets={studio.workbookPicker.hasMoreWorkbookSheets}
          isLoadingMoreSheets={
            studio.workbookPicker.isLoadingMoreWorkbookSheets
          }
          fileName={studio.workbookPicker.fileName}
          open={studio.workbookPicker.open}
          onOpenChange={studio.workbookPicker.onOpenChange}
          onLoadMoreSheets={studio.workbookPicker.onLoadMoreWorkbookSheets}
          selectionRequirement={
            studio.workbookPicker.request?.selectionRequirement ?? {}
          }
          onSelectRange={studio.workbookPicker.onSelect}
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
