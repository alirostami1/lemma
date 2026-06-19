import { Button } from "@lemma/ui/components/button";
import { FieldGroup } from "@lemma/ui/components/field";
import { Input } from "@lemma/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lemma/ui/components/select";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  ComposedEditorModel,
  ComposedReferenceDraft,
  ReferenceSourceDraft,
} from "#/domains/questions/authoring";
import {
  coerceLiteralExpressionValue,
  formatAnswerInputValue,
  isReferenceSourceDraftType,
} from "#/domains/questions/authoring";
import type { ReferencePreviewValue } from "#/domains/questions/reference-preview";
import { WorkbookInputGroup } from "#/features/questions/table-block-editor";
import type { EditorSelection } from "../editor-selection";
import { InspectorField } from "./inspector-field";
import {
  removeUnusedReferenceFromModel,
  renameReferenceInModel,
} from "./reference-inspector-helpers";

type ReferenceEditorProps = {
  model: ComposedEditorModel;
  referenceId: string;
  preview?: ReferencePreviewValue;
  workbookEnabled: boolean;
  disabled?: boolean;
  onModelChange(model: ComposedEditorModel): void;
  onSelectionChange(selection: EditorSelection): void;
};

export function ReferenceEditor(props: ReferenceEditorProps) {
  const reference =
    props.model.references.find(
      (candidate) => candidate.id === props.referenceId,
    ) ?? null;

  if (!reference) {
    return (
      <p className="text-sm text-muted-foreground">Reference not found.</p>
    );
  }

  return <ReferenceEditorFields {...props} reference={reference} />;
}

type ReferenceEditorFieldsProps = Omit<ReferenceEditorProps, "referenceId"> & {
  reference: ComposedReferenceDraft;
};

