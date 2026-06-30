import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { reorderComposedBlocks } from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import type { TableEditorSelection } from "#/features/questions/table-block-editor";
import { BlockEditor } from "./block-editor";
import { getComposedBlockLabel } from "./block-labels";
import { BlockPreview } from "./block-preview";
import { BlockSettingsDisclosure } from "./block-settings-disclosure";
import { BlockShell } from "./block-shell";
import type { EditorSelection } from "./editor-selection";
import { InsertBlockMenu, type InsertBlockType } from "./insert-block-menu";
import { SortableBlockList } from "./sortable-block-list";
import type { StudioEditorCommandAvailability } from "./studio-editor-command-model";

export function BlockList({
  commandAvailability,
  model,
  selection,
  selectedBlockId,
  editingBlockId,
  disabled,
  referencePreviewCache,
  workbookEnabled,
  sources = [],
  workbookSheetNamesBySourceId,
  onModelChange,
  onSelectionChange,
  onSelectBlock,
  onSelectReference,
  onTableSelectionChange,
  getTableSelectionForBlock,
  onCancelEdit,
  onConfirmEdit,
  onEditBlock,
  onInsertBlock,
  onDuplicateBlock,
  onDeleteBlock,
  onMoveBlock,
}: {
  commandAvailability: StudioEditorCommandAvailability;
  model: ComposedEditorModel;
  selection: EditorSelection;
  selectedBlockId: string | null;
  editingBlockId?: string | null;
  disabled?: boolean;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  sources?: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
  onModelChange(model: ComposedEditorModel): void;
  onSelectionChange(selection: EditorSelection): void;
  onSelectBlock(blockId: string): void;
  onSelectReference(referenceId: string): void;
  onTableSelectionChange(
    blockId: string,
    selection: TableEditorSelection,
  ): void;
  getTableSelectionForBlock(blockId: string): TableEditorSelection;
  onCancelEdit(): void;
  onConfirmEdit(): void;
  onEditBlock(blockId: string): void;
  onInsertBlock(type: InsertBlockType, index: number): void;
  onDuplicateBlock(blockId: string): void;
  onDeleteBlock(blockId: string): void;
  onMoveBlock(blockId: string, direction: "up" | "down"): void;
}) {
  return (
    <div className="flex flex-col justify-start gap-3">
      {model.blocks.length === 0 ? (
        <div className="grid min-h-52 place-items-center rounded-lg border border-dashed bg-muted/20 p-6 text-center">
          <div className="grid gap-3">
            <div className="grid gap-1">
              <p className="text-sm font-medium">Start with a block</p>
              <p className="text-xs text-muted-foreground">
                Add text, an answer, a table, or a divider.
              </p>
            </div>
            <div className="justify-self-center">
              <InsertBlockMenu
                disabled={disabled || !commandAvailability.insert_block}
                onInsert={(type: InsertBlockType) => onInsertBlock(type, 0)}
              />
            </div>
          </div>
        </div>
      ) : null}

      <SortableBlockList
        disabled={disabled || editingBlockId !== null}
        items={model.blocks}
        onReorder={(blocks) =>
          !editingBlockId
            ? onModelChange(reorderComposedBlocks(model, blocks))
            : undefined
        }
        renderItem={(block, controls) => {
          const selected = block.id === selectedBlockId;
          const shouldRenderInteractiveBody = editingBlockId === block.id;
          const focusedMode = editingBlockId !== null;
          const index = model.blocks.findIndex(
            (candidate) => candidate.id === block.id,
          );
          const blockActionsDisabled =
            disabled ||
            (editingBlockId !== null && editingBlockId !== block.id);
          return (
            <div className="grid gap-3" key={block.id}>
              <BlockShell
                blockId={block.id}
                blockLabel={getComposedBlockLabel(block)}
                bottomAction={
                  <InsertBlockMenu
                    compact
                    disabled={disabled || !commandAvailability.insert_block}
                    onInsert={(type: InsertBlockType) =>
                      onInsertBlock(type, index + 1)
                    }
                  />
                }
                canMoveDown={index < model.blocks.length - 1}
                canMoveUp={index > 0}
                disabled={blockActionsDisabled}
                dragControls={controls}
                editing={editingBlockId === block.id}
                onCancelEdit={onCancelEdit}
                onConfirmEdit={onConfirmEdit}
                onDelete={() => onDeleteBlock(block.id)}
                onDuplicate={() => onDuplicateBlock(block.id)}
                onEdit={() => onEditBlock(block.id)}
                onMoveDown={() => onMoveBlock(block.id, "down")}
                onMoveUp={() => onMoveBlock(block.id, "up")}
                onSelect={() => onSelectBlock(block.id)}
                selected={selected}
                settingsAction={
                  selected ? (
                    <BlockSettingsDisclosure
                      block={block}
                      disabled={disabled || editingBlockId !== null}
                      model={model}
                      onModelChange={onModelChange}
                      onSelectionChange={onSelectionChange}
                      referencePreviewCache={referencePreviewCache}
                      selection={selection}
                      sources={sources}
                      workbookEnabled={workbookEnabled}
                      workbookSheetNamesBySourceId={
                        workbookSheetNamesBySourceId
                      }
                    />
                  ) : null
                }
                subdued={focusedMode && editingBlockId !== block.id}
              >
                {shouldRenderInteractiveBody ? (
                  <BlockEditor
                    block={block}
                    disabled={disabled}
                    getTableSelectionForBlock={getTableSelectionForBlock}
                    model={model}
                    onModelChange={onModelChange}
                    onSelectReference={onSelectReference}
                    onTableSelectionChange={onTableSelectionChange}
                    referencePreviewCache={referencePreviewCache}
                    sources={sources}
                    workbookEnabled={workbookEnabled}
                    workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
                  />
                ) : (
                  <BlockPreview
                    block={block}
                    referencePreviewCache={referencePreviewCache}
                  />
                )}
              </BlockShell>
            </div>
          );
        }}
      />
    </div>
  );
}
