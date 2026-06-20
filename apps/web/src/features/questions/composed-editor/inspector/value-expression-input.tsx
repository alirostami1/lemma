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
import { useId } from "react";
import type {
  ComposedEditorModel,
  ValueExpression,
} from "#/domains/questions/authoring";
import {
  coerceLiteralExpressionValue,
  formatAnswerInputValue,
  isValueExpressionType,
} from "#/domains/questions/authoring";
import {
  type ReferencePreviewCache,
  resolveValueExpressionPreview,
} from "#/domains/questions/reference-preview";
import { InspectorField } from "./inspector-field";
import { getReferenceDisplayName } from "./reference-inspector-helpers";
import { ReferencePickerPopover } from "./reference-picker-popover";

type ValueExpressionInputProps = {
  value: ValueExpression;
  model: ComposedEditorModel;
  referencePreviewCache: ReferencePreviewCache;
  valueType?: "text" | "number" | "boolean";
  workbookEnabled: boolean;
  activeSourceId: string | null;
  disabled?: boolean;
  onModelChange(model: ComposedEditorModel): void;
  onChange(value: ValueExpression): void;
  onCreatedReference?(input: {
    nextModel: ComposedEditorModel;
    referenceId: string;
  }): void;
};

export function ValueExpressionInput({
  value,
  model,
  referencePreviewCache,
  valueType,
  workbookEnabled,
  activeSourceId,
  disabled,
  onModelChange,
  onChange,
  onCreatedReference,
}: ValueExpressionInputProps) {
  const reference =
    value.type === "reference"
      ? (model.references.find(
          (candidate) => candidate.id === value.referenceId,
        ) ?? null)
      : null;
  const preview = resolveValueExpressionPreview({
    value,
    referencePreviewCache,
  });
  const literalValue =
    value.type === "literal" ? formatAnswerInputValue(value.value) : "";
  const missingReference = value.type === "reference" && reference === null;
  const literalField = valueType ? { id: "value", type: valueType } : undefined;
  const literalValueInputId = `${useId()}-literal-value`;

  return (
    <FieldGroup>
      <InspectorField label="Value mode">
        <Select
          value={value.type}
          disabled={disabled}
          onValueChange={(nextType) => {
            if (!isValueExpressionType(nextType)) {
              return;
            }

            if (nextType === "literal") {
              onChange({
                type: "literal",
                value:
                  value.type === "literal"
                    ? value.value
                    : coerceLiteralExpressionValue("", literalField),
              });
              return;
            }

            onChange({
              type: "reference",
              referenceId: value.type === "reference" ? value.referenceId : "",
            });
          }}
        >
          <SelectTrigger aria-label="Value mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="literal">Literal value</SelectItem>
            <SelectItem value="reference">Reference</SelectItem>
          </SelectContent>
        </Select>
      </InspectorField>

      {value.type === "literal" ? (
        <InspectorField label="Literal value">
          <Input
            id={literalValueInputId}
            value={literalValue}
            disabled={disabled}
            inputMode={valueType === "number" ? "decimal" : undefined}
            onChange={(event) =>
              onChange({
                type: "literal",
                value: coerceLiteralExpressionValue(
                  event.currentTarget.value,
                  literalField,
                ),
              })
            }
          />
        </InspectorField>
      ) : (
        <InspectorField label="Reference">
          <div className="grid gap-2 rounded-md border bg-background p-3">
            <div className="grid gap-0.5">
              <p className="text-sm font-medium">
                {reference
                  ? getReferenceDisplayName(reference)
                  : "Missing reference"}
              </p>
              <p className="text-xs text-muted-foreground">
                {preview.displayValue}
              </p>
            </div>
            {missingReference ? (
              <p className="text-xs text-destructive">
                This reference was deleted or no longer exists.
              </p>
            ) : null}
            <ReferencePickerPopover
              model={model}
              selectedReferenceId={value.referenceId || undefined}
              referencePreviewCache={referencePreviewCache}
              workbookEnabled={workbookEnabled}
              activeSourceId={activeSourceId}
              disabled={disabled}
              onModelChange={onModelChange}
              onSelectReference={(referenceId) =>
                onChange({ type: "reference", referenceId })
              }
              onCreateAndSelectReference={onCreatedReference}
              trigger={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                >
                  Choose reference
                </Button>
              }
            />
          </div>
        </InspectorField>
      )}
    </FieldGroup>
  );
}
