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
  previewSourceId: string | null;
  allowedSourceTypes?: ReferenceSourceDraft["type"][];
  initialSourceType?: ReferenceSourceDraft["type"];
  disabled?: boolean;
  autoFocus?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onCreated(reference: ComposedReferenceDraft): void;
  onCancel?(): void;
};

export function ReferenceCreateForm({
  model,
  workbookEnabled,
  sources,
  previewSourceId,
  allowedSourceTypes,
  initialSourceType = "literal",
  disabled,
  autoFocus,
  submitLabel = "Create reference",
  cancelLabel = "Cancel",
  onCreated,
  onCancel,
}: ReferenceCreateFormProps) {
  const initialReferenceId = useMemo(
    () => createUniqueReferenceDraft(model).id,
    [model],
  );
  const [referenceId, setReferenceId] = useState(initialReferenceId);
  const [sourceType, setSourceType] = useState<ReferenceSourceDraft["type"]>(
    () => getInitialSourceType(allowedSourceTypes, initialSourceType),
  );
  const [literalValue, setLiteralValue] = useState("");
  const [selectedWorkbookSourceId, setSelectedWorkbookSourceId] = useState<
    string | null
  >(() => getDefaultWorkbookSourceId(sources, previewSourceId));
  const [workbookRef, setWorkbookRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const singleAllowedSourceType =
    allowedSourceTypes && allowedSourceTypes.length === 1
      ? allowedSourceTypes[0]
      : null;

  useEffect(() => {
    if (sourceType === "literal") {
      return;
    }

    const nextSourceId = getResolvedWorkbookSourceId({
      selectedWorkbookSourceId,
      sources,
      previewSourceId,
    });
    if (nextSourceId === selectedWorkbookSourceId) {
      return;
    }

    setSelectedWorkbookSourceId(nextSourceId);
  }, [previewSourceId, selectedWorkbookSourceId, sourceType, sources]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const issue = getReferenceIdIssue(model, referenceId);
    if (issue) {
      setError(issue.message);
      return;
    }

    const normalizedId = referenceId.trim().replace(/^\./u, "").trim();
    const workbookSourceId = getResolvedWorkbookSourceId({
      selectedWorkbookSourceId,
      sources,
      previewSourceId,
    });
    const source = createSourceDraft({
      sourceType,
      literalValue,
      workbookSourceId,
      workbookRef,
    });

    if (!source) {
      setError("Select a workbook cell or range.");
      return;
    }

    if (source.type !== "literal" && source.sourceId.length === 0) {
      setError(
        sources.length === 0
          ? "Attach a source before creating workbook references."
          : "Select a source before creating workbook references.",
      );
      return;
    }

    onCreated({
      id: normalizedId,
      source,
    });

    setReferenceId(createUniqueReferenceDraft(model).id);
    setSourceType(getInitialSourceType(allowedSourceTypes, initialSourceType));
    setLiteralValue("");
    setSelectedWorkbookSourceId(getDefaultWorkbookSourceId(sources, previewSourceId));
    setWorkbookRef("");
  }

  const workbookSourceId = getResolvedWorkbookSourceId({
    selectedWorkbookSourceId,
    sources,
    previewSourceId,
  });

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <FieldGroup>
        <InspectorField
          label="Reference id"
          description="Reference ids are used in syntax like {{ .referenceId }}."
          error={error ?? undefined}
        >
          <Input
            id="reference-id"
            value={referenceId}
            autoFocus={autoFocus}
            disabled={disabled}
            onChange={(event) => setReferenceId(event.currentTarget.value)}
          />
        </InspectorField>

        {singleAllowedSourceType ? null : (
          <InspectorField label="Source type">
            <Select
              value={sourceType}
              disabled={disabled}
              onValueChange={(value) => {
                if (!isReferenceSourceDraftType(value)) {
                  return;
                }
                setSourceType(value);
              }}
            >
              <SelectTrigger
                id="reference-source-type"
                aria-label="Source type"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isAllowedSourceType(allowedSourceTypes, "literal") ? (
                  <SelectItem value="literal">Literal value</SelectItem>
                ) : null}
                {isAllowedSourceType(allowedSourceTypes, "workbook_cell") ? (
                  <SelectItem value="workbook_cell" disabled={!workbookEnabled}>
                    Workbook cell
                  </SelectItem>
                ) : null}
                {isAllowedSourceType(allowedSourceTypes, "workbook_range") ? (
                  <SelectItem value="workbook_range" disabled={!workbookEnabled}>
                    Workbook range
                  </SelectItem>
                ) : null}
              </SelectContent>
            </Select>
            {sourceType !== "literal" && !workbookEnabled ? (
              <p className="text-xs text-muted-foreground">
                Attach a source first.
              </p>
            ) : null}
          </InspectorField>
        )}

        {sourceType === "literal" ? (
          <InspectorField label="Literal value">
            <Input
              id="reference-literal"
              value={formatAnswerInputValue(literalValue)}
              disabled={disabled}
              onChange={(event) => setLiteralValue(event.currentTarget.value)}
            />
          </InspectorField>
        ) : (
          <>
            <InspectorField label="Source">
              <Select
                value={workbookSourceId ?? ""}
                disabled={disabled || sources.length === 0}
                onValueChange={(value) => setSelectedWorkbookSourceId(value)}
              >
                <SelectTrigger aria-label="Source">
                  <SelectValue placeholder="Select source" />
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
            <InspectorField
              label={
                sourceType === "workbook_range" ? "Source range" : "Source cell"
              }
            >
              <WorkbookInputGroup
                id="reference-workbook"
                sourceId={workbookSourceId}
                value={workbookRef}
                disabled={disabled || !workbookEnabled || workbookSourceId === null}
                placeholder={
                  sourceType === "workbook_range"
                    ? "Select a workbook range"
                    : "Select a workbook cell"
                }
                workbookSelectionRequirement={{
                  selectionType:
                    sourceType === "workbook_range" ? "range" : "cell",
                }}
                onChange={(event) => setWorkbookRef(event.currentTarget.value)}
                onWorkbookSelect={(selection) => {
                  setSelectedWorkbookSourceId(selection.sourceId);
                  setWorkbookRef(selection.reference);
                }}
              />
              {workbookSourceId === null ? (
                <p className="text-xs text-muted-foreground">
                  Select a source first.
                </p>
              ) : null}
            </InspectorField>
          </>
        )}
      </FieldGroup>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
        ) : null}
        <Button type="submit" disabled={disabled}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function getDefaultWorkbookSourceId(
  sources: QuestionBlueprintWorkbookSource[],
  previewSourceId: string | null,
) {
  if (
    previewSourceId !== null &&
    sources.some((source) => source.sourceId === previewSourceId)
  ) {
    return previewSourceId;
  }

  return sources[0]?.sourceId ?? null;
}

