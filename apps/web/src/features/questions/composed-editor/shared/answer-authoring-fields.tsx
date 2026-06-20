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
          value={responseField.type}
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
              id={`${responseField.id}-label`}
              value={label ?? ""}
              disabled={disabled}
              onChange={(event) =>
                onLabelChange(event.currentTarget.value || undefined)
              }
            />
          </InspectorField>

          <InspectorField label="Placeholder">
            <Input
              id={`${responseField.id}-placeholder`}
              value={placeholder ?? ""}
              disabled={disabled}
              onChange={(event) =>
                onPlaceholderChange(event.currentTarget.value || undefined)
              }
            />
          </InspectorField>
        </>
      ) : null}

      <InspectorSwitchField
        label="Required"
        description="Students must provide an answer."
        checked={responseField.required !== false}
        disabled={disabled}
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
  previewSourceId,
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
  previewSourceId: string | null;
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
      value={value}
      model={model}
      referencePreviewCache={referencePreviewCache}
      valueType={valueType}
      workbookEnabled={workbookEnabled}
      sources={sources}
      previewSourceId={previewSourceId}
      disabled={disabled}
      onModelChange={onModelChange}
      onChange={onChange}
      onCreatedReference={onCreatedReference}
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
          id={`${blockId}-points`}
          inputMode="numeric"
          value={String(points)}
          disabled={disabled}
          onChange={(event) => {
            const value = Number(event.currentTarget.value);
            onPointsChange(Number.isFinite(value) ? value : points);
          }}
        />
      </InspectorField>

      <InspectorField label="Grading">
        <Select
          value={grading.mode}
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
              value={grading.tolerance.type}
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
              id={`${blockId}-tolerance`}
              inputMode="decimal"
              value={String(grading.tolerance.value)}
              disabled={disabled}
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
