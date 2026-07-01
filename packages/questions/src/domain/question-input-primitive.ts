import type { JsonValue } from "@lemma/domain";
import {
  assertBoolean,
  assertPlainRecord,
  assertSchemaVersion,
  assertString,
  oneOf,
  type PlainObject,
} from "./canonical-validation.js";
import {
  createDefaultQuestionInputPrimitive,
  parseQuestionInputAllowedValues,
  parseQuestionInputSelectOptions,
  QUESTION_INPUT_TYPES,
  type QuestionInputSelectOption,
  type QuestionInputType,
  type QuestionInputValidation,
  type QuestionInputValue,
  type QuestionBlueprintInputPrimitive as SharedQuestionBlueprintInputPrimitive,
  validateQuestionBlueprintInputPrimitiveConfig,
  validateQuestionInputPrimitiveConfig,
} from "./input-primitive/index.js";
import {
  type QuestionValueExpression,
  questionValueExpression,
} from "./question-value-expression.js";

export type {
  QuestionInputConfigError,
  QuestionInputConfigErrorCode,
  QuestionInputConfigValidationResult,
  QuestionInputSelectOption,
  QuestionInputType,
  QuestionInputValidation,
  QuestionInputValidationError,
  QuestionInputValidationErrorCode,
  QuestionInputValidationResult,
  QuestionInputValue,
} from "./input-primitive/index.js";
export {
  coerceQuestionInputPrimitiveValue,
  createDefaultQuestionInputPrimitive,
  extractQuestionInputPrimitiveReferenceIds,
  getQuestionInputPrimitiveEffectiveValue,
  parseQuestionInputAllowedValues,
  parseQuestionInputSelectOptions,
  QUESTION_INPUT_TYPES,
  questionInputAcceptedValues,
  questionInputSelectOptionsFromValue,
  questionInputValueFromUnknown,
  referenceIdFromQuestionInputSource,
  validateQuestionBlueprintInputPrimitiveConfig,
  validateQuestionInputPrimitiveBaseConfig,
  validateQuestionInputPrimitiveConfig,
  validateQuestionInputPrimitiveValue,
  validateQuestionInputSelectOptionsConfig,
} from "./input-primitive/index.js";

export type QuestionBlueprintInputPrimitive =
  SharedQuestionBlueprintInputPrimitive<JsonValue>;

export type QuestionInputPrimitive = {
  schemaVersion: 1;
  type: QuestionInputType;
  defaultValue?: QuestionInputValue;
  options?: QuestionInputSelectOption[];
  validation?: QuestionInputValidation;
};

export function defaultQuestionInputPrimitive(input: {
  type: QuestionInputType;
  required?: boolean;
}): QuestionBlueprintInputPrimitive {
  const primitive = createDefaultQuestionInputPrimitive(input);
  return {
    schemaVersion: 1,
    type: primitive.type,
    ...(primitive.validation === undefined
      ? {}
      : { validation: primitive.validation }),
    ...(primitive.type === "select"
      ? {
          optionsSource: {
            schemaVersion: 1,
            type: "literal" as const,
            value: [],
          },
        }
      : {}),
  };
}

export function defaultMaterializedQuestionInputPrimitive(input: {
  type: QuestionInputType;
  required?: boolean;
}): QuestionInputPrimitive {
  const primitive = createDefaultQuestionInputPrimitive(input);
  return {
    schemaVersion: 1,
    type: primitive.type,
    ...(primitive.validation === undefined
      ? {}
      : { validation: primitive.validation }),
    ...(primitive.type === "select" ? { options: [] } : {}),
  };
}

