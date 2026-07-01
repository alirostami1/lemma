import {
  coerceQuestionInputPrimitiveValue,
  createDefaultQuestionInputPrimitive,
  extractQuestionInputPrimitiveReferenceIds,
  getQuestionInputPrimitiveEffectiveValue,
  type QuestionBlueprintInputPrimitive,
  type QuestionInputConfigValidationResult,
  type QuestionInputPrimitiveConfig,
  type QuestionInputSelectOption,
  type QuestionInputType,
  type QuestionInputValidation,
  type QuestionInputValidationError,
  type QuestionInputValidationErrorCode,
  type QuestionInputValidationResult,
  type QuestionInputValue,
  questionInputAcceptedValues,
  questionInputSelectOptionsFromValue,
  questionInputValueFromUnknown,
  referenceIdFromQuestionInputSource,
  validateQuestionBlueprintInputPrimitiveConfig,
  validateQuestionInputPrimitiveValue,
} from "@lemma/questions/input-primitive";
import type { TableAnswerValue, ValueExpression } from "./table-model";

export type InputPrimitiveType = QuestionInputType;
export type InputPrimitiveValue = QuestionInputValue;
export type InputSelectOption = QuestionInputSelectOption;
export type InputPrimitiveValidation = QuestionInputValidation;
export type InputPrimitiveValidationErrorCode =
  QuestionInputValidationErrorCode;
export type InputPrimitiveValidationError = QuestionInputValidationError;
export type InputPrimitiveValidationResult = QuestionInputValidationResult;

export type InputPrimitive = {
  type: InputPrimitiveType;
  defaultValueSource?: ValueExpression;
  optionsSource?: ValueExpression;
  validation?: InputPrimitiveValidation;
};

export type PreviewInputPrimitive = QuestionInputPrimitiveConfig;
export type InputPrimitivePreviewState =
  | { status: "materialized"; input: PreviewInputPrimitive }
  | {
      status: "unresolved_options";
      input: InputPrimitive;
      message: string;
    };

export function createDefaultInputPrimitive(input: {
  type: InputPrimitiveType;
  required?: boolean;
}): InputPrimitive {
  const primitive = createDefaultQuestionInputPrimitive(input);
  return {
    type: primitive.type,
    ...(primitive.validation === undefined
      ? {}
      : { validation: primitive.validation }),
    ...(primitive.type === "select"
      ? { optionsSource: { type: "literal" as const, value: [] } }
      : {}),
  };
}

export function createDefaultRequiredInputPrimitiveForNewAnswer(
  type: InputPrimitiveType,
): InputPrimitive {
  return createDefaultInputPrimitive({ required: true, type });
}

export function createDefaultPreviewInputPrimitive(input: {
  type: InputPrimitiveType;
  required?: boolean;
}): PreviewInputPrimitive {
  return createDefaultQuestionInputPrimitive(input);
}

export function normalizeInputPrimitiveForType(
  input: InputPrimitive | undefined,
  type: InputPrimitiveType,
  options: { requiredFallback?: boolean } = {},
): InputPrimitive {
  if (!input) {
    return createDefaultInputPrimitive({
      required: options.requiredFallback,
      type,
    });
  }
  if (input.type !== type) {
    return createDefaultInputPrimitive({
      required: input.validation?.required,
      type,
    });
  }
  return input;
}

export function normalizeInputPrimitiveWithLegacyResponseFieldRequired(
  input: InputPrimitive | undefined,
  fallback: { type: InputPrimitiveType; required?: boolean },
): InputPrimitive {
  const primitive = input ?? createDefaultInputPrimitive(fallback);
  if (primitive.type !== fallback.type) {
    return createDefaultInputPrimitive({
      required: primitive.validation?.required ?? fallback.required,
      type: fallback.type,
    });
  }
  if (fallback.required === undefined) {
    return primitive;
  }
  if (primitive.validation?.required === undefined) {
    return setInputPrimitiveRequired(primitive, fallback.required);
  }
  if (primitive.validation.required !== fallback.required) {
    throw new Error("Input required setting must match response field.");
  }
  return primitive;
}

export function setInputPrimitiveRequired(
  input: InputPrimitive,
  required: boolean,
): InputPrimitive {
  return {
    ...input,
    validation: withRequiredValidation(input.validation, required),
  };
}

export function deriveResponseFieldRequiredFromInput(
  input: InputPrimitive | PreviewInputPrimitive | undefined,
): boolean | undefined {
  return input?.validation?.required;
}

