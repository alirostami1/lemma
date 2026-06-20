import type {
  ComposedEditorBlock,
  ComposedEditorModel,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import type { EditorSelection } from "../editor-selection";
import { SelectedElementInspector } from "./selected-element-inspector";

export function ElementsTab({
  model,
  selection,
  selectedBlock,
  referencePreviewCache,
  workbookEnabled,
  sources,
  previewSourceId,
  disabled,
  onModelChange,
  onSelectionChange,
}: {
  model: ComposedEditorModel;
  selection: EditorSelection;
  selectedBlock: ComposedEditorBlock | null;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  sources: QuestionBlueprintWorkbookSource[];
  previewSourceId: string | null;
  disabled?: boolean;
  onModelChange(model: ComposedEditorModel): void;
  onSelectionChange(selection: EditorSelection): void;
}) {
  return (
    <SelectedElementInspector
      model={model}
      selection={selection}
      selectedBlock={selectedBlock}
      referencePreviewCache={referencePreviewCache}
      workbookEnabled={workbookEnabled}
      sources={sources}
      previewSourceId={previewSourceId}
      disabled={disabled}
      onModelChange={onModelChange}
      onSelectionChange={onSelectionChange}
    />
  );
}
