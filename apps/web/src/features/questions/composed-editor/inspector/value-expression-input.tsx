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
  InputPrimitiveType,
  ValueExpression,
} from "#/domains/questions/authoring";
import {
  coerceLiteralExpressionValue,
  formatAnswerInputValue,
  isValueExpressionType,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
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
  valueType?: InputPrimitiveType;
  workbookEnabled: boolean;
  sources?: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
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
  sources = [],
  workbookSheetNamesBySourceId,
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
    referencePreviewCache,
    value,
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
              referenceId: value.type === "reference" ? value.referenceId : "",
              type: "reference",
            });
          }}
          value={value.type}
        >
          <SelectTrigger aria-label="Value mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="literal">Static value</SelectItem>
            <SelectItem value="reference">Added value</SelectItem>
          </SelectContent>
        </Select>
      </InspectorField>

      {value.type === "literal" ? (
        <InspectorField label="Value">
          <Input
            disabled={disabled}
            id={literalValueInputId}
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
            value={literalValue}
          />
        </InspectorField>
      ) : (
        <InspectorField label="Value">
          <div className="grid gap-2 rounded-md border bg-background p-3">
            <div className="grid gap-0.5">
              <p className="text-sm font-medium">
                {reference
                  ? getReferenceDisplayName(reference)
                  : "Missing value"}
              </p>
              <p className="text-xs text-muted-foreground">
                {preview.displayValue}
              </p>
            </div>
            {missingReference ? (
              <p className="text-xs text-destructive">
                This value was deleted or no longer exists.
              </p>
            ) : null}
            <ReferencePickerPopover
              disabled={disabled}
              model={model}
              onCreateAndSelectReference={onCreatedReference}
              onModelChange={onModelChange}
              onSelectReference={(referenceId) =>
                onChange({ referenceId, type: "reference" })
              }
              referencePreviewCache={referencePreviewCache}
              sources={sources}
              trigger={
                <Button
                  disabled={disabled}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {reference ? "Choose value" : "Add reference"}
                </Button>
              }
              workbookEnabled={workbookEnabled}
              workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
            />
          </div>
        </InspectorField>
      )}
    </FieldGroup>
  );
}
