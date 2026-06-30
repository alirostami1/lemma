import type {
  ComposedEditorBlock,
  ComposedEditorModel,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import type { EditorSelection } from "../editor-selection";
import type { DocumentReadinessIssue } from "./document-inspector";
import { SelectedElementInspector } from "./selected-element-inspector";

export function ElementsTab({
  model,
  selection,
  selectedBlock,
  referencePreviewCache,
  workbookEnabled,
  sources,
  workbookSheetNamesBySourceId,
  documentIssues,
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
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
  documentIssues?: readonly DocumentReadinessIssue[];
  disabled?: boolean;
  onModelChange(model: ComposedEditorModel): void;
  onSelectionChange(selection: EditorSelection): void;
}) {
  return (
    <SelectedElementInspector
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
  );
}
