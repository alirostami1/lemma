import { FieldGroup } from "@lemma/ui/components/field";
import { Input } from "@lemma/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lemma/ui/components/select";
import type {
  ComposedEditorModel,
  TableGrading,
  ValueExpression,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import {
  InspectorField,
  InspectorSwitchField,
} from "../inspector/inspector-field";
import { ValueExpressionInput } from "../inspector/value-expression-input";

type AnswerFieldLike = {
  id: string;
  type: "text" | "number" | "boolean";
  label?: string;
  required?: boolean;
};

export function AnswerFieldSettings({
  responseField,
  label,
  placeholder,
  disabled,
  showPromptFields = true,
  onResponseFieldChange,
  onLabelChange,
  onPlaceholderChange,
}: {
  responseField: AnswerFieldLike;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  showPromptFields?: boolean;
  onResponseFieldChange(field: AnswerFieldLike): void;
  onLabelChange(label: string | undefined): void;
  onPlaceholderChange(placeholder: string | undefined): void;
}) {
  return (
    <FieldGroup>
      <InspectorField label="Input type">
        <Select
          disabled={disabled}
          onValueChange={(value) => {
            if (!isAnswerFieldType(value)) {
              return;
            }
            onResponseFieldChange({
              ...responseField,
              type: value,
            });
          }}
          value={responseField.type}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="boolean">Boolean</SelectItem>
          </SelectContent>
        </Select>
      </InspectorField>

      {showPromptFields ? (
        <>
          <InspectorField label="Label">
            <Input
              disabled={disabled}
              id={`${responseField.id}-label`}
              onChange={(event) =>
                onLabelChange(event.currentTarget.value || undefined)
              }
              value={label ?? ""}
            />
          </InspectorField>

          <InspectorField label="Placeholder">
            <Input
              disabled={disabled}
              id={`${responseField.id}-placeholder`}
              onChange={(event) =>
                onPlaceholderChange(event.currentTarget.value || undefined)
              }
              value={placeholder ?? ""}
            />
          </InspectorField>
        </>
      ) : null}

      <InspectorSwitchField
        checked={responseField.required !== false}
        description="Students must provide an answer."
        disabled={disabled}
        label="Required"
        onCheckedChange={(checked) =>
          onResponseFieldChange({
            ...responseField,
            required: checked,
          })
        }
      />
    </FieldGroup>
  );
}

export function CorrectAnswerSettings({
  value,
  model,
  referencePreviewCache,
  valueType,
  workbookEnabled,
  sources,
  workbookSheetNamesBySourceId,
  disabled,
  onModelChange,
  onChange,
  onCreatedReference,
}: {
  value: ValueExpression;
  model: ComposedEditorModel;
  referencePreviewCache: ReferencePreviewCache;
  valueType?: "text" | "number" | "boolean";
  workbookEnabled: boolean;
  sources: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
  disabled?: boolean;
  onModelChange(model: ComposedEditorModel): void;
  onChange(value: ValueExpression): void;
  onCreatedReference?(input: {
    nextModel: ComposedEditorModel;
    referenceId: string;
  }): void;
}) {
  return (
    <ValueExpressionInput
      disabled={disabled}
      model={model}
      onChange={onChange}
      onCreatedReference={onCreatedReference}
      onModelChange={onModelChange}
      referencePreviewCache={referencePreviewCache}
      sources={sources}
      value={value}
      valueType={valueType}
      workbookEnabled={workbookEnabled}
      workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
    />
  );
}

export function GradingSettings({
  blockId,
  points,
  grading,
  disabled,
  onPointsChange,
  onGradingChange,
}: {
  blockId: string;
  points: number;
  grading: TableGrading;
  disabled?: boolean;
  onPointsChange(points: number): void;
  onGradingChange(grading: TableGrading): void;
}) {
  return (
    <FieldGroup>
      <InspectorField label="Points">
        <Input
          disabled={disabled}
          id={`${blockId}-points`}
          inputMode="numeric"
          onChange={(event) => {
            const value = Number(event.currentTarget.value);
            onPointsChange(Number.isFinite(value) ? value : points);
          }}
          value={String(points)}
        />
      </InspectorField>

      <InspectorField label="Grading">
        <Select
          disabled={disabled}
          onValueChange={(value) => {
            if (value === "number") {
              onGradingChange({
                mode: "number",
                tolerance: { type: "absolute", value: 0 },
              });
              return;
            }

            if (value === "case_insensitive_text") {
              onGradingChange({ mode: "case_insensitive_text" });
              return;
            }

            if (value === "manual") {
              onGradingChange({ mode: "manual" });
              return;
            }

            onGradingChange({ mode: "exact" });
          }}
          value={grading.mode}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="exact">Exact</SelectItem>
            <SelectItem value="number">Number tolerance</SelectItem>
            <SelectItem value="case_insensitive_text">
              Case-insensitive text
            </SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </InspectorField>

      {grading.mode === "number" ? (
        <>
          <InspectorField label="Tolerance type">
            <Select
              disabled={disabled}
              onValueChange={(value) => {
                if (value !== "absolute" && value !== "relative") {
                  return;
                }

                onGradingChange({
                  ...grading,
                  tolerance: {
                    ...grading.tolerance,
                    type: value,
                  },
                });
              }}
              value={grading.tolerance.type}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="absolute">Absolute</SelectItem>
                <SelectItem value="relative">Relative</SelectItem>
              </SelectContent>
            </Select>
          </InspectorField>

          <InspectorField label="Tolerance value">
            <Input
              disabled={disabled}
              id={`${blockId}-tolerance`}
              inputMode="decimal"
              onChange={(event) => {
                const value = Number(event.currentTarget.value);
                onGradingChange({
                  ...grading,
                  tolerance: {
                    ...grading.tolerance,
                    value: Number.isFinite(value)
                      ? value
                      : grading.tolerance.value,
                  },
                });
              }}
              value={String(grading.tolerance.value)}
            />
          </InspectorField>
        </>
      ) : null}
    </FieldGroup>
  );
}

function isAnswerFieldType(value: string): value is AnswerFieldLike["type"] {
  return value === "text" || value === "number" || value === "boolean";
}
