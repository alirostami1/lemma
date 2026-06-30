import { ScrollArea } from "@lemma/ui/components/scroll-area";
import type { CSSProperties } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { getComposedEditorSelectedBlock } from "../composed-editor-operations";
import type { EditorSelection } from "../editor-selection";
import type { DocumentReadinessIssue } from "./document-inspector";
import { ElementsTab } from "./elements-tab";
import {
  type ReferenceRecoveryItem,
  ReferenceRecoveryPanel,
} from "./reference-recovery-panel";

export function InspectorPanel({
  model,
  selection,
  referencePreviewCache,
  workbookEnabled,
  sources = [],
  workbookSheetNamesBySourceId,
  documentIssues,
  referenceRecoveryItems,
  disabled,
  onModelChange,
  onSelectionChange,
  stickyOffset = 80,
}: {
  model: ComposedEditorModel;
  selection: EditorSelection;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  sources?: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
  documentIssues?: readonly DocumentReadinessIssue[];
  referenceRecoveryItems?: readonly ReferenceRecoveryItem[];
  disabled?: boolean;
  onModelChange(model: ComposedEditorModel): void;
  onSelectionChange(selection: EditorSelection): void;
  stickyOffset?: number;
}) {
  const selectedBlock = getComposedEditorSelectedBlock(model, selection);
  const measuredStickyOffset = Math.max(stickyOffset, 0);
  const stickyStyle = {
    "--inspector-sticky-offset": `${measuredStickyOffset}px`,
    height: `calc(100dvh - ${measuredStickyOffset}px)`,
    top: measuredStickyOffset,
  } as CSSProperties;

  return (
    <aside
      aria-label="Element settings"
      className="sticky self-start overflow-hidden rounded-lg border bg-background shadow-sm"
      style={stickyStyle}
    >
      <div className="flex h-full min-h-0 flex-col p-3">
        <ScrollArea className="h-full min-h-0 pr-3">
          <div className="grid gap-3 pb-8">
            <ReferenceRecoveryPanel
              disabled={disabled}
              items={referenceRecoveryItems}
              model={model}
              onModelChange={onModelChange}
              onSelectionChange={onSelectionChange}
            />
            <ElementsTab
              disabled={disabled}
              documentIssues={documentIssues}
              model={model}
              onModelChange={onModelChange}
              onSelectionChange={onSelectionChange}
              referencePreviewCache={referencePreviewCache}
              selectedBlock={selectedBlock}
              selection={selection}
              sources={sources}
              workbookEnabled={workbookEnabled}
              workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
            />
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
}