function ReferenceEditorFields({
  model,
  preview,
  workbookEnabled,
  disabled,
  onModelChange,
  onSelectionChange,
  reference,
}: ReferenceEditorFieldsProps) {
  const [draftName, setDraftName] = useState(reference.id);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    setDraftName(reference.id);
    setNameError(null);
  }, [reference.id]);

  function commitName() {
    const result = renameReferenceInModel({
      model,
      previousReferenceId: reference.id,
      nextReferenceId: draftName,
    });

    if (result.status !== "renamed") {
      setNameError(result.message);
      return;
    }

    setNameError(null);
    onModelChange(result.model);
    onSelectionChange({ type: "reference", referenceId: result.referenceId });
  }

  function updateReference(
    updater: (current: ComposedReferenceDraft) => ComposedReferenceDraft,
  ) {
    onModelChange({
      ...model,
      references: model.references.map((candidate) =>
        candidate.id === reference.id ? updater(candidate) : candidate,
      ),
    });
  }

  function handleDelete() {
    const nextModel = removeUnusedReferenceFromModel({
      model,
      referenceId: reference.id,
    });
    const nextReference = nextModel.references[0] ?? null;
    onModelChange(nextModel);
    onSelectionChange(
      nextReference
        ? { type: "reference", referenceId: nextReference.id }
        : { type: "document" },
    );
  }

  const sourceType = reference.source.type;
  const literalValue =
    sourceType === "literal"
      ? formatAnswerInputValue(reference.source.value)
      : "";
  const previewStatus = preview?.status ?? "missing_source";

  return (
    <div className="grid gap-4">
      <FieldGroup>
        <InspectorField label="Reference ID" error={nameError ?? undefined}>
          <Input
            id={`${reference.id}-name`}
            value={draftName}
            disabled={disabled}
            onBlur={commitName}
            onChange={(event) => {
              setDraftName(event.currentTarget.value);
              if (nameError) {
                setNameError(null);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitName();
              }
            }}
          />
        </InspectorField>

        <InspectorField label="Display label">
          <Input
            id={`${reference.id}-label`}
            value={reference.label ?? ""}
            disabled={disabled}
            placeholder={reference.id}
            onChange={(event) =>
              updateReference((current) => ({
                ...current,
                label: event.currentTarget.value || undefined,
              }))
            }
          />
        </InspectorField>

        <InspectorField label="Source">
          <Select
            value={sourceType}
            disabled={disabled}
            onValueChange={(value) => {
              if (!isReferenceSourceDraftType(value)) {
                return;
              }
              updateReference((current) => ({
                ...current,
                source: createNextReferenceSource(current.source, value),
              }));
            }}
          >
            <SelectTrigger aria-label="Source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="literal">Literal value</SelectItem>
              <SelectItem value="workbook_cell">Workbook cell</SelectItem>
              <SelectItem value="workbook_range">Workbook range</SelectItem>
            </SelectContent>
          </Select>
        </InspectorField>

        {sourceType === "literal" ? (
          <InspectorField label="Literal value">
            <Input
              id={`${reference.id}-literal`}
              value={literalValue}
              disabled={disabled}
              onChange={(event) =>
                updateReference((current) => ({
                  ...current,
                  source: {
                    type: "literal",
                    value: coerceLiteralExpressionValue(
                      event.currentTarget.value,
                    ),
                  },
                }))
              }
            />
          </InspectorField>
        ) : (
          <InspectorField
            label={
              sourceType === "workbook_range" ? "Source range" : "Source cell"
            }
          >
            <WorkbookInputGroup
              id={`${reference.id}-workbook`}
              value={reference.source.ref}
              disabled={disabled || !workbookEnabled}
              placeholder="Select a workbook source"
              workbookSelectionRequirement={{
                selectionType:
                  sourceType === "workbook_range" ? "range" : "cell",
              }}
              onChange={(event) =>
                updateReference((current) =>
                  current.source.type === "literal"
                    ? current
                    : {
                        ...current,
                        source: {
                          type: current.source.type,
                          sourceId: current.source.sourceId,
                          ref: event.currentTarget.value,
                        },
                      },
                )
              }
              onWorkbookSelect={(selection) =>
                updateReference((current) =>
                  current.source.type === "literal"
                    ? current
                    : {
                        ...current,
                        source: {
                          type: current.source.type,
                          sourceId: selection.sourceId ?? "source_1",
                          ref: selection.reference,
                        },
                      },
                )
              }
            />
            {!workbookEnabled ? (
              <p className="text-xs text-muted-foreground">
                Select a workbook to reference cells.
              </p>
            ) : null}
          </InspectorField>
        )}

        <ReferencePreviewSummary
          reference={reference}
          previewStatus={previewStatus}
          preview={preview}
        />
      </FieldGroup>

      <Button
        type="button"
        variant="destructive"
        disabled={disabled}
        onClick={handleDelete}
      >
        <Trash2 />
        Delete reference
      </Button>
    </div>
  );
}

function ReferencePreviewSummary({
  reference,
  previewStatus,
  preview,
}: {
  reference: ComposedReferenceDraft;
  previewStatus: ReferencePreviewValue["status"];
  preview?: ReferencePreviewValue;
}) {
  const text = getReferencePreviewText(reference, previewStatus, preview);

  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
      <p className="truncate">{text}</p>
    </div>
  );
}

function getReferencePreviewText(
  reference: ComposedReferenceDraft,
  previewStatus: ReferencePreviewValue["status"],
  preview?: ReferencePreviewValue,
) {
  if (reference.source.type === "literal" && !preview) {
    return formatAnswerInputValue(reference.source.value);
  }

  if (previewStatus === "resolved") {
    return preview?.displayValue ?? "";
  }

  if (previewStatus === "error") {
    return "Could not resolve source";
  }

  return "Missing source";
}

function createNextReferenceSource(
  source: ReferenceSourceDraft,
  type: ReferenceSourceDraft["type"],
): ReferenceSourceDraft {
  if (type === "literal") {
    return source.type === "literal"
      ? { type: "literal", value: source.value }
      : { type: "literal", value: "" };
  }

  if (source.type === "workbook_cell" || source.type === "workbook_range") {
    return source.type === type
      ? { type: source.type, sourceId: source.sourceId, ref: source.ref }
      : { type, sourceId: source.sourceId, ref: "" };
  }

  return { type, sourceId: "source_1", ref: "" };
}
