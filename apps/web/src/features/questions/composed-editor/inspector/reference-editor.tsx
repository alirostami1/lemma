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
import { useEffect, useMemo, useState } from "react";
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
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import {
  getWorkbookReferenceDisplayName,
  normalizeWorkbookRefInput,
} from "#/domains/questions/reference-names";
import type { ReferencePreviewValue } from "#/domains/questions/reference-preview";
import { parseWorkbookRef } from "#/domains/questions/workbook-reference";
import { WorkbookInputGroup } from "#/features/questions/table-block-editor";
import type { EditorSelection } from "../editor-selection";
import { InspectorField } from "./inspector-field";
import {
  getSourceDisplayName,
  mergeReferenceIntoExistingModel,
  removeUnusedReferenceFromModel,
  renameReferenceInModel,
} from "./reference-inspector-helpers";

type ReferenceEditorProps = {
  model: ComposedEditorModel;
  referenceId: string;
  preview?: ReferencePreviewValue;
  workbookEnabled: boolean;
  sources?: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
  disabled?: boolean;
  onModelChange(model: ComposedEditorModel): void;
  onSelectionChange(selection: EditorSelection): void;
};

export function ReferenceEditor(props: ReferenceEditorProps) {
  const sources = props.sources ?? [];
  const reference =
    props.model.references.find(
      (candidate) => candidate.id === props.referenceId,
    ) ?? null;

  if (!reference) {
    return (
      <p className="text-sm text-muted-foreground">Reference not found.</p>
    );
  }

  return (
    <ReferenceEditorFields
      {...props}
      reference={reference}
      sources={sources}
      workbookSheetNamesBySourceId={props.workbookSheetNamesBySourceId ?? {}}
    />
  );
}

type ReferenceEditorFieldsProps = Omit<ReferenceEditorProps, "referenceId"> & {
  reference: ComposedReferenceDraft;
  workbookSheetNamesBySourceId: Readonly<Record<string, readonly string[]>>;
};

