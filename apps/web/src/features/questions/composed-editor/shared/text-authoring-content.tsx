import { Button } from "@lemma/ui/components/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@lemma/ui/components/context-menu";
import { FieldGroup } from "@lemma/ui/components/field";
import { useRef, useState } from "react";
import type {
  ComposedEditorModel,
  ComposedInlineContent,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { ReferencePickerPopover } from "../inspector/reference-picker-popover";
import {
  type InlineInsertionTarget,
  insertReferenceIntoInlineContent,
} from "../reference-insertion-controller";
import { InlineAuthoringEditor } from "./inline-authoring-editor";

type TextAuthoringContentProps = {
  content: ComposedInlineContent[];
  referencePreviewCache: ReferencePreviewCache;
  model: ComposedEditorModel;
  workbookEnabled: boolean;
  sources: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
  disabled?: boolean;
  onChange(content: ComposedInlineContent[]): void;
  onModelChange(model: ComposedEditorModel): void;
  onSelectReference(referenceId: string): void;
  onCreatedReference?(input: {
    nextModel: ComposedEditorModel;
    referenceId: string;
    nextContent: ComposedInlineContent[];
  }): void;
};

export function TextAuthoringContent({
  content,
  referencePreviewCache,
  model,
  workbookEnabled,
  sources,
  workbookSheetNamesBySourceId,
  disabled,
  onChange,
  onModelChange,
  onSelectReference,
  onCreatedReference,
}: TextAuthoringContentProps) {
  const ignoreNextPickerCloseRef = useRef(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [insertionTarget, setInsertionTarget] =
    useState<InlineInsertionTarget | null>(null);

  function insertReference(
    referenceId: string,
    options: { emitChange?: boolean } = {},
  ) {
    const nextContent = insertReferenceIntoInlineContent({
      content,
      referenceId,
      target: insertionTarget,
    });
    if (options.emitChange !== false) {
      onChange(nextContent);
    }
    return nextContent;
  }

  function openPickerFromContextMenu() {
    ignoreNextPickerCloseRef.current = true;
    setPickerOpen(true);
    window.setTimeout(() => {
      ignoreNextPickerCloseRef.current = false;
    }, 150);
  }

  function setReferencePickerOpen(open: boolean) {
    if (!open && ignoreNextPickerCloseRef.current) {
      return;
    }
    setPickerOpen(open);
  }

  return (
    <FieldGroup>
      <ContextMenu>
        <ContextMenuTrigger asChild disabled={disabled}>
          <div>
            <InlineAuthoringEditor
              content={content}
              disabled={disabled}
              onChange={onChange}
              onInsertionTargetChange={setInsertionTarget}
              onSelectReference={onSelectReference}
              referencePreviewCache={referencePreviewCache}
              references={model.references}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            disabled={disabled}
            onSelect={() => {
              openPickerFromContextMenu();
            }}
          >
            Add reference
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <div className="flex flex-wrap items-center gap-2">
        <ReferencePickerPopover
          disabled={disabled}
          model={model}
          onCreateAndSelectReference={({ nextModel, referenceId }) => {
            const nextContent = insertReference(referenceId, {
              emitChange: false,
            });

            if (onCreatedReference) {
              onCreatedReference({
                nextContent,
                nextModel,
                referenceId,
              });
              return;
            }

            onModelChange(nextModel);
            onChange(nextContent);
          }}
          onModelChange={onModelChange}
          onOpenChange={setReferencePickerOpen}
          onSelectReference={insertReference}
          open={pickerOpen}
          referencePreviewCache={referencePreviewCache}
          sources={sources}
          trigger={
            <Button
              disabled={disabled}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Add reference
            </Button>
          }
          workbookEnabled={workbookEnabled}
          workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
        />
      </div>
    </FieldGroup>
  );
}