export function inputPrimitivePreviewStateFromEditorInput(
  input: InputPrimitive | undefined,
  fallback: { type: InputPrimitiveType; required?: boolean },
): InputPrimitivePreviewState {
  if (!input) {
    return {
      input: createDefaultPreviewInputPrimitive(fallback),
      status: "materialized",
    };
  }
  if (input.type === "select" && input.optionsSource?.type !== "literal") {
    return {
      input,
      message: "Options are not available in this preview.",
      status: "unresolved_options",
    };
  }

  return {
    input: previewInputPrimitiveFromResolvedEditorInput(input),
    status: "materialized",
  };
}

function previewInputPrimitiveFromResolvedEditorInput(
  input: InputPrimitive,
): PreviewInputPrimitive {
  return {
    type: input.type,
    ...(input.defaultValueSource?.type === "literal"
      ? {
          defaultValue: questionInputValueFromUnknown(
            input.defaultValueSource.value,
          ),
        }
      : {}),
    ...(input.optionsSource?.type === "literal"
      ? {
          options: questionInputSelectOptionsFromValue(
            input.optionsSource.value,
          ),
        }
      : {}),
    ...(input.validation === undefined ? {} : { validation: input.validation }),
  };
}

export function validateInputPrimitiveValue(
  input: PreviewInputPrimitive,
  value: unknown,
): InputPrimitiveValidationResult {
  return validateQuestionInputPrimitiveValue(input, value);
}

export function validateInputPrimitiveConfig(
  input: InputPrimitive,
): QuestionInputConfigValidationResult {
  return validateQuestionBlueprintInputPrimitiveConfig(
    toQuestionBlueprintInputPrimitiveForValidation(input),
  );
}

export function inputAllowedValues(
  input: PreviewInputPrimitive,
): ReadonlySet<string> {
  return questionInputAcceptedValues(input);
}

export function extractReferenceIdsFromInputPrimitive(
  input: InputPrimitive | undefined,
): string[] {
  return extractQuestionInputPrimitiveReferenceIds(input);
}

export function extractInputPrimitiveReferenceIdsByRole(
  input: InputPrimitive | undefined,
): { defaultValueSource: string[]; optionsSource: string[] } {
  const defaultValueSource = referenceIdFromQuestionInputSource(
    input?.defaultValueSource,
  );
  const optionsSource = referenceIdFromQuestionInputSource(
    input?.optionsSource,
  );
  return {
    defaultValueSource: defaultValueSource === null ? [] : [defaultValueSource],
    optionsSource: optionsSource === null ? [] : [optionsSource],
  };
}

export function replaceReferenceIdInInputPrimitive(
  input: InputPrimitive | undefined,
  previousReferenceId: string,
  nextReferenceId: string,
): InputPrimitive | undefined {
  if (!input) {
    return input;
  }
  return {
    ...input,
    defaultValueSource: replaceReferenceIdInValueExpression(
      input.defaultValueSource,
      previousReferenceId,
      nextReferenceId,
    ),
    optionsSource: replaceReferenceIdInValueExpression(
      input.optionsSource,
      previousReferenceId,
      nextReferenceId,
    ),
  };
}

export function getInputPrimitiveEffectiveValue(
  input: PreviewInputPrimitive,
  value: unknown,
): TableAnswerValue | undefined {
  return getQuestionInputPrimitiveEffectiveValue(input, value);
}

export function coerceInputPrimitiveValue(
  raw: string,
  input: Pick<PreviewInputPrimitive, "type">,
): TableAnswerValue {
  return coerceQuestionInputPrimitiveValue(raw, input);
}

export function inputSelectOptionsFromValue(
  value: TableAnswerValue,
): InputSelectOption[] {
  return questionInputSelectOptionsFromValue(value);
}

function replaceReferenceIdInValueExpression(
  value: ValueExpression | undefined,
  previousReferenceId: string,
  nextReferenceId: string,
): ValueExpression | undefined {
  return value?.type === "reference" &&
    value.referenceId === previousReferenceId
    ? { ...value, referenceId: nextReferenceId }
    : value;
}

export function toQuestionBlueprintInputPrimitiveForValidation(
  input: InputPrimitive,
): QuestionBlueprintInputPrimitive {
  return {
    schemaVersion: 1,
    type: input.type,
    ...(input.defaultValueSource === undefined
      ? {}
      : {
          defaultValueSource: {
            schemaVersion: 1,
            ...input.defaultValueSource,
          },
        }),
    ...(input.optionsSource === undefined
      ? {}
      : {
          optionsSource: {
            schemaVersion: 1,
            ...input.optionsSource,
          },
        }),
    ...(input.validation === undefined ? {} : { validation: input.validation }),
  };
}

function withRequiredValidation(
  validation: InputPrimitiveValidation | undefined,
  required: boolean | undefined,
): InputPrimitiveValidation | undefined {
  const next = validation === undefined ? {} : { ...validation };
  if (required === undefined) {
    delete next.required;
  } else {
    next.required = required;
  }
  return Object.keys(next).length === 0 ? undefined : next;
}
