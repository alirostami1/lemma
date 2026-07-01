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
import { Textarea } from "@lemma/ui/components/textarea";
import type {
  ComposedEditorModel,
  InputPrimitive,
  InputPrimitiveType,
  InputPrimitiveValidation,
  InputSelectOption,
  TableGrading,
  ValueExpression,
} from "#/domains/questions/authoring";
import {
  coerceInputPrimitiveValue,
  inputSelectOptionsFromValue,
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
  type: InputPrimitiveType;
  label?: string;
};

export function AnswerFieldSettings({
  responseField,
  label,
  placeholder,
  disabled,
  showPromptFields = true,
  onResponseFieldChange,
  required,
  onRequiredChange,
  onLabelChange,
  onPlaceholderChange,
}: {
  responseField: AnswerFieldLike;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  showPromptFields?: boolean;
  onResponseFieldChange(field: AnswerFieldLike): void;
  required: boolean;
  onRequiredChange(required: boolean): void;
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
          <SelectTrigger aria-label="Input type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="select">Select</SelectItem>
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
        checked={required}
        description="Students must provide an answer."
        disabled={disabled}
        label="Required"
        onCheckedChange={onRequiredChange}
      />
    </FieldGroup>
  );
}

export function InputPrimitiveSettings({
  input,
  disabled,
  onInputChange,
}: {
  input: InputPrimitive;
  disabled?: boolean;
  onInputChange(input: InputPrimitive): void;
}) {
  return (
    <FieldGroup>
      <DefaultValueField
        disabled={disabled}
        input={input}
        onInputChange={onInputChange}
      />
      {input.type === "text" ? (
        <InspectorField label="Format">
          <Input
            disabled={disabled}
            onChange={(event) =>
              onInputChange(
                updateInputValidation(input, {
                  regex: event.currentTarget.value || undefined,
                }),
              )
            }
            placeholder="^[A-Z]{3}$"
            value={input.validation?.regex ?? ""}
          />
        </InspectorField>
      ) : null}
      {input.type === "number" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <InspectorField label="Min">
            <Input
              disabled={disabled}
              inputMode="decimal"
              onChange={(event) =>
                onInputChange(
                  updateInputValidation(input, {
                    min: parseOptionalNumber(event.currentTarget.value),
                  }),
                )
              }
              value={formatOptionalNumber(input.validation?.min)}
            />
          </InspectorField>
          <InspectorField label="Max">
            <Input
              disabled={disabled}
              inputMode="decimal"
              onChange={(event) =>
                onInputChange(
                  updateInputValidation(input, {
                    max: parseOptionalNumber(event.currentTarget.value),
                  }),
                )
              }
              value={formatOptionalNumber(input.validation?.max)}
            />
          </InspectorField>
        </div>
      ) : null}
      {input.type === "select" ? (
        <InspectorField label="Options">
          <Textarea
            disabled={disabled}
            onChange={(event) => {
              const options = parseOptionsText(event.currentTarget.value);
              onInputChange({
                ...input,
                optionsSource: {
                  type: "literal",
                  value: options,
                },
                validation: updateValidation(input.validation, {
                  allowedValues: options.map((option) => option.value),
                }),
              });
            }}
            placeholder={"A\nB\nC"}
            value={formatOptionsText(input)}
          />
        </InspectorField>
      ) : null}
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
  valueType?: InputPrimitiveType;
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
  return value === "text" || value === "number" || value === "select";
}

function DefaultValueField({
  input,
  disabled,
  onInputChange,
}: {
  input: InputPrimitive;
  disabled?: boolean;
  onInputChange(input: InputPrimitive): void;
}) {
  if (input.type === "select") {
    const options = literalSelectOptions(input);
    const defaultValue = selectDefaultValue(input);
    return (
      <InspectorField label="Default">
        <div className="flex gap-2">
          <Select
            disabled={disabled}
            onValueChange={(value) =>
              onInputChange({
                ...input,
                defaultValueSource: { type: "literal", value },
              })
            }
            value={defaultValue}
          >
            <SelectTrigger>
              <SelectValue placeholder="No default" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label ?? option.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={disabled || input.defaultValueSource === undefined}
            onClick={() =>
              onInputChange({ ...input, defaultValueSource: undefined })
            }
            size="sm"
            type="button"
            variant="outline"
          >
            Clear
          </Button>
        </div>
      </InspectorField>
    );
  }

  return (
    <InspectorField label="Default">
      <Input
        disabled={disabled}
        inputMode={input.type === "number" ? "decimal" : undefined}
        onChange={(event) =>
          onInputChange({
            ...input,
            defaultValueSource: event.currentTarget.value
              ? {
                  type: "literal",
                  value: coerceInputPrimitiveValue(
                    event.currentTarget.value,
                    input,
                  ),
                }
              : undefined,
          })
        }
        value={literalDefaultValue(input)}
      />
    </InspectorField>
  );
}

function updateInputValidation(
  input: InputPrimitive,
  patch: Partial<InputPrimitiveValidation>,
): InputPrimitive {
  return {
    ...input,
    validation: updateValidation(input.validation, patch),
  };
}

function updateValidation(
  validation: InputPrimitiveValidation | undefined,
  patch: Partial<InputPrimitiveValidation>,
): InputPrimitiveValidation | undefined {
  const next = { ...(validation ?? {}), ...patch };
  for (const key of Object.keys(next) as Array<
    keyof InputPrimitiveValidation
  >) {
    if (next[key] === undefined) {
      delete next[key];
    }
  }
  return Object.keys(next).length === 0 ? undefined : next;
}

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatOptionalNumber(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

function literalDefaultValue(input: InputPrimitive): string {
  if (input.defaultValueSource?.type !== "literal") {
    return input.type === "select" ? "unset" : "";
  }
  const value = input.defaultValueSource.value;
  return value === null ? "" : String(value);
}

function selectDefaultValue(input: InputPrimitive): string | undefined {
  if (input.defaultValueSource?.type !== "literal") {
    return undefined;
  }
  const value = input.defaultValueSource.value;
  return value === null ? undefined : String(value);
}

function literalSelectOptions(input: InputPrimitive): InputSelectOption[] {
  if (input.type !== "select" || input.optionsSource?.type !== "literal") {
    return [];
  }
  return inputSelectOptionsFromValue(input.optionsSource.value);
}

function formatOptionsText(input: InputPrimitive): string {
  return literalSelectOptions(input)
    .map((option) =>
      option.label && option.label !== option.value
        ? `${option.value} | ${option.label}`
        : option.value,
    )
    .join("\n");
}

function parseOptionsText(value: string): InputSelectOption[] {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [optionValue, label] = line.split("|").map((part) => part.trim());
      return {
        ...(label ? { label } : {}),
        value: optionValue,
      };
    });
}