function ReferenceEditorFields({
  model,
  preview,
  workbookEnabled,
  sources = [],
  workbookSheetNamesBySourceId,
  disabled,
  onModelChange,
  onSelectionChange,
  reference,
}: ReferenceEditorFieldsProps) {
  const [draftName, setDraftName] = useState(reference.id);
  const [nameError, setNameError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const workbookFields = useMemo(
    () => getWorkbookFieldDraft(reference.source),
    [reference.source],
  );
  const [selectedWorkbookSourceId, setSelectedWorkbookSourceId] = useState<
    string | null
  >(workbookFields.sourceId);
  const [selectedSheetName, setSelectedSheetName] = useState(
    workbookFields.sheetName,
  );
  const [cellOrRange, setCellOrRange] = useState(workbookFields.cellOrRange);

  useEffect(() => {
    const nextFields = getWorkbookFieldDraft(reference.source);
    setDraftName(reference.id);
    setNameError(null);
    setSourceError(null);
    setSelectedWorkbookSourceId(nextFields.sourceId);
    setSelectedSheetName(nextFields.sheetName);
    setCellOrRange(nextFields.cellOrRange);
  }, [reference.id, reference.source]);

  const sourceType = reference.source.type;
  const literalValue =
    sourceType === "literal"
      ? formatAnswerInputValue(reference.source.value)
      : "";
  const previewStatus = preview?.status ?? "missing_source";
  const resolvedWorkbookSourceId = getResolvedWorkbookSourceId(
    selectedWorkbookSourceId,
    reference.source,
    sources,
  );
  const workbookSheetOptions =
    (resolvedWorkbookSourceId
      ? workbookSheetNamesBySourceId[resolvedWorkbookSourceId]
      : undefined) ?? [];
  const computedWorkbookReference =
    sourceType === "workbook_cell" || sourceType === "workbook_range"
      ? normalizeWorkbookRefInput({
          defaultSheetName: selectedSheetName.trim() || null,
          rawRef: buildWorkbookRawRef(selectedSheetName, cellOrRange),
          sourceId: resolvedWorkbookSourceId ?? "",
        })
      : null;

  function commitName() {
    if (sourceType !== "literal") {
      return;
    }

    const result = renameReferenceInModel({
      model,
      nextReferenceId: draftName,
      previousReferenceId: reference.id,
    });

    if (result.status !== "renamed") {
      setNameError(result.message);
      return;
    }

    setNameError(null);
    onModelChange(result.model);
    onSelectionChange({ referenceId: result.referenceId, type: "reference" });
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
        ? { referenceId: nextReference.id, type: "reference" }
        : { type: "document" },
    );
  }

  function updateWorkbookReferenceDraft(input: {
    sourceId: string | null;
    sheetName: string;
    cellOrRange: string;
    sourceType: Extract<
      ReferenceSourceDraft["type"],
      "workbook_cell" | "workbook_range"
    >;
  }) {
    setSelectedWorkbookSourceId(input.sourceId);
    setSelectedSheetName(input.sheetName);
    setCellOrRange(input.cellOrRange);

    if (!input.sourceId) {
      setSourceError("Select a source before creating workbook references.");
      return;
    }

    const normalized = normalizeWorkbookRefInput({
      defaultSheetName: input.sheetName.trim() || null,
      rawRef: buildWorkbookRawRef(input.sheetName, input.cellOrRange),
      sourceId: input.sourceId,
    });
    if (normalized.status !== "normalized") {
      setSourceError(normalized.reason);
      return;
    }

    const duplicateReference =
      normalized.referenceId !== reference.id
        ? (model.references.find(
            (candidate) => candidate.id === normalized.referenceId,
          ) ?? null)
        : null;
    if (duplicateReference) {
      const nextModel = mergeReferenceIntoExistingModel({
        model,
        nextReferenceId: duplicateReference.id,
        previousReferenceId: reference.id,
      });
      onModelChange(nextModel);
      onSelectionChange({
        referenceId: duplicateReference.id,
        type: "reference",
      });
      setSourceError(null);
      return;
    }

    const renameResult =
      normalized.referenceId === reference.id
        ? null
        : renameReferenceInModel({
            model,
            nextReferenceId: normalized.referenceId,
            previousReferenceId: reference.id,
          });
    const renamedModel =
      renameResult === null
        ? model
        : renameResult.status === "renamed"
          ? renameResult.model
          : model;
    const nextReferenceId =
      normalized.referenceId === reference.id
        ? reference.id
        : normalized.referenceId;

    onModelChange({
      ...renamedModel,
      references: renamedModel.references.map((candidate) =>
        candidate.id === nextReferenceId
          ? {
              ...candidate,
              source: normalized.source,
            }
          : candidate,
      ),
    });
    onSelectionChange({ referenceId: nextReferenceId, type: "reference" });
    setSourceError(null);
  }

  return (
    <div className="grid gap-4">
      <FieldGroup>
        {sourceType === "literal" ? (
          <InspectorField error={nameError ?? undefined} label="Reference ID">
            <Input
              disabled={disabled}
              id={`${reference.id}-name`}
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
              value={draftName}
            />
          </InspectorField>
        ) : (
          <InspectorField
            error={sourceError ?? undefined}
            label="Reference name"
          >
            <div className="rounded-md border bg-muted/20 px-3 py-2 font-mono text-sm">
              {computedWorkbookReference?.status === "normalized"
                ? computedWorkbookReference.referenceId
                : reference.id}
            </div>
          </InspectorField>
        )}

        <InspectorField label="Display label">
          <Input
            disabled={disabled}
            id={`${reference.id}-label`}
            onChange={(event) =>
              updateReference((current) => ({
                ...current,
                label: event.currentTarget.value || undefined,
              }))
            }
            placeholder={reference.id}
            value={reference.label ?? ""}
          />
        </InspectorField>

        <InspectorField error={sourceError ?? undefined} label="Source">
          <Select
            disabled={disabled}
            onValueChange={(value) => {
              if (!isReferenceSourceDraftType(value)) {
                return;
              }
              if (value === "literal") {
                updateReference((current) => ({
                  ...current,
                  source:
                    current.source.type === "literal"
                      ? current.source
                      : { type: "literal", value: "" },
                }));
                setSourceError(null);
                return;
              }

              const defaultSourceId =
                sources.length === 1 ? (sources[0]?.sourceId ?? null) : null;
              if (sources.length === 0) {
                setSourceError(
                  "Attach a source before using workbook references.",
                );
                return;
              }

              updateWorkbookReferenceDraft({
                cellOrRange,
                sheetName: selectedSheetName,
                sourceId:
                  reference.source.type === "workbook_cell" ||
                  reference.source.type === "workbook_range"
                    ? reference.source.sourceId
                    : defaultSourceId,
                sourceType: value,
              });
            }}
            value={sourceType}
          >
            <SelectTrigger aria-label="Source type">
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
              disabled={disabled}
              id={`${reference.id}-literal`}
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
              value={literalValue}
            />
          </InspectorField>
        ) : (
          <>
            <InspectorField label="Source">
              <Select
                disabled={disabled || !workbookEnabled || sources.length === 0}
                onValueChange={(value) =>
                  updateWorkbookReferenceDraft({
                    cellOrRange,
                    sheetName:
                      workbookSheetNamesBySourceId[value]?.[0] &&
                      !selectedSheetName
                        ? (workbookSheetNamesBySourceId[value]?.[0] ?? "")
                        : selectedSheetName,
                    sourceId: value,
                    sourceType,
                  })
                }
                value={resolvedWorkbookSourceId ?? ""}
              >
                <SelectTrigger aria-label="Source">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((source) => (
                    <SelectItem key={source.sourceId} value={source.sourceId}>
                      {getSourceDisplayName(source)} ({source.sourceId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </InspectorField>

            <InspectorField label="Sheet">
              {workbookSheetOptions.length > 0 ? (
                <Select
                  disabled={disabled || resolvedWorkbookSourceId === null}
                  onValueChange={(value) =>
                    updateWorkbookReferenceDraft({
                      cellOrRange,
                      sheetName: value,
                      sourceId: resolvedWorkbookSourceId,
                      sourceType,
                    })
                  }
                  value={selectedSheetName}
                >
                  <SelectTrigger aria-label="Sheet">
                    <SelectValue placeholder="Select sheet" />
                  </SelectTrigger>
                  <SelectContent>
                    {workbookSheetOptions.map((sheetName) => (
                      <SelectItem key={sheetName} value={sheetName}>
                        {sheetName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  disabled={disabled || resolvedWorkbookSourceId === null}
                  id={`${reference.id}-sheet`}
                  onBlur={() =>
                    updateWorkbookReferenceDraft({
                      cellOrRange,
                      sheetName: selectedSheetName,
                      sourceId: resolvedWorkbookSourceId,
                      sourceType,
                    })
                  }
                  onChange={(event) => {
                    setSelectedSheetName(event.currentTarget.value);
                  }}
                  placeholder="Sheet1"
                  value={selectedSheetName}
                />
              )}
            </InspectorField>

            <InspectorField
              description={
                sourceType === "workbook_range"
                  ? "Use A1:B3 format."
                  : "Use A1 format."
              }
              label="Cell or range"
            >
              <WorkbookInputGroup
                disabled={
                  disabled ||
                  !workbookEnabled ||
                  resolvedWorkbookSourceId === null
                }
                id={`${reference.id}-workbook`}
                onBlur={() =>
                  updateWorkbookReferenceDraft({
                    cellOrRange,
                    sheetName: selectedSheetName,
                    sourceId: resolvedWorkbookSourceId,
                    sourceType,
                  })
                }
                onChange={(event) => {
                  setCellOrRange(event.currentTarget.value);
                }}
                onWorkbookSelect={(selection) => {
                  const parsed = parseWorkbookRef(selection.reference);
                  if (!parsed) {
                    return;
                  }

                  updateWorkbookReferenceDraft({
                    cellOrRange:
                      getWorkbookReferenceDisplayName({
                        ref: selection.reference,
                        sourceId: selection.sourceId,
                        type: parsed.hasRange
                          ? "workbook_range"
                          : "workbook_cell",
                      }).split("!")[1] ?? "",
                    sheetName: parsed.sheetName,
                    sourceId: selection.sourceId,
                    sourceType,
                  });
                }}
                placeholder={sourceType === "workbook_range" ? "A1:B3" : "A1"}
                sourceId={resolvedWorkbookSourceId}
                value={cellOrRange}
                workbookSelectionRequirement={{
                  selectionType:
                    sourceType === "workbook_range" ? "range" : "cell",
                }}
              />
            </InspectorField>
          </>
        )}

        <ReferencePreviewSummary
          preview={preview}
          previewStatus={previewStatus}
          reference={reference}
        />
      </FieldGroup>

      <Button
        disabled={disabled}
        onClick={handleDelete}
        type="button"
        variant="destructive"
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
    return "Could not resolve reference value";
  }

  return "Reference value unavailable";
}

function getWorkbookFieldDraft(source: ReferenceSourceDraft): {
  sourceId: string | null;
  sheetName: string;
  cellOrRange: string;
} {
  if (source.type !== "workbook_cell" && source.type !== "workbook_range") {
    return { cellOrRange: "", sheetName: "", sourceId: null };
  }

  const parsed = parseWorkbookRef(source.ref);
  if (!parsed) {
    return {
      cellOrRange: source.ref,
      sheetName: "",
      sourceId: source.sourceId,
    };
  }

  return {
    cellOrRange: getWorkbookReferenceDisplayName(source).split("!")[1] ?? "",
    sheetName: parsed.sheetName,
    sourceId: source.sourceId,
  };
}

function getResolvedWorkbookSourceId(
  selectedWorkbookSourceId: string | null,
  source: ReferenceSourceDraft,
  sources: QuestionBlueprintWorkbookSource[],
): string | null {
  if (
    selectedWorkbookSourceId &&
    sources.some((candidate) => candidate.sourceId === selectedWorkbookSourceId)
  ) {
    return selectedWorkbookSourceId;
  }

  if (
    (source.type === "workbook_cell" || source.type === "workbook_range") &&
    sources.some((candidate) => candidate.sourceId === source.sourceId)
  ) {
    return source.sourceId;
  }

  return sources.length === 1 ? (sources[0]?.sourceId ?? null) : null;
}

function buildWorkbookRawRef(sheetName: string, cellOrRange: string): string {
  const trimmedSheetName = sheetName.trim();
  const trimmedCellOrRange = cellOrRange.trim();
  if (!trimmedSheetName || !trimmedCellOrRange) {
    return trimmedCellOrRange;
  }

  return `${trimmedSheetName}!${trimmedCellOrRange}`;
}
