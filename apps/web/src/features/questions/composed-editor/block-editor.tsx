import { Input } from "@lemma/ui/components/input";
import {
  type ComposedEditorBlock,
  type ComposedEditorModel,
  type ComposedResponseEditorBlock,
  type ComposedTextEditorBlock,
  updateComposedBlock,
} from "#/domains/questions/authoring";
import type { TableEditorSelection } from "#/features/questions/table-block-editor";
import { TableBlockEditor } from "#/features/questions/table-block-editor";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { RichTextEditor } from "./rich-text-editor";
import { TextAuthoringContent } from "./shared/text-authoring-content";

export function BlockEditor({
  block,
  disabled,
  referencePreviewCache,
  model,
  workbookEnabled,
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
        referencePreviewCache={referencePreviewCache}
        model={model}
        workbookEnabled={workbookEnabled}
        onModelChange={onModelChange}
        onSelectReference={onSelectReference}
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
      />
    );
  }
  if (block.type === "rich_text") {
    return (
      <div className="grid gap-3">
        <RichTextEditor
          value={block.content}
          model={model}
          referencePreviewCache={referencePreviewCache}
          workbookEnabled={workbookEnabled}
          disabled={disabled}
          onModelChange={onModelChange}
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
        />
      </div>
    );
  }
  if (block.type === "separator") return <hr className="border-border" />;
  if (block.type === "table") {
    return (
      <TableBlockEditor
        model={block.table}
        selection={getTableSelectionForBlock(block.id)}
        referencePreviewCache={referencePreviewCache}
        onSelectionChange={(nextSelection) =>
          onTableSelectionChange(block.id, nextSelection)
        }
        onModelChange={(table) =>
          onModelChange(
            updateComposedBlock(model, block.id, (current) => ({
              ...current,
              table,
            })),
          )
        }
        workbookTools={{ hasWorkbookFile: workbookEnabled }}
        disabled={disabled}
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
  onModelChange,
  onSelectReference,
  onCreatedReference,
}: {
  block: ComposedTextEditorBlock;
  disabled?: boolean;
  referencePreviewCache: ReferencePreviewCache;
  model: ComposedEditorModel;
  workbookEnabled: boolean;
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
        referencePreviewCache={referencePreviewCache}
        model={model}
        workbookEnabled={workbookEnabled}
        disabled={disabled}
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
        onModelChange={onModelChange}
        onSelectReference={onSelectReference}
        onCreatedReference={onCreatedReference}
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
          htmlFor={`${block.id}-label`}
          className="grid gap-1 text-sm font-medium"
        >
          Label
          <Input
            id={`${block.id}-label`}
            value={block.label ?? ""}
            disabled={disabled}
            placeholder={responseField.label ?? "Answer"}
            onChange={(event) =>
              onModelChange(
                updateComposedBlock(model, block.id, (current) => ({
                  ...current,
                  label: event.currentTarget.value || undefined,
                })),
              )
            }
          />
        </label>
        <label
          htmlFor={`${block.id}-placeholder`}
          className="grid gap-1 text-sm font-medium"
        >
          Placeholder
          <Input
            id={`${block.id}-placeholder`}
            value={block.placeholder ?? ""}
            disabled={disabled}
            placeholder="Student answer"
            onChange={(event) =>
              onModelChange(
                updateComposedBlock(model, block.id, (current) => ({
                  ...current,
                  placeholder: event.currentTarget.value || undefined,
                })),
              )
            }
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
