import { Input } from "@lemma/ui/components/input";
import {
  type ComposedEditorBlock,
  type ComposedEditorModel,
  type ComposedResponseEditorBlock,
  type ComposedTextEditorBlock,
  updateComposedBlock,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import type { TableEditorSelection } from "#/features/questions/table-block-editor";
import { TableBlockEditor } from "#/features/questions/table-block-editor";
import { RichTextEditor } from "./rich-text-editor";
import { TextAuthoringContent } from "./shared/text-authoring-content";

export function BlockEditor({
  block,
  disabled,
  referencePreviewCache,
  model,
  workbookEnabled,
  sources,
  workbookSheetNamesBySourceId,
  onModelChange,
  onSelectReference,
  onTableSelectionChange,
  getTableSelectionForBlock,
}: {
  block: ComposedEditorBlock;
  disabled?: boolean;
  referencePreviewCache: ReferencePreviewCache;
  model: ComposedEditorModel;
  workbookEnabled: boolean;
  sources: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
  onModelChange(model: ComposedEditorModel): void;
  onSelectReference(referenceId: string): void;
  onTableSelectionChange(
    blockId: string,
    selection: TableEditorSelection,
  ): void;
  getTableSelectionForBlock(blockId: string): TableEditorSelection;
}) {
  if (block.type === "text") {
    return (
      <TextBlockEditor
        block={block}
        disabled={disabled}
        model={model}
        onCreatedReference={({ nextModel, nextContent }) =>
          onModelChange(
            updateComposedBlock(nextModel, block.id, (current) => {
              if (current.type !== "text") {
                return current;
              }
              return {
                ...current,
                content: nextContent,
              };
            }),
          )
        }
        onModelChange={onModelChange}
        onSelectReference={onSelectReference}
        referencePreviewCache={referencePreviewCache}
        sources={sources}
        workbookEnabled={workbookEnabled}
        workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
      />
    );
  }
  if (block.type === "rich_text") {
    return (
      <div className="grid gap-3">
        <RichTextEditor
          disabled={disabled}
          model={model}
          onChange={(content) =>
            onModelChange({
              ...model,
              blocks: model.blocks.map((candidate) =>
                candidate.id === block.id
                  ? { ...candidate, content }
                  : candidate,
              ) as ComposedEditorBlock[],
            })
          }
          onCreatedReference={({ nextModel, nextContent }) =>
            onModelChange({
              ...nextModel,
              blocks: nextModel.blocks.map((candidate) =>
                candidate.id === block.id
                  ? { ...candidate, content: nextContent }
                  : candidate,
              ) as ComposedEditorBlock[],
            })
          }
          onModelChange={onModelChange}
          referencePreviewCache={referencePreviewCache}
          sources={sources}
          value={block.content}
          workbookEnabled={workbookEnabled}
          workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
        />
      </div>
    );
  }
  if (block.type === "separator") return <hr className="border-border" />;
  if (block.type === "table") {
    return (
      <TableBlockEditor
        disabled={disabled}
        model={block.table}
        onModelChange={(table) =>
          onModelChange(
            updateComposedBlock(model, block.id, (current) => ({
              ...current,
              table,
            })),
          )
        }
        onSelectionChange={(nextSelection) =>
          onTableSelectionChange(block.id, nextSelection)
        }
        referencePreviewCache={referencePreviewCache}
        selection={getTableSelectionForBlock(block.id)}
        workbookTools={{ hasWorkbookFile: workbookEnabled }}
      />
    );
  }
  return (
    <ResponseBlockEditor
      block={block}
      disabled={disabled}
      model={model}
      onModelChange={onModelChange}
    />
  );
}

function TextBlockEditor({
  block,
  disabled,
  referencePreviewCache,
  model,
  workbookEnabled,
  sources,
  workbookSheetNamesBySourceId,
  onModelChange,
  onSelectReference,
  onCreatedReference,
}: {
  block: ComposedTextEditorBlock;
  disabled?: boolean;
  referencePreviewCache: ReferencePreviewCache;
  model: ComposedEditorModel;
  workbookEnabled: boolean;
  sources: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
  onModelChange(model: ComposedEditorModel): void;
  onSelectReference(referenceId: string): void;
  onCreatedReference(input: {
    nextModel: ComposedEditorModel;
    nextContent: ComposedTextEditorBlock["content"];
  }): void;
}) {
  return (
    <div className="grid gap-3">
      <TextAuthoringContent
        content={block.content}
        disabled={disabled}
        model={model}
        onChange={(content) =>
          onModelChange(
            updateComposedBlock(model, block.id, (current) => {
              if (current.type !== "text") {
                return current;
              }
              return {
                ...current,
                content,
              };
            }),
          )
        }
        onCreatedReference={onCreatedReference}
        onModelChange={onModelChange}
        onSelectReference={onSelectReference}
        referencePreviewCache={referencePreviewCache}
        sources={sources}
        workbookEnabled={workbookEnabled}
        workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
      />
    </div>
  );
}

function ResponseBlockEditor({
  block,
  disabled,
  model,
  onModelChange,
}: {
  block: ComposedResponseEditorBlock;
  disabled?: boolean;
  model: ComposedEditorModel;
  onModelChange(model: ComposedEditorModel): void;
}) {
  const responseField = model.responseFields.find(
    (field) => field.id === block.responseFieldId,
  );
  if (!responseField) {
    return (
      <div className="rounded-lg border border-dashed border-destructive/40 p-4 text-sm text-destructive">
        This answer block is missing its answer field.
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label
          className="grid gap-1 text-sm font-medium"
          htmlFor={`${block.id}-label`}
        >
          Label
          <Input
            disabled={disabled}
            id={`${block.id}-label`}
            onChange={(event) =>
              onModelChange(
                updateComposedBlock(model, block.id, (current) => ({
                  ...current,
                  label: event.currentTarget.value || undefined,
                })),
              )
            }
            placeholder={responseField.label ?? "Answer"}
            value={block.label ?? ""}
          />
        </label>
        <label
          className="grid gap-1 text-sm font-medium"
          htmlFor={`${block.id}-placeholder`}
        >
          Placeholder
          <Input
            disabled={disabled}
            id={`${block.id}-placeholder`}
            onChange={(event) =>
              onModelChange(
                updateComposedBlock(model, block.id, (current) => ({
                  ...current,
                  placeholder: event.currentTarget.value || undefined,
                })),
              )
            }
            placeholder="Student answer"
            value={block.placeholder ?? ""}
          />
        </label>
      </div>
      <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">
            {block.label ?? responseField.label ?? "Answer"}
          </p>
          <span className="rounded-md border bg-background px-2 py-0.5 text-xs text-muted-foreground">
            {responseField.type}
          </span>
        </div>
        <Input disabled placeholder={block.placeholder ?? "Student answer"} />
      </div>
    </div>
  );
}
