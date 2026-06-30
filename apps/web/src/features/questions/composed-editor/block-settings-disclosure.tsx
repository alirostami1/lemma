import { Button } from "@lemma/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@lemma/ui/components/collapsible";
import { SlidersHorizontal } from "lucide-react";
import type {
  ComposedEditorBlock,
  ComposedEditorModel,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import type { EditorSelection } from "./editor-selection";
import { SelectedElementInspector } from "./inspector/selected-element-inspector";

export function BlockSettingsDisclosure({
  block,
  disabled,
  model,
  onModelChange,
  onSelectionChange,
  referencePreviewCache,
  selection,
  sources,
  workbookEnabled,
  workbookSheetNamesBySourceId,
}: {
  block: ComposedEditorBlock;
  disabled?: boolean;
  model: ComposedEditorModel;
  onModelChange(model: ComposedEditorModel): void;
  onSelectionChange(selection: EditorSelection): void;
  referencePreviewCache: ReferencePreviewCache;
  selection: EditorSelection;
  sources: QuestionBlueprintWorkbookSource[];
  workbookEnabled: boolean;
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
}) {
  if (!hasLocalSettings(block)) {
    return null;
  }

  return (
    <Collapsible>
      <div className="border-t bg-muted/10 px-3 py-2 sm:px-4">
        <CollapsibleTrigger asChild>
          <Button
            className="h-8 rounded-md px-2 text-xs"
            disabled={disabled}
            size="sm"
            type="button"
            variant="ghost"
          >
            <SlidersHorizontal />
            Settings
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="border-t bg-background px-3 py-3 sm:px-4">
          <SelectedElementInspector
            disabled={disabled}
            model={model}
            onModelChange={onModelChange}
            onSelectionChange={onSelectionChange}
            referencePreviewCache={referencePreviewCache}
            selectedBlock={block}
            selection={selection}
            sources={sources}
            workbookEnabled={workbookEnabled}
            workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function hasLocalSettings(block: ComposedEditorBlock) {
  return block.type === "response" || block.type === "table";
}
