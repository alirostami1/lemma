import type {
  ComposedEditorBlock,
  ComposedEditorModel,
} from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import type { EditorSelection } from "../editor-selection";
import { SelectedElementInspector } from "./selected-element-inspector";

export function ElementsTab({
  model,
  selection,
  selectedBlock,
  referencePreviewCache,
  workbookEnabled,
  activeSourceId,
  disabled,
  onModelChange,
  onSelectionChange,
}: {
  model: ComposedEditorModel;
  selection: EditorSelection;
  selectedBlock: ComposedEditorBlock | null;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  activeSourceId: string | null;
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
      activeSourceId={activeSourceId}
      disabled={disabled}
      onModelChange={onModelChange}
      onSelectionChange={onSelectionChange}
    />
  );
}
