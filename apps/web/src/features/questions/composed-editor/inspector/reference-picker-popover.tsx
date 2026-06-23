import { Button } from "@lemma/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@lemma/ui/components/popover";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@lemma/ui/components/tabs";
import { cn } from "@lemma/ui/lib/utils";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type {
  ComposedEditorModel,
  ReferenceSourceDraft,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { ReferenceCreateForm } from "./reference-create-form";
import {
  addReferenceToModel,
  getReferenceDisplayName,
  getReferenceSourceSummary,
} from "./reference-inspector-helpers";

export type ReferencePickerPopoverProps = {
  model: ComposedEditorModel;
  selectedReferenceId?: string;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  sources: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
  disabled?: boolean;
  defaultMode?: "existing" | "create";
  allowedSourceTypes?: ReferenceSourceDraft["type"][];
  createSourceTypeDefault?: ReferenceSourceDraft["type"];
  trigger: ReactNode;
  open?: boolean;
  onModelChange(model: ComposedEditorModel): void;
  onOpenChange?(open: boolean): void;
  onSelectReference(referenceId: string): void;
  onCreateAndSelectReference?(input: {
    nextModel: ComposedEditorModel;
    referenceId: string;
  }): void;
};

export function ReferencePickerPopover({
  model,
  selectedReferenceId,
  referencePreviewCache,
  workbookEnabled,
  sources,
  workbookSheetNamesBySourceId,
  disabled,
  defaultMode = "existing",
  allowedSourceTypes,
  createSourceTypeDefault,
  trigger,
  open: controlledOpen,
  onModelChange,
  onOpenChange,
  onSelectReference,
  onCreateAndSelectReference,
}: ReferencePickerPopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "create">(defaultMode);
  const open = controlledOpen ?? uncontrolledOpen;

  function setOpen(openState: boolean) {
    setUncontrolledOpen(openState);
    onOpenChange?.(openState);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    setMode(model.references.length === 0 ? "create" : defaultMode);
  }, [defaultMode, model.references.length, open]);

  const visibleReferences = model.references.filter((reference) =>
    isAllowedSourceType(allowedSourceTypes, reference.source.type),
  );

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(56vw,34rem)]"
        onFocusOutside={(event) => {
          if (isWorkbookPickerInteraction(event.target)) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (isWorkbookPickerInteraction(event.target)) {
            event.preventDefault();
          }
        }}
      >
        <div className="grid gap-4">
          <PopoverHeader>
            <PopoverTitle>Reference</PopoverTitle>
            <PopoverDescription>
              Use an existing reference or create a new one.
            </PopoverDescription>
          </PopoverHeader>

          <Tabs
            className="grid gap-4"
            onValueChange={(value) =>
              setMode(value === "create" ? "create" : "existing")
            }
            value={mode}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="existing">Use existing</TabsTrigger>
              <TabsTrigger value="create">Create new</TabsTrigger>
            </TabsList>

            <TabsContent className="m-0 grid gap-3" value="existing">
              {visibleReferences.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No references yet. Create one to use it here.
                </p>
              ) : (
                <div className="grid gap-2">
                  {visibleReferences.map((reference) => {
                    const selected = selectedReferenceId === reference.id;
                    const preview = referencePreviewCache[reference.id];
                    return (
                      <Button
                        className={cn(
                          "h-auto justify-start py-3 text-left",
                          selected && "border-primary",
                        )}
                        key={reference.id}
                        onClick={() => {
                          onSelectReference(reference.id);
                          setOpen(false);
                        }}
                        type="button"
                        variant={selected ? "default" : "outline"}
                      >
                        <span className="grid min-w-0 gap-0.5">
                          <span className="truncate font-medium">
                            {getReferenceDisplayName(reference)}
                          </span>
                          <span className="truncate text-xs font-normal opacity-80">
                            {getReferenceSourceSummary(reference, sources)}
                            {" | "}
                            {preview?.status === "resolved"
                              ? preview.displayValue
                              : preview?.status === "error"
                                ? "Error"
                                : "Missing source"}
                          </span>
                        </span>
                      </Button>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent className="m-0" value="create">
              <ReferenceCreateForm
                allowedSourceTypes={allowedSourceTypes}
                autoFocus
                disabled={disabled}
                initialSourceType={createSourceTypeDefault}
                model={model}
                onCancel={() => setMode("existing")}
                onCreated={({ mode, reference, referenceId }) => {
                  const nextModel =
                    mode === "created" && reference
                      ? addReferenceToModel(model, reference)
                      : model;
                  if (onCreateAndSelectReference) {
                    onCreateAndSelectReference({
                      nextModel,
                      referenceId,
                    });
                  } else {
                    onModelChange(nextModel);
                    onSelectReference(referenceId);
                  }
                  setOpen(false);
                }}
                sources={sources}
                submitLabel="Create and use reference"
                workbookEnabled={workbookEnabled}
                workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
              />
            </TabsContent>
          </Tabs>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function isWorkbookPickerInteraction(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest('[data-workbook-picker-dialog="true"]'))
  );
}

function isAllowedSourceType(
  allowedSourceTypes: ReferenceSourceDraft["type"][] | undefined,
  sourceType: ReferenceSourceDraft["type"],
) {
  return !allowedSourceTypes || allowedSourceTypes.includes(sourceType);
}
