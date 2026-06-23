import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { reorderComposedBlocks } from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
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
  sources = [],
  workbookSheetNamesBySourceId,
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
  sources?: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
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
        disabled={disabled}
        items={model.blocks}
        onReorder={(blocks) =>
          onModelChange(reorderComposedBlocks(model, blocks))
        }
        renderItem={(block, controls) => {
          const selected = block.id === selectedBlockId;
          const shouldRenderInteractiveBody =
            selected || block.type === "table";
          const index = model.blocks.findIndex(
            (candidate) => candidate.id === block.id,
          );
          return (
            <div className="grid gap-3" key={block.id}>
              <BlockShell
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
                canMoveDown={index < model.blocks.length - 1}
                canMoveUp={index > 0}
                disabled={disabled}
                dragControls={controls}
                onDelete={() => onDeleteBlock(block.id)}
                onDuplicate={() => onDuplicateBlock(block.id)}
                onMoveDown={() => onMoveBlock(block.id, "down")}
                onMoveUp={() => onMoveBlock(block.id, "up")}
                onSelect={() => onSelectBlock(block.id)}
                selected={selected}
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
                    onSelectReference={onSelectReference}
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