export function questionBlueprintInputPrimitive(
  value: unknown,
  fallback: { type: QuestionInputType; required?: boolean },
  failWith: (message: string) => never,
  referenceIds?: ReadonlySet<string>,
): QuestionBlueprintInputPrimitive {
  if (value === undefined) {
    return defaultQuestionInputPrimitive(fallback);
  }
  assertPlainRecord(value, "input primitive must be an object", failWith);
  assertSchemaVersion(value, failWith);
  const type = oneOf(
    value.type,
    QUESTION_INPUT_TYPES,
    "input primitive type",
    failWith,
  );
  const validation = normalizeRequiredValidation({
    failWith,
    hasInputValidation: value.validation !== undefined,
    responseFieldRequired: fallback.required,
    validation: questionInputValidation(value.validation, type, failWith),
  });
  const out: QuestionBlueprintInputPrimitive = {
    schemaVersion: 1,
    type,
    ...(validation === undefined ? {} : { validation }),
  };
  if (value.defaultValueSource !== undefined) {
    const defaultValueSource = questionValueExpression(
      value.defaultValueSource,
      failWith,
      referenceIds,
    );
    out.defaultValueSource = defaultValueSource;
  }

  if (type === "select") {
    if (value.optionsSource === undefined) {
      failWith("select input requires optionsSource");
    }
    const optionsSource = questionValueExpression(
      value.optionsSource,
      failWith,
      referenceIds,
    );
    out.optionsSource = optionsSource;
  } else if (value.optionsSource !== undefined) {
    failWith("only select inputs may define optionsSource");
  }

  assertValidQuestionBlueprintInputConfig(out, failWith);

  return out;
}

export function questionInputPrimitive(
  value: unknown,
  fallback: { type: QuestionInputType; required?: boolean },
  failWith: (message: string) => never,
): QuestionInputPrimitive {
  if (value === undefined) {
    return defaultMaterializedQuestionInputPrimitive(fallback);
  }
  assertPlainRecord(value, "input primitive must be an object", failWith);
  assertSchemaVersion(value, failWith);
  const type = oneOf(
    value.type,
    QUESTION_INPUT_TYPES,
    "input primitive type",
    failWith,
  );
  const validation = normalizeRequiredValidation({
    failWith,
    hasInputValidation: value.validation !== undefined,
    responseFieldRequired: fallback.required,
    validation: questionInputValidation(value.validation, type, failWith),
  });
  const out: QuestionInputPrimitive = {
    schemaVersion: 1,
    type,
    ...(validation === undefined ? {} : { validation }),
  };

  if (value.defaultValue !== undefined) {
    out.defaultValue = questionInputValue(
      value.defaultValue,
      type,
      "default value",
      failWith,
    );
  }

  if (type === "select") {
    out.options =
      value.options === undefined
        ? []
        : questionInputOptions(value.options, failWith);
  } else if (value.options !== undefined) {
    failWith("only select inputs may define options");
  }

  assertValidQuestionInputConfig(out, failWith);
  return out;
}

export function materializeQuestionInputPrimitive(
  input: QuestionBlueprintInputPrimitive,
  resolveValue: (source: QuestionValueExpression) => JsonValue,
  failWith: (message: string) => never,
): QuestionInputPrimitive {
  const out: QuestionInputPrimitive = {
    schemaVersion: 1,
    type: input.type,
    ...(input.validation === undefined ? {} : { validation: input.validation }),
  };

  if (input.defaultValueSource !== undefined) {
    out.defaultValue = questionInputValue(
      resolveValue(input.defaultValueSource),
      input.type,
      "default value",
      failWith,
    );
  }

  if (input.type === "select") {
    if (input.optionsSource === undefined) {
      failWith("select input requires optionsSource");
    }
    out.options = questionInputOptions(
      resolveValue(input.optionsSource),
      failWith,
    );
  }

  assertValidQuestionInputConfig(out, failWith);
  return out;
}

export function questionInputValue(
  value: unknown,
  type: QuestionInputType,
  field: string,
  failWith: (message: string) => never,
): QuestionInputValue {
  if (value === null) {
    return null;
  }
  if (type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      failWith(`${field} must be a finite number`);
    }
    return value;
  }
  if (typeof value !== "string") {
    failWith(`${field} must be a string`);
  }
  return value;
}

export function questionInputOptions(
  value: unknown,
  failWith: (message: string) => never,
): QuestionInputSelectOption[] {
  return parseQuestionInputSelectOptions(value, failWith);
}

