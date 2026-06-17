import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { reorderComposedBlocks } from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import type { TableEditorSelection } from "#/features/questions/table-block-editor";
import { BlockEditor } from "./block-editor";
import { getComposedBlockLabel } from "./block-labels";
import { BlockLibrary } from "./block-library";
import { BlockPreview } from "./block-preview";
import { BlockShell } from "./block-shell";
import { EditorToolbar } from "./editor-toolbar";
import { InsertBlockMenu, type InsertBlockType } from "./insert-block-menu";
import { SortableBlockList } from "./sortable-block-list";

export function BlockList({
  model,
  selectedBlockId,
  disabled,
  referencePreviewCache,
  workbookEnabled,
  onModelChange,
  onSelectBlock,
  onSelectReference,
  onTableSelectionChange,
  getTableSelectionForBlock,
  onInsertBlock,
  onDuplicateBlock,
  onDeleteBlock,
  onMoveBlock,
}: {
  model: ComposedEditorModel;
  selectedBlockId: string | null;
  disabled?: boolean;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  onModelChange(model: ComposedEditorModel): void;
  onSelectBlock(blockId: string): void;
  onSelectReference(referenceId: string): void;
  onTableSelectionChange(
    blockId: string,
    selection: TableEditorSelection,
  ): void;
  getTableSelectionForBlock(blockId: string): TableEditorSelection;
  onInsertBlock(type: InsertBlockType, index: number): void;
  onDuplicateBlock(blockId: string): void;
  onDeleteBlock(blockId: string): void;
  onMoveBlock(blockId: string, direction: "up" | "down"): void;
}) {
  return (
    <div className="flex flex-col justify-start gap-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3 shadow-sm">
        <EditorToolbar blockCount={model.blocks.length} />
        <BlockLibrary
          disabled={disabled}
          onInsert={(type) => onInsertBlock(type, model.blocks.length)}
        />
      </div>

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
                disabled={disabled}
                onInsert={(type: InsertBlockType) => onInsertBlock(type, 0)}
              />
            </div>
          </div>
        </div>
      ) : null}

      <SortableBlockList
        items={model.blocks}
        disabled={disabled}
        onReorder={(blocks) =>
          onModelChange(reorderComposedBlocks(model, blocks))
        }
        renderOverlay={(block, style) => (
          <div
            className="min-h-10 rounded-lg border border-primary/30 bg-background px-3 py-2 text-xs font-semibold uppercase text-muted-foreground shadow-lg"
            style={style}
          >
            {getComposedBlockLabel(block)}
          </div>
        )}
        renderItem={(block, controls) => {
          const selected = block.id === selectedBlockId;
          const shouldRenderInteractiveBody =
            selected || block.type === "table";
          const index = model.blocks.findIndex(
            (candidate) => candidate.id === block.id,
          );
          return (
            <div key={block.id} className="grid gap-3">
              <BlockShell
                selected={selected}
                blockLabel={getComposedBlockLabel(block)}
                bottomAction={
                  <InsertBlockMenu
                    compact
                    disabled={disabled}
                    onInsert={(type: InsertBlockType) =>
                      onInsertBlock(type, index + 1)
                    }
                  />
                }
                disabled={disabled}
                dragControls={controls}
                onSelect={() => onSelectBlock(block.id)}
                onDelete={() => onDeleteBlock(block.id)}
                onDuplicate={() => onDuplicateBlock(block.id)}
                onMoveUp={() => onMoveBlock(block.id, "up")}
                onMoveDown={() => onMoveBlock(block.id, "down")}
                canMoveUp={index > 0}
                canMoveDown={index < model.blocks.length - 1}
              >
                {shouldRenderInteractiveBody ? (
                  <BlockEditor
                    block={block}
                    disabled={disabled}
                    referencePreviewCache={referencePreviewCache}
                    model={model}
                    workbookEnabled={workbookEnabled}
                    onModelChange={onModelChange}
                    onSelectReference={onSelectReference}
                    onTableSelectionChange={onTableSelectionChange}
                    getTableSelectionForBlock={getTableSelectionForBlock}
                  />
                ) : (
                  <BlockPreview
                    block={block}
                    referencePreviewCache={referencePreviewCache}
                    onSelectReference={onSelectReference}
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