function getResolvedWorkbookSourceId(input: {
  selectedWorkbookSourceId: string | null;
  sources: QuestionBlueprintWorkbookSource[];
  previewSourceId: string | null;
}) {
  if (
    input.selectedWorkbookSourceId &&
    input.sources.some((source) => source.sourceId === input.selectedWorkbookSourceId)
  ) {
    return input.selectedWorkbookSourceId;
  }

  return getDefaultWorkbookSourceId(input.sources, input.previewSourceId);
}

function createSourceDraft({
  sourceType,
  literalValue,
  workbookSourceId,
  workbookRef,
}: {
  sourceType: ReferenceSourceDraft["type"];
  literalValue: string;
  workbookSourceId: string | null;
  workbookRef: string;
}): ComposedReferenceDraft["source"] | null {
  if (sourceType === "literal") {
    return { type: "literal", value: coerceLiteralExpressionValue(literalValue) };
  }

  if (!workbookSourceId || workbookRef.trim().length === 0) {
    return null;
  }

  return {
    type: sourceType,
    sourceId: workbookSourceId,
    ref: workbookRef,
  };
}

function getInitialSourceType(
  allowedSourceTypes: ReferenceSourceDraft["type"][] | undefined,
  initialSourceType: ReferenceSourceDraft["type"],
) {
  if (!allowedSourceTypes || allowedSourceTypes.includes(initialSourceType)) {
    return initialSourceType;
  }

  return allowedSourceTypes[0] ?? "literal";
}

function isAllowedSourceType(
  allowedSourceTypes: ReferenceSourceDraft["type"][] | undefined,
  sourceType: ReferenceSourceDraft["type"],
) {
  return !allowedSourceTypes || allowedSourceTypes.includes(sourceType);
}