function questionInputValidation(
  value: unknown,
  type: QuestionInputType,
  failWith: (message: string) => never,
): QuestionInputValidation | undefined {
  if (value === undefined) {
    return undefined;
  }
  assertPlainRecord(value, "input validation must be an object", failWith);
  const out: QuestionInputValidation = {};
  if (value.required !== undefined) {
    assertBoolean(value.required, "input validation required", failWith);
    out.required = value.required;
  }

  if (type === "text") {
    if (value.regex !== undefined) {
      assertString(value.regex, "input validation regex", failWith);
      try {
        new RegExp(value.regex, "u");
      } catch {
        failWith("input validation regex must be valid");
      }
      out.regex = value.regex;
    }
    rejectValidationKeys(
      value,
      ["min", "max", "allowedValues"],
      type,
      failWith,
    );
    return hasValidation(out) ? out : undefined;
  }

  if (type === "number") {
    if (value.min !== undefined) {
      assertFiniteNumber(value.min, "input validation min", failWith);
      out.min = value.min;
    }
    if (value.max !== undefined) {
      assertFiniteNumber(value.max, "input validation max", failWith);
      out.max = value.max;
    }
    if (out.min !== undefined && out.max !== undefined && out.min > out.max) {
      failWith("input validation min must be no greater than max");
    }
    rejectValidationKeys(value, ["regex", "allowedValues"], type, failWith);
    return hasValidation(out) ? out : undefined;
  }

  if (type === "select") {
    if (value.allowedValues !== undefined) {
      out.allowedValues = parseQuestionInputAllowedValues(
        value.allowedValues,
        failWith,
      );
    }
    rejectValidationKeys(value, ["regex", "min", "max"], type, failWith);
    return hasValidation(out) ? out : undefined;
  }

  rejectValidationKeys(
    value,
    ["regex", "min", "max", "allowedValues"],
    type,
    failWith,
  );
  return hasValidation(out) ? out : undefined;
}

function rejectValidationKeys(
  value: PlainObject,
  keys: readonly string[],
  type: QuestionInputType,
  failWith: (message: string) => never,
): void {
  for (const key of keys) {
    if (value[key] !== undefined) {
      failWith(`${type} input validation cannot define ${key}`);
    }
  }
}

function normalizeRequiredValidation(input: {
  validation: QuestionInputValidation | undefined;
  hasInputValidation: boolean;
  responseFieldRequired: boolean | undefined;
  failWith: (message: string) => never;
}): QuestionInputValidation | undefined {
  if (input.responseFieldRequired === undefined) {
    return input.validation;
  }
  if (!input.hasInputValidation) {
    return {
      ...(input.validation ?? {}),
      required: input.responseFieldRequired,
    };
  }
  if (input.validation?.required !== input.responseFieldRequired) {
    input.failWith(
      "input validation required must match response field required",
    );
  }
  return input.validation;
}

function assertValidQuestionInputConfig(
  input: QuestionInputPrimitive,
  failWith: (message: string) => never,
): void {
  const validation = validateQuestionInputPrimitiveConfig(input);
  if (!validation.valid) {
    const error = validation.errors[0];
    if (error?.code === "invalid_default") {
      failWith(`input default value is invalid: ${error.message}`);
    }
    failWith(error?.message ?? "Input settings are invalid.");
  }
}

function assertValidQuestionBlueprintInputConfig(
  input: QuestionBlueprintInputPrimitive,
  failWith: (message: string) => never,
): void {
  const validation = validateQuestionBlueprintInputPrimitiveConfig(input);
  if (!validation.valid) {
    failWith(validation.errors[0]?.message ?? "Input settings are invalid.");
  }
}

function assertFiniteNumber(
  value: unknown,
  field: string,
  failWith: (message: string) => never,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    failWith(`${field} must be a finite number`);
  }
}

function hasValidation(value: QuestionInputValidation): boolean {
  return Object.keys(value).length > 0;
}
