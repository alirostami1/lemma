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
import { type FormEvent, useEffect, useMemo, useState } from "react";
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
import { parseWorkbookRef } from "#/domains/questions/workbook-reference";
import { WorkbookInputGroup } from "#/features/questions/table-block-editor";
import { InspectorField } from "./inspector-field";
import {
  createUniqueReferenceDraft,
  getSourceDisplayName,
} from "./reference-inspector-helpers";

export type ReferenceCreateFormProps = {
  model: ComposedEditorModel;
  workbookEnabled: boolean;
  sources: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
  allowedSourceTypes?: ReferenceSourceDraft["type"][];
  initialSourceType?: ReferenceSourceDraft["type"];
  initialWorkbookSourceId?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onCreated(input: {
    mode: "created" | "reused";
    referenceId: string;
    reference: ComposedReferenceDraft | null;
  }): void;
  onCancel?(): void;
};

export function ReferenceCreateForm({
  model,
  workbookEnabled,
  sources,
  workbookSheetNamesBySourceId = {},
  allowedSourceTypes,
  initialSourceType = "literal",
  initialWorkbookSourceId,
  disabled,
  autoFocus,
  submitLabel = "Add this value",
  cancelLabel = "Cancel",
  onCreated,
  onCancel,
}: ReferenceCreateFormProps) {
  const [referenceName, setReferenceName] = useState("");
  const [sourceType, setSourceType] = useState<ReferenceSourceDraft["type"]>(
    () => getInitialSourceType(allowedSourceTypes, initialSourceType),
  );
  const [literalValue, setLiteralValue] = useState("");
  const [selectedWorkbookSourceId, setSelectedWorkbookSourceId] = useState<
    string | null
  >(() => getInitialWorkbookSourceId(sources, initialWorkbookSourceId));
  const [selectedSheetName, setSelectedSheetName] = useState("");
  const [cellOrRange, setCellOrRange] = useState("");
  const [error, setError] = useState<string | null>(null);
  const singleAllowedSourceType =
    allowedSourceTypes && allowedSourceTypes.length === 1
      ? allowedSourceTypes[0]
      : null;
  const workbookSourceId = getResolvedWorkbookSourceId(
    selectedWorkbookSourceId,
    sources,
  );
  const workbookSheetOptions =
    (workbookSourceId
      ? workbookSheetNamesBySourceId[workbookSourceId]
      : undefined) ?? [];
  const workbookReference = useMemo(
    () =>
      workbookSourceId
        ? normalizeWorkbookRefInput({
            defaultSheetName: selectedSheetName.trim() || null,
            rawRef: buildWorkbookRawRef(selectedSheetName, cellOrRange),
            sourceId: workbookSourceId,
          })
        : ({
            reason: "Select a workbook before choosing a cell or range.",
            status: "invalid",
          } as const),
    [cellOrRange, selectedSheetName, workbookSourceId],
  );
  const workbookSelectionTypeIssue =
    workbookReference.status === "normalized"
      ? getWorkbookSelectionTypeIssue({
          allowedSourceTypes,
          normalizedSourceType: workbookReference.source.type,
          requestedSourceType: sourceType,
        })
      : null;
  const validWorkbookReference =
    workbookReference.status === "normalized" && !workbookSelectionTypeIssue
      ? workbookReference
      : null;
  const duplicateWorkbookReference = validWorkbookReference
    ? (model.references.find(
        (reference) => reference.id === validWorkbookReference.referenceId,
      ) ?? null)
    : null;

  useEffect(() => {
    const nextSourceId = getResolvedWorkbookSourceId(
      selectedWorkbookSourceId,
      sources,
    );
    if (nextSourceId !== selectedWorkbookSourceId) {
      setSelectedWorkbookSourceId(nextSourceId);
    }
  }, [selectedWorkbookSourceId, sources]);

  useEffect(() => {
    if (!workbookSourceId) {
      setSelectedSheetName("");
      return;
    }

    if (
      selectedSheetName &&
      (workbookSheetOptions.length === 0 ||
        workbookSheetOptions.includes(selectedSheetName))
    ) {
      return;
    }

    setSelectedSheetName(workbookSheetOptions[0] ?? "");
  }, [selectedSheetName, workbookSheetOptions, workbookSourceId]);

  useEffect(() => {
    setError(null);
  }, [
    cellOrRange,
    literalValue,
    referenceName,
    selectedSheetName,
    selectedWorkbookSourceId,
    sourceType,
  ]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (sourceType === "literal") {
      const label = referenceName.trim();
      if (!label) {
        setError("Enter a name.");
        return;
      }
      const referenceId = createUniqueReferenceDraft(model).id;

      onCreated({
        mode: "created",
        reference: {
          id: referenceId,
          label,
          source: {
            type: "literal",
            value: coerceLiteralExpressionValue(literalValue),
          },
        },
        referenceId,
      });
      resetForm();
      return;
    }

    if (workbookReference.status !== "normalized") {
      setError(workbookReference.reason);
      return;
    }

    if (workbookSelectionTypeIssue) {
      setError(workbookSelectionTypeIssue);
      return;
    }
    if (!validWorkbookReference) {
      setError(
        sourceType === "workbook_range"
          ? "Select a range, for example A1:B3."
          : "Select a single cell, for example A1.",
      );
      return;
    }

    if (duplicateWorkbookReference) {
      onCreated({
        mode: "reused",
        reference: null,
        referenceId: duplicateWorkbookReference.id,
      });
      resetForm();
      return;
    }

    onCreated({
      mode: "created",
      reference: {
        id: validWorkbookReference.referenceId,
        source: validWorkbookReference.source,
      },
      referenceId: validWorkbookReference.referenceId,
    });
    resetForm();
  }

  function resetForm() {
    setReferenceName("");
    setSourceType(getInitialSourceType(allowedSourceTypes, initialSourceType));
    setLiteralValue("");
    setSelectedWorkbookSourceId(
      getInitialWorkbookSourceId(sources, initialWorkbookSourceId),
    );
    setSelectedSheetName("");
    setCellOrRange("");
    setError(null);
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <FieldGroup>
        {sourceType === "literal" ? (
          <InspectorField
            description="Give this value a short name so you can recognize it later."
            error={error ?? undefined}
            label="Name"
          >
            <Input
              autoFocus={autoFocus}
              disabled={disabled}
              id="reference-id"
              onChange={(event) => setReferenceName(event.currentTarget.value)}
              placeholder="For example: Tax rate"
              value={referenceName}
            />
          </InspectorField>
        ) : null}

        {singleAllowedSourceType ? null : (
          <InspectorField label="Selection">
            <Select
              disabled={disabled}
              onValueChange={(value) => {
                if (!isReferenceSourceDraftType(value)) {
                  return;
                }
                setSourceType(value);
              }}
              value={sourceType}
            >
              <SelectTrigger aria-label="Selection" id="reference-source-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isAllowedSourceType(allowedSourceTypes, "literal") ? (
                  <SelectItem value="literal">Static value</SelectItem>
                ) : null}
                {isAllowedSourceType(allowedSourceTypes, "workbook_cell") ? (
                  <SelectItem disabled={!workbookEnabled} value="workbook_cell">
                    Cell
                  </SelectItem>
                ) : null}
                {isAllowedSourceType(allowedSourceTypes, "workbook_range") ? (
                  <SelectItem
                    disabled={!workbookEnabled}
                    value="workbook_range"
                  >
                    Range
                  </SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </InspectorField>
        )}

        {sourceType === "literal" ? (
          <InspectorField label="Value">
            <Input
              disabled={disabled}
              id="reference-literal"
              onChange={(event) => setLiteralValue(event.currentTarget.value)}
              value={formatAnswerInputValue(literalValue)}
            />
          </InspectorField>
        ) : sources.length === 0 ? (
          <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
            Add a workbook before choosing a cell or range.
          </div>
        ) : (
          <>
            {initialWorkbookSourceId ? null : (
              <InspectorField error={error ?? undefined} label="Workbook">
                <Select
                  disabled={disabled}
                  onValueChange={(value) => setSelectedWorkbookSourceId(value)}
                  value={workbookSourceId ?? ""}
                >
                  <SelectTrigger aria-label="Workbook">
                    <SelectValue placeholder="Select workbook" />
                  </SelectTrigger>
                  <SelectContent>
                    {sources.map((source) => (
                      <SelectItem key={source.sourceId} value={source.sourceId}>
                        {getSourceDisplayName(source)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </InspectorField>
            )}

            <InspectorField label="Sheet">
              {workbookSheetOptions.length > 0 ? (
                <Select
                  disabled={disabled || workbookSourceId === null}
                  onValueChange={setSelectedSheetName}
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
                  autoFocus={autoFocus}
                  disabled={disabled || workbookSourceId === null}
                  id="reference-workbook-sheet"
                  onChange={(event) =>
                    setSelectedSheetName(event.currentTarget.value)
                  }
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
              error={error ?? undefined}
              label="Cell or range"
            >
              <WorkbookInputGroup
                autoFocus={autoFocus}
                disabled={disabled || workbookSourceId === null}
                id="reference-workbook-range"
                onChange={(event) => setCellOrRange(event.currentTarget.value)}
                onWorkbookSelect={(selection) => {
                  const parsedRef = parseWorkbookRef(selection.reference);
                  if (!parsedRef) {
                    return;
                  }

                  setSelectedWorkbookSourceId(selection.sourceId);
                  setSelectedSheetName(parsedRef.sheetName);
                  setCellOrRange(
                    parsedRef.hasRange
                      ? `${
                          getWorkbookReferenceDisplayName({
                            ref: selection.reference,
                            sourceId: selection.sourceId,
                            type: "workbook_range",
                          }).split("!")[1] ?? ""
                        }`
                      : `${
                          getWorkbookReferenceDisplayName({
                            ref: selection.reference,
                            sourceId: selection.sourceId,
                            type: "workbook_cell",
                          }).split("!")[1] ?? ""
                        }`,
                  );
                }}
                placeholder={sourceType === "workbook_range" ? "A1:B3" : "A1"}
                sourceId={workbookSourceId}
                value={cellOrRange}
                workbookSelectionRequirement={{
                  selectionType:
                    sourceType === "workbook_range" ? "range" : "cell",
                }}
              />
            </InspectorField>

            {duplicateWorkbookReference ? (
              <p className="text-xs text-muted-foreground">
                This selection is already available and will be reused.
              </p>
            ) : null}
          </>
        )}
      </FieldGroup>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel ? (
          <Button
            disabled={disabled}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            {cancelLabel}
          </Button>
        ) : null}
        <Button
          disabled={
            disabled ||
            (sourceType !== "literal" &&
              (sources.length === 0 ||
                workbookReference.status !== "normalized"))
          }
          type="submit"
        >
          {duplicateWorkbookReference ? "Use existing value" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function getInitialWorkbookSourceId(
  sources: QuestionBlueprintWorkbookSource[],
  preferredSourceId?: string,
): string | null {
  if (
    preferredSourceId &&
    sources.some((source) => source.sourceId === preferredSourceId)
  ) {
    return preferredSourceId;
  }

  return sources.length === 1 ? (sources[0]?.sourceId ?? null) : null;
}

function getResolvedWorkbookSourceId(
  selectedWorkbookSourceId: string | null,
  sources: QuestionBlueprintWorkbookSource[],
): string | null {
  if (
    selectedWorkbookSourceId &&
    sources.some((source) => source.sourceId === selectedWorkbookSourceId)
  ) {
    return selectedWorkbookSourceId;
  }

  return getInitialWorkbookSourceId(sources);
}

function getInitialSourceType(
  allowedSourceTypes: ReferenceSourceDraft["type"][] | undefined,
  initialSourceType: ReferenceSourceDraft["type"],
): ReferenceSourceDraft["type"] {
  if (!allowedSourceTypes || allowedSourceTypes.includes(initialSourceType)) {
    return initialSourceType;
  }

  return allowedSourceTypes[0] ?? "literal";
}

function isAllowedSourceType(
  allowedSourceTypes: ReferenceSourceDraft["type"][] | undefined,
  sourceType: ReferenceSourceDraft["type"],
): boolean {
  return !allowedSourceTypes || allowedSourceTypes.includes(sourceType);
}

function getWorkbookSelectionTypeIssue({
  allowedSourceTypes,
  normalizedSourceType,
  requestedSourceType,
}: {
  allowedSourceTypes: ReferenceSourceDraft["type"][] | undefined;
  normalizedSourceType: "workbook_cell" | "workbook_range";
  requestedSourceType: ReferenceSourceDraft["type"];
}): string | null {
  if (requestedSourceType === "workbook_range") {
    return normalizedSourceType === "workbook_range"
      ? null
      : "Select a range, for example A1:B3.";
  }

  if (requestedSourceType === "workbook_cell") {
    return normalizedSourceType === "workbook_cell"
      ? null
      : "Select a single cell, for example A1.";
  }

  if (!isAllowedSourceType(allowedSourceTypes, normalizedSourceType)) {
    return normalizedSourceType === "workbook_cell"
      ? "Select a range, for example A1:B3."
      : "Select a single cell, for example A1.";
  }

  return null;
}

function buildWorkbookRawRef(sheetName: string, cellOrRange: string): string {
  const trimmedSheetName = sheetName.trim();
  const trimmedCellOrRange = cellOrRange.trim();
  if (!trimmedSheetName || !trimmedCellOrRange) {
    return trimmedCellOrRange;
  }

  return `${trimmedSheetName}!${trimmedCellOrRange}`;
}
