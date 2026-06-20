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
import { type FormEvent, useMemo, useState } from "react";
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
import { WorkbookInputGroup } from "#/features/questions/table-block-editor";
import { InspectorField } from "./inspector-field";
import {
  createUniqueReferenceDraft,
  getReferenceIdIssue,
} from "./reference-inspector-helpers";

export type ReferenceCreateFormProps = {
  model: ComposedEditorModel;
  workbookEnabled: boolean;
  activeSourceId?: string | null;
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
  activeSourceId,
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
  >(null);
  const resolvedWorkbookSourceId = getWorkbookSourceId({
    selectedWorkbookSourceId,
    activeSourceId,
  });
  const [workbookRef, setWorkbookRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const hasExplicitActiveSource = activeSourceId !== undefined;
  const isActiveSourceMissing =
    hasExplicitActiveSource && activeSourceId === null;
  const singleAllowedSourceType =
    allowedSourceTypes && allowedSourceTypes.length === 1
      ? allowedSourceTypes[0]
      : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const issue = getReferenceIdIssue(model, referenceId);
    if (issue) {
      setError(issue.message);
      return;
    }

    const normalizedId = referenceId.trim().replace(/^\./u, "").trim();
    const source = createSourceDraft({
      sourceType,
      literalValue,
      workbookSourceId: resolvedWorkbookSourceId,
      workbookRef,
    });

    if (!source) {
      setError("Select a workbook cell or range.");
      return;
    }

    if (source.type !== "literal" && source.sourceId.length === 0) {
      setError(
        hasExplicitActiveSource
          ? "Select an active workbook source before creating this reference."
          : "Select a workbook source in the workbook picker first.",
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
    setSelectedWorkbookSourceId(null);
    setWorkbookRef("");
  }

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
                  <SelectItem
                    value="workbook_cell"
                    disabled={!workbookEnabled || isActiveSourceMissing}
                  >
                    Workbook cell
                  </SelectItem>
                ) : null}
                {isAllowedSourceType(allowedSourceTypes, "workbook_range") ? (
                  <SelectItem
                    value="workbook_range"
                    disabled={!workbookEnabled || isActiveSourceMissing}
                  >
                    Workbook range
                  </SelectItem>
                ) : null}
              </SelectContent>
            </Select>
            {sourceType !== "literal"
              ? isActiveSourceMissing
                ? (
                  <p className="text-xs text-muted-foreground">
                    Select an active source before referencing workbook cells.
                  </p>
                )
                : !workbookEnabled
                  ? (
                    <p className="text-xs text-muted-foreground">
                      Select a workbook to reference cells.
                    </p>
                  )
                  : null
              : null}
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
          <InspectorField
            label={
              sourceType === "workbook_range" ? "Source range" : "Source cell"
            }
          >
            <WorkbookInputGroup
              id="reference-workbook"
              value={workbookRef}
              disabled={disabled || !workbookEnabled || isActiveSourceMissing}
              placeholder="Select a workbook source"
              workbookSelectionRequirement={{
                selectionType:
                  sourceType === "workbook_range" ? "range" : "cell",
              }}
              onChange={(event) => setWorkbookRef(event.currentTarget.value)}
              onWorkbookSelect={(selection) => {
                setSelectedWorkbookSourceId(selection.sourceId ?? null);
                setWorkbookRef(selection.reference);
              }}
            />
          </InspectorField>
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

function createSourceDraft(input: {
  sourceType: ReferenceSourceDraft["type"];
  literalValue: string;
  workbookSourceId: string;
  workbookRef: string;
}): ReferenceSourceDraft | null {
  const { sourceType, literalValue, workbookSourceId, workbookRef } = input;
  if (sourceType === "literal") {
    const normalizedLiteralValue =
      literalValue.trim().length === 0
        ? ""
        : coerceLiteralExpressionValue(literalValue);

    return {
      type: "literal",
      value: normalizedLiteralValue,
    };
  }

  const ref = workbookRef.trim();
  if (!ref) {
    return null;
  }

  return {
    type: sourceType,
    sourceId: workbookSourceId,
    ref,
  };
}

function getInitialWorkbookSourceId(activeSourceId: string | null | undefined) {
  if (activeSourceId === undefined) {
    return "source_1";
  }

  return activeSourceId ?? "";
}

function getWorkbookSourceId(input: {
  selectedWorkbookSourceId: string | null;
  activeSourceId: string | null | undefined;
}) {
  const { selectedWorkbookSourceId, activeSourceId } = input;
  if (selectedWorkbookSourceId) {
    return selectedWorkbookSourceId;
  }

  return getInitialWorkbookSourceId(activeSourceId);
}

function getInitialSourceType(
  allowedSourceTypes: ReferenceSourceDraft["type"][] | undefined,
  initialSourceType: ReferenceSourceDraft["type"],
): ReferenceSourceDraft["type"] {
  if (!allowedSourceTypes || allowedSourceTypes.length === 0) {
    return initialSourceType;
  }

  if (allowedSourceTypes.includes(initialSourceType)) {
    return initialSourceType;
  }

  return allowedSourceTypes[0] ?? initialSourceType;
}

function isAllowedSourceType(
  allowedSourceTypes: ReferenceSourceDraft["type"][] | undefined,
  sourceType: ReferenceSourceDraft["type"],
) {
  return !allowedSourceTypes || allowedSourceTypes.includes(sourceType);
}
