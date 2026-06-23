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
  getReferenceIdIssue,
  getSourceDisplayName,
} from "./reference-inspector-helpers";

export type ReferenceCreateFormProps = {
  model: ComposedEditorModel;
  workbookEnabled: boolean;
  sources: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
  allowedSourceTypes?: ReferenceSourceDraft["type"][];
  initialSourceType?: ReferenceSourceDraft["type"];
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
  disabled,
  autoFocus,
  submitLabel = "Create reference",
  cancelLabel = "Cancel",
  onCreated,
  onCancel,
}: ReferenceCreateFormProps) {
  const initialLiteralReferenceId = useMemo(
    () => createUniqueReferenceDraft(model).id,
    [model],
  );
  const [referenceId, setReferenceId] = useState(initialLiteralReferenceId);
  const [sourceType, setSourceType] = useState<ReferenceSourceDraft["type"]>(
    () => getInitialSourceType(allowedSourceTypes, initialSourceType),
  );
  const [literalValue, setLiteralValue] = useState("");
  const [selectedWorkbookSourceId, setSelectedWorkbookSourceId] = useState<
    string | null
  >(() => getInitialWorkbookSourceId(sources));
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
            reason: "Select a source before creating workbook references.",
            status: "invalid",
          } as const),
    [cellOrRange, selectedSheetName, workbookSourceId],
  );
  const duplicateWorkbookReference =
    workbookReference.status === "normalized"
      ? (model.references.find(
          (reference) => reference.id === workbookReference.referenceId,
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
    referenceId,
    selectedSheetName,
    selectedWorkbookSourceId,
    sourceType,
  ]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (sourceType === "literal") {
      const issue = getReferenceIdIssue(model, referenceId);
      if (issue) {
        setError(issue.message);
        return;
      }

      onCreated({
        mode: "created",
        reference: {
          id: referenceId.trim().replace(/^\./u, "").trim(),
          source: {
            type: "literal",
            value: coerceLiteralExpressionValue(literalValue),
          },
        },
        referenceId: referenceId.trim().replace(/^\./u, "").trim(),
      });
      resetForm();
      return;
    }

    if (workbookReference.status !== "normalized") {
      setError(workbookReference.reason);
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
        id: workbookReference.referenceId,
        source: workbookReference.source,
      },
      referenceId: workbookReference.referenceId,
    });
    resetForm();
  }

  function resetForm() {
    setReferenceId(createUniqueReferenceDraft(model).id);
    setSourceType(getInitialSourceType(allowedSourceTypes, initialSourceType));
    setLiteralValue("");
    setSelectedWorkbookSourceId(getInitialWorkbookSourceId(sources));
    setSelectedSheetName("");
    setCellOrRange("");
    setError(null);
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <FieldGroup>
        {sourceType === "literal" ? (
          <InspectorField
            description="Literal references use syntax like {{ .referenceId }}."
            error={error ?? undefined}
            label="Reference id"
          >
            <Input
              autoFocus={autoFocus}
              disabled={disabled}
              id="reference-id"
              onChange={(event) => setReferenceId(event.currentTarget.value)}
              value={referenceId}
            />
          </InspectorField>
        ) : null}

        {singleAllowedSourceType ? null : (
          <InspectorField label="Source type">
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
              <SelectTrigger
                aria-label="Source type"
                id="reference-source-type"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isAllowedSourceType(allowedSourceTypes, "literal") ? (
                  <SelectItem value="literal">Literal value</SelectItem>
                ) : null}
                {isAllowedSourceType(allowedSourceTypes, "workbook_cell") ? (
                  <SelectItem disabled={!workbookEnabled} value="workbook_cell">
                    Workbook cell
                  </SelectItem>
                ) : null}
                {isAllowedSourceType(allowedSourceTypes, "workbook_range") ? (
                  <SelectItem
                    disabled={!workbookEnabled}
                    value="workbook_range"
                  >
                    Workbook range
                  </SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </InspectorField>
        )}

        {sourceType === "literal" ? (
          <InspectorField label="Literal value">
            <Input
              disabled={disabled}
              id="reference-literal"
              onChange={(event) => setLiteralValue(event.currentTarget.value)}
              value={formatAnswerInputValue(literalValue)}
            />
          </InspectorField>
        ) : sources.length === 0 ? (
          <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
            Add a source before creating workbook references.
          </div>
        ) : (
          <>
            <InspectorField error={error ?? undefined} label="Source">
              <Select
                disabled={disabled}
                onValueChange={(value) => setSelectedWorkbookSourceId(value)}
                value={workbookSourceId ?? ""}
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

            <InspectorField label="Reference name">
              <div className="rounded-md border bg-muted/20 px-3 py-2 font-mono text-sm">
                {workbookReference.status === "normalized"
                  ? workbookReference.referenceId
                  : "Select source, sheet, and cell or range."}
              </div>
              {duplicateWorkbookReference ? (
                <p className="text-xs text-muted-foreground">
                  This reference already exists. Inserting it will reuse
                  existing reference.
                </p>
              ) : null}
            </InspectorField>
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
          {duplicateWorkbookReference ? "Use existing reference" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function getInitialWorkbookSourceId(
  sources: QuestionBlueprintWorkbookSource[],
): string | null {
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

function buildWorkbookRawRef(sheetName: string, cellOrRange: string): string {
  const trimmedSheetName = sheetName.trim();
  const trimmedCellOrRange = cellOrRange.trim();
  if (!trimmedSheetName || !trimmedCellOrRange) {
    return trimmedCellOrRange;
  }

  return `${trimmedSheetName}!${trimmedCellOrRange}`;
}
