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
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { ReferenceCreateForm } from "./reference-create-form";
import {
  addReferenceToModel,
  getReferenceDisplayName,
  getReferenceSourceLabel,
} from "./reference-inspector-helpers";

export type ReferencePickerPopoverProps = {
  model: ComposedEditorModel;
  selectedReferenceId?: string;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  disabled?: boolean;
  activeSourceId: string | null;
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
  disabled,
  activeSourceId,
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
    <Popover open={open} onOpenChange={setOpen}>
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
            value={mode}
            onValueChange={(value) =>
              setMode(value === "create" ? "create" : "existing")
            }
            className="grid gap-4"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="existing">Use existing</TabsTrigger>
              <TabsTrigger value="create">Create new</TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="m-0 grid gap-3">
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
                        key={reference.id}
                        type="button"
                        variant={selected ? "default" : "outline"}
                        className={cn(
                          "h-auto justify-start py-3 text-left",
                          selected && "border-primary",
                        )}
                        onClick={() => {
                          onSelectReference(reference.id);
                          setOpen(false);
                        }}
                      >
                        <span className="grid min-w-0 gap-0.5">
                          <span className="truncate font-medium">
                            {getReferenceDisplayName(reference)}
                          </span>
                          <span className="truncate text-xs font-normal opacity-80">
                            {getReferenceSourceLabel(reference)}
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

            <TabsContent value="create" className="m-0">
              <ReferenceCreateForm
                model={model}
                workbookEnabled={workbookEnabled}
                activeSourceId={activeSourceId}
                allowedSourceTypes={allowedSourceTypes}
                initialSourceType={createSourceTypeDefault}
                disabled={disabled}
                autoFocus
                submitLabel="Create and use reference"
                onCreated={(reference) => {
                  const nextModel = addReferenceToModel(model, reference);
                  if (onCreateAndSelectReference) {
                    onCreateAndSelectReference({
                      nextModel,
                      referenceId: reference.id,
                    });
                  } else {
                    onModelChange(nextModel);
                    onSelectReference(reference.id);
                  }
                  setOpen(false);
                }}
                onCancel={() => setMode("existing")}
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
