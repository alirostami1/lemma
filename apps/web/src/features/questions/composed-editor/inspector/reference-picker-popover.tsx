import { Button } from "@lemma/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@lemma/ui/components/popover";
import { Braces, FileSpreadsheet, Type } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type {
  ComposedEditorModel,
  ReferenceSourceDraft,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { useAddReferenceActions } from "./add-reference-actions";
import {
  ReferenceCreateForm,
  type ReferenceCreateFormProps,
} from "./reference-create-form";
import {
  addReferenceToModel,
  getReferenceDisplayName,
  getReferenceSourceSummary,
  getSourceDisplayName,
} from "./reference-inspector-helpers";

type AddReferenceType = "workbook" | "python" | "literal";

export type ReferencePickerPopoverProps = {
  model: ComposedEditorModel;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  sources: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
  disabled?: boolean;
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
  referencePreviewCache,
  workbookEnabled,
  sources,
  workbookSheetNamesBySourceId,
  disabled,
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
  const [addType, setAddType] = useState<AddReferenceType | null>(null);
  const [selectedWorkbookSourceId, setSelectedWorkbookSourceId] = useState<
    string | null
  >(null);
  const { onUploadWorkbook } = useAddReferenceActions();
  const open = controlledOpen ?? uncontrolledOpen;

  function setOpen(openState: boolean) {
    setUncontrolledOpen(openState);
    onOpenChange?.(openState);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    setAddType(null);
    setSelectedWorkbookSourceId(null);
  }, [open]);

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
            <PopoverTitle>Add reference</PopoverTitle>
            <PopoverDescription>
              Add a workbook selection or a static value to this block.
            </PopoverDescription>
          </PopoverHeader>

          <AddReferenceFlow
            addType={addType}
            allowedSourceTypes={allowedSourceTypes}
            createSourceTypeDefault={createSourceTypeDefault}
            disabled={disabled}
            model={model}
            onAddTypeChange={(nextType) => {
              setAddType(nextType);
              setSelectedWorkbookSourceId(null);
            }}
            onBack={() => {
              setAddType(null);
              setSelectedWorkbookSourceId(null);
            }}
            onCreated={({ mode: createMode, reference, referenceId }) => {
              const nextModel =
                createMode === "created" && reference
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
            onSelectExisting={(referenceId) => {
              onSelectReference(referenceId);
              setOpen(false);
            }}
            onSelectWorkbook={setSelectedWorkbookSourceId}
            onUploadWorkbook={onUploadWorkbook}
            referencePreviewCache={referencePreviewCache}
            selectedWorkbookSourceId={selectedWorkbookSourceId}
            sources={sources}
            workbookEnabled={workbookEnabled}
            workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AddReferenceFlow({
  addType,
  allowedSourceTypes,
  createSourceTypeDefault,
  disabled,
  model,
  onAddTypeChange,
  onBack,
  onCreated,
  onSelectExisting,
  onSelectWorkbook,
  onUploadWorkbook,
  referencePreviewCache,
  selectedWorkbookSourceId,
  sources,
  workbookEnabled,
  workbookSheetNamesBySourceId,
}: {
  addType: AddReferenceType | null;
  allowedSourceTypes?: ReferenceSourceDraft["type"][];
  createSourceTypeDefault?: ReferenceSourceDraft["type"];
  disabled?: boolean;
  model: ComposedEditorModel;
  onAddTypeChange(type: AddReferenceType): void;
  onBack(): void;
  onCreated: ReferenceCreateFormProps["onCreated"];
  onSelectExisting(referenceId: string): void;
  onSelectWorkbook(sourceId: string | null): void;
  onUploadWorkbook?: () => void;
  referencePreviewCache: ReferencePreviewCache;
  selectedWorkbookSourceId: string | null;
  sources: QuestionBlueprintWorkbookSource[];
  workbookEnabled: boolean;
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
}) {
  if (addType === null) {
    const workbookAllowed =
      isAllowedSourceType(allowedSourceTypes, "workbook_cell") ||
      isAllowedSourceType(allowedSourceTypes, "workbook_range");
    const literalAllowed = isAllowedSourceType(allowedSourceTypes, "literal");

    return (
      <div className="grid gap-3">
        <p className="text-sm font-medium">What would you like to add?</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <ReferenceTypeButton
            description="Select a cell or range"
            disabled={disabled || !workbookAllowed}
            icon={<FileSpreadsheet />}
            label="Workbook"
            onClick={() => onAddTypeChange("workbook")}
          />
          <ReferenceTypeButton
            description="Runtime not available yet"
            disabled
            icon={<Braces />}
            label="Python"
            onClick={() => onAddTypeChange("python")}
          />
          <ReferenceTypeButton
            description="Enter a fixed value"
            disabled={disabled || !literalAllowed}
            icon={<Type />}
            label="Literal"
            onClick={() => onAddTypeChange("literal")}
          />
        </div>
      </div>
    );
  }

  if (addType === "python") {
    return (
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Python</p>
          <Button onClick={onBack} size="sm" type="button" variant="ghost">
            Back
          </Button>
        </div>
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Python values are not available yet.
        </p>
      </div>
    );
  }

  const allowedWorkbookTypes = (
    ["workbook_cell", "workbook_range"] as const
  ).filter((sourceType) => isAllowedSourceType(allowedSourceTypes, sourceType));
  const existingReferences = model.references.filter(
    (reference) =>
      isAllowedSourceType(allowedSourceTypes, reference.source.type) &&
      (addType === "literal"
        ? reference.source.type === "literal"
        : reference.source.type === "workbook_cell" ||
          reference.source.type === "workbook_range"),
  );
  const selectedWorkbook = selectedWorkbookSourceId
    ? sources.find((source) => source.sourceId === selectedWorkbookSourceId)
    : null;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {addType === "workbook" ? "Workbook value" : "Static value"}
        </p>
        <Button onClick={onBack} size="sm" type="button" variant="ghost">
          Back
        </Button>
      </div>

      {existingReferences.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Values already added
          </p>
          {existingReferences.map((reference) => (
            <Button
              className="h-auto justify-start py-3 text-left"
              key={reference.id}
              onClick={() => onSelectExisting(reference.id)}
              type="button"
              variant="outline"
            >
              <span className="grid min-w-0 gap-0.5">
                <span className="truncate font-medium">
                  {getReferenceDisplayName(reference)}
                </span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {referencePreviewCache[reference.id]?.status === "resolved"
                    ? referencePreviewCache[reference.id]?.displayValue
                    : getReferenceSourceSummary(reference, sources)}
                </span>
              </span>
            </Button>
          ))}
        </div>
      ) : null}

      {addType === "literal" ? (
        <ReferenceCreateForm
          allowedSourceTypes={["literal"]}
          autoFocus
          disabled={disabled}
          initialSourceType="literal"
          model={model}
          onCancel={onBack}
          onCreated={onCreated}
          sources={sources}
          submitLabel="Add this value"
          workbookEnabled={workbookEnabled}
          workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
        />
      ) : selectedWorkbook ? (
        <ReferenceCreateForm
          allowedSourceTypes={[...allowedWorkbookTypes]}
          autoFocus
          disabled={disabled}
          initialSourceType={
            createSourceTypeDefault ??
            allowedWorkbookTypes[0] ??
            "workbook_cell"
          }
          initialWorkbookSourceId={selectedWorkbook.sourceId}
          model={model}
          onCancel={() => onSelectWorkbook(null)}
          onCreated={onCreated}
          sources={sources}
          submitLabel="Add this value"
          workbookEnabled={workbookEnabled}
          workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
        />
      ) : (
        <div className="grid gap-3">
          {sources.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Workbooks in this blueprint
              </p>
              {sources.map((source) => (
                <Button
                  className="h-auto justify-start py-3"
                  disabled={disabled || !workbookEnabled}
                  key={source.sourceId}
                  onClick={() => onSelectWorkbook(source.sourceId)}
                  type="button"
                  variant="outline"
                >
                  <FileSpreadsheet />
                  {getSourceDisplayName(source)}
                </Button>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              No workbooks have been added to this blueprint yet.
            </p>
          )}

          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Add workbook
            </p>
            <Button disabled type="button" variant="outline">
              Choose from library (not available yet)
            </Button>
            <Button
              disabled={disabled || !onUploadWorkbook}
              onClick={onUploadWorkbook}
              type="button"
              variant="outline"
            >
              Upload a new file
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReferenceTypeButton({
  description,
  disabled,
  icon,
  label,
  onClick,
}: {
  description: string;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick(): void;
}) {
  return (
    <Button
      className="h-auto min-h-28 flex-col items-start justify-between whitespace-normal p-4 text-left"
      disabled={disabled}
      onClick={onClick}
      type="button"
      variant="outline"
    >
      <span className="[&>svg]:size-6">{icon}</span>
      <span className="grid gap-1">
        <span className="font-semibold">{label}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {description}
        </span>
      </span>
    </Button>
  );
}

function isWorkbookPickerInteraction(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        '[data-workbook-picker-dialog="true"], [data-reference-source-dialog="true"]',
      ),
    )
  );
}

function isAllowedSourceType(
  allowedSourceTypes: ReferenceSourceDraft["type"][] | undefined,
  sourceType: ReferenceSourceDraft["type"],
) {
  return !allowedSourceTypes || allowedSourceTypes.includes(sourceType);
}
