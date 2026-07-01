export const QUESTION_INPUT_TYPES = ["text", "number", "select"] as const;

export type QuestionInputType = (typeof QUESTION_INPUT_TYPES)[number];

export type QuestionInputValue = string | number | null;

export type QuestionInputSelectOption = {
  value: string;
  label?: string;
};

export type QuestionInputValidation = {
  required?: boolean;
  regex?: string;
  min?: number;
  max?: number;
  allowedValues?: string[];
};

export type QuestionInputPrimitiveConfig = {
  type: QuestionInputType;
  defaultValue?: QuestionInputValue;
  options?: QuestionInputSelectOption[];
  validation?: QuestionInputValidation;
};

export type QuestionInputValidationErrorCode =
  | "required"
  | "type"
  | "regex"
  | "min"
  | "max"
  | "allowed_value"
  | "invalid_config";

export type QuestionInputValidationError = {
  code: QuestionInputValidationErrorCode;
  message: string;
};

export type QuestionInputValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: QuestionInputValidationError[] };

export type QuestionInputConfigErrorCode =
  | "unsupported_validation"
  | "invalid_regex"
  | "invalid_range"
  | "unsupported_options"
  | "duplicate_option"
  | "empty_option"
  | "duplicate_allowed_value"
  | "empty_allowed_value"
  | "allowed_value_not_option"
  | "invalid_default";

export type QuestionInputConfigError = {
  code: QuestionInputConfigErrorCode;
  message: string;
};

export type QuestionInputConfigValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: QuestionInputConfigError[] };

export type QuestionInputSourceReference = {
  type: "reference";
  referenceId: string;
};

export type QuestionInputPrimitiveSourceConfig<TSource> = {
  defaultValueSource?: TSource;
  optionsSource?: TSource;
};

export type QuestionInputPrimitiveSource<TLiteralValue = unknown> =
  | {
      schemaVersion: 1;
      type: "literal";
      value: TLiteralValue;
    }
  | {
      schemaVersion: 1;
      type: "reference";
      referenceId: string;
    };

export type QuestionBlueprintInputPrimitive<TLiteralValue = unknown> = {
  schemaVersion: 1;
  type: QuestionInputType;
  defaultValueSource?: QuestionInputPrimitiveSource<TLiteralValue>;
  optionsSource?: QuestionInputPrimitiveSource<TLiteralValue>;
  validation?: QuestionInputValidation;
};

export function createDefaultQuestionInputValidation(
  required: boolean | undefined,
): QuestionInputValidation | undefined {
  return required === undefined ? undefined : { required };
}

export function createDefaultQuestionInputPrimitive(input: {
  type: QuestionInputType;
  required?: boolean;
}): QuestionInputPrimitiveConfig {
  return {
    type: input.type,
    ...(input.required === undefined
      ? {}
      : { validation: { required: input.required } }),
    ...(input.type === "select" ? { options: [] } : {}),
  };
}

export function validateQuestionInputPrimitiveConfig(
  input: QuestionInputPrimitiveConfig,
): QuestionInputConfigValidationResult {
  const base = validateQuestionInputPrimitiveBaseConfig(input);
  const errors: QuestionInputConfigError[] = [...base.errors];
  const validation = input.validation ?? {};

  if (input.type === "select") {
    errors.push(
      ...validateQuestionInputSelectOptionsConfig(
        input.options ?? [],
        validation.allowedValues ?? [],
      ),
    );
  }

  if (
    input.defaultValue !== undefined &&
    !isEmptyQuestionInputValue(input.defaultValue)
  ) {
    errors.push(...validateDefaultValueConfig(input));
  }

  return configValidationResult(errors);
}

export function validateQuestionBlueprintInputPrimitiveConfig(
  input: QuestionBlueprintInputPrimitive,
): QuestionInputConfigValidationResult {
  const base = validateQuestionInputPrimitiveBaseConfig({
    type: input.type,
    validation: input.validation,
  });
  const errors: QuestionInputConfigError[] = [...base.errors];
  let literalOptions: QuestionInputSelectOption[] | undefined;

  if (input.type === "select") {
    if (input.optionsSource === undefined) {
      errors.push({
        code: "unsupported_options",
        message: "Choice answers require an options source.",
      });
    } else if (input.optionsSource.type === "literal") {
      try {
        literalOptions = parseQuestionInputSelectOptions(
          input.optionsSource.value,
          failQuestionInputConfigValidation,
        );
      } catch (error) {
        errors.push({
          code: "unsupported_options",
          message:
            error instanceof Error
              ? error.message
              : "Input options are invalid.",
        });
      }
    }
  } else if (input.optionsSource !== undefined) {
    errors.push({
      code: "unsupported_options",
      message: "Only choice answers can define an options source.",
    });
  }

  const allowedValues = input.validation?.allowedValues ?? [];
  if (literalOptions !== undefined) {
    errors.push(
      ...validateQuestionInputSelectOptionsConfig(
        literalOptions,
        allowedValues,
      ),
    );
  }

  if (input.defaultValueSource?.type === "literal") {
    const defaultValue = input.defaultValueSource.value;
    const defaultError = validateSourceBackedDefaultValue(
      input.type,
      defaultValue,
      allowedValues,
      literalOptions,
    );
    if (defaultError !== undefined) {
      errors.push(defaultError);
    }
  }

  return configValidationResult(errors);
}

export function validateQuestionInputPrimitiveBaseConfig(
  input: Pick<QuestionInputPrimitiveConfig, "options" | "type" | "validation">,
): QuestionInputConfigValidationResult {
  const errors: QuestionInputConfigError[] = [];
  const validation = input.validation ?? {};

  if (input.type !== "text" && validation.regex !== undefined) {
    errors.push({
      code: "unsupported_validation",
      message: "Only text answers can use a required format.",
    });
  }
  if (input.type !== "number") {
    if (validation.min !== undefined) {
      errors.push({
        code: "unsupported_validation",
        message: "Only number answers can use a minimum.",
      });
    }
    if (validation.max !== undefined) {
      errors.push({
        code: "unsupported_validation",
        message: "Only number answers can use a maximum.",
      });
    }
  }
  if (input.type !== "select" && validation.allowedValues !== undefined) {
    errors.push({
      code: "unsupported_validation",
      message: "Only choice answers can use allowed values.",
    });
  }
  if (input.type !== "select" && input.options !== undefined) {
    errors.push({
      code: "unsupported_options",
      message: "Only choice answers can define options.",
    });
  }

  if (input.type === "text" && validation.regex !== undefined) {
    const regex = compileQuestionInputRegex(validation.regex);
    if (!regex.valid) {
      errors.push({
        code: "invalid_regex",
        message: "Answer format is invalid.",
      });
    }
  }

  if (
    input.type === "number" &&
    validation.min !== undefined &&
    validation.max !== undefined &&
    validation.min > validation.max
  ) {
    errors.push({
      code: "invalid_range",
      message: "Minimum must be no greater than maximum.",
    });
  }

  if (input.type === "select") {
    errors.push(...validateAllowedValues(validation.allowedValues ?? []));
  }

  return configValidationResult(errors);
}

export function validateQuestionInputSelectOptionsConfig(
  options: readonly QuestionInputSelectOption[],
  allowedValues: readonly string[],
): QuestionInputConfigError[] {
  const errors = validateSelectOptions(options);

  if (allowedValues.length > 0) {
    const optionValues = new Set(options.map((option) => option.value));
    for (const value of allowedValues) {
      if (!optionValues.has(value)) {
        errors.push({
          code: "allowed_value_not_option",
          message: "Allowed values must match available options.",
        });
      }
    }
  }

  return errors;
}

export function validateQuestionInputPrimitiveValue(
  input: QuestionInputPrimitiveConfig,
  value: unknown,
): QuestionInputValidationResult {
  const config = validateQuestionInputPrimitiveConfig(input);
  if (!config.valid) {
    return validationResult([
      {
        code: "invalid_config",
        message: config.errors[0]?.message ?? "Answer settings are invalid.",
      },
    ]);
  }

  const validation = input.validation ?? {};
  const errors: QuestionInputValidationError[] = [];

  if (isEmptyQuestionInputValue(value)) {
    if (validation.required) {
      errors.push({
        code: "required",
        message: "Enter an answer.",
      });
    }
    return validationResult(errors);
  }

  if (input.type === "text") {
    if (typeof value !== "string") {
      errors.push({ code: "type", message: "Enter text." });
      return validationResult(errors);
    }
    if (validation.regex !== undefined) {
      const regex = compileQuestionInputRegex(validation.regex);
      if (!regex.valid) {
        errors.push({
          code: "invalid_config",
          message: "Answer format is invalid.",
        });
        return validationResult(errors);
      }
      if (!regex.value.test(value)) {
        errors.push({
          code: "regex",
          message: "Use the required format.",
        });
      }
    }
    return validationResult(errors);
  }

  if (input.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors.push({ code: "type", message: "Enter a number." });
      return validationResult(errors);
    }
    if (validation.min !== undefined && value < validation.min) {
      errors.push({
        code: "min",
        message: `Enter a number at least ${validation.min}.`,
      });
    }
    if (validation.max !== undefined && value > validation.max) {
      errors.push({
        code: "max",
        message: `Enter a number no more than ${validation.max}.`,
      });
    }
    return validationResult(errors);
  }

  if (typeof value !== "string") {
    errors.push({ code: "type", message: "Choose an option." });
    return validationResult(errors);
  }

  if (!questionInputAcceptedValues(input).has(value)) {
    errors.push({
      code: "allowed_value",
      message: "Choose one of the available options.",
    });
  }
  return validationResult(errors);
}

export function questionInputAcceptedValues(
  input: Pick<QuestionInputPrimitiveConfig, "options" | "type" | "validation">,
): ReadonlySet<string> {
  if (input.type !== "select") {
    return new Set();
  }
  const allowedValues = input.validation?.allowedValues ?? [];
  return new Set(
    allowedValues.length > 0
      ? allowedValues
      : (input.options ?? []).map((option) => option.value),
  );
}

export function getQuestionInputPrimitiveEffectiveValue(
  input: Pick<QuestionInputPrimitiveConfig, "defaultValue">,
  value: unknown,
): QuestionInputValue | undefined {
  return value === undefined
    ? input.defaultValue
    : questionInputValueFromUnknown(value);
}

export function coerceQuestionInputPrimitiveValue(
  raw: string,
  input: Pick<QuestionInputPrimitiveConfig, "type">,
): QuestionInputValue | string {
  if (raw === "") {
    return null;
  }
  if (input.type === "number") {
    if (
      raw === "-" ||
      raw.endsWith(".") ||
      raw.endsWith("+") ||
      raw.endsWith("-") ||
      raw.endsWith("e") ||
      raw.endsWith("E")
    ) {
      return raw;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : raw;
  }
  return raw;
}

export function questionInputValueFromUnknown(
  value: unknown,
): QuestionInputValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return value;
  }
  return null;
}

export function parseQuestionInputSelectOptions(
  value: unknown,
  failWith: (message: string) => never,
): QuestionInputSelectOption[] {
  if (!Array.isArray(value)) {
    failWith("input options must be an array");
  }
  const options = value.flatMap((item) =>
    parseQuestionInputSelectOptionItem(item, failWith),
  );
  const errors = validateSelectOptions(options);
  if (errors.length > 0) {
    failWith(errors[0]?.message ?? "Input options are invalid.");
  }
  return options;
}

export function questionInputSelectOptionsFromValue(
  value: unknown,
): QuestionInputSelectOption[] {
  try {
    return parseQuestionInputSelectOptions(value, (message) => {
      throw new Error(message);
    });
  } catch {
    return [];
  }
}

export function parseQuestionInputAllowedValues(
  value: unknown,
  failWith: (message: string) => never,
): string[] {
  if (!Array.isArray(value)) {
    failWith("input validation allowedValues must be an array");
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      failWith("input validation allowed value must be a string");
    }
    out.push(item);
  }
  const errors = validateAllowedValues(out);
  if (errors.length > 0) {
    failWith(errors[0]?.message ?? "Allowed values are invalid.");
  }
  return out;
}

export function extractQuestionInputPrimitiveReferenceIds(
  input: QuestionInputPrimitiveSourceConfig<unknown> | undefined,
): string[] {
  return [
    ...referenceIdFromSource(input?.defaultValueSource),
    ...referenceIdFromSource(input?.optionsSource),
  ];
}

export function referenceIdFromQuestionInputSource(source: unknown) {
  return referenceIdFromSource(source)[0] ?? null;
}

function validateDefaultValueConfig(
  input: QuestionInputPrimitiveConfig,
): QuestionInputConfigError[] {
  if (input.type === "number") {
    return typeof input.defaultValue === "number" &&
      Number.isFinite(input.defaultValue)
      ? []
      : [
          {
            code: "invalid_default",
            message: "Default answer must be a number.",
          },
        ];
  }
  if (input.type === "select") {
    return typeof input.defaultValue === "string" &&
      questionInputAcceptedValues(input).has(input.defaultValue)
      ? []
      : [
          {
            code: "invalid_default",
            message: "Default answer must be one of the available options.",
          },
        ];
  }
  return typeof input.defaultValue === "string"
    ? []
    : [
        {
          code: "invalid_default",
          message: "Default answer must be text.",
        },
      ];
}

function validateSourceBackedDefaultValue(
  type: QuestionInputType,
  value: unknown,
  allowedValues: readonly string[],
  literalOptions: readonly QuestionInputSelectOption[] | undefined,
): QuestionInputConfigError | undefined {
  if (value === null || value === "") {
    return undefined;
  }
  if (type === "number") {
    return typeof value === "number" && Number.isFinite(value)
      ? undefined
      : {
          code: "invalid_default",
          message: "default value must be a finite number",
        };
  }
  if (type === "text") {
    return typeof value === "string"
      ? undefined
      : {
          code: "invalid_default",
          message: "default value must be a string",
        };
  }

  const acceptedValues =
    allowedValues.length > 0
      ? new Set(allowedValues)
      : literalOptions === undefined
        ? undefined
        : new Set(literalOptions.map((option) => option.value));
  return typeof value === "string" &&
    (acceptedValues === undefined || acceptedValues.has(value))
    ? undefined
    : {
        code: "invalid_default",
        message: "Default answer must be one of the accepted values.",
      };
}

function validateSelectOptions(
  options: readonly QuestionInputSelectOption[],
): QuestionInputConfigError[] {
  const errors: QuestionInputConfigError[] = [];
  const seen = new Set<string>();
  for (const option of options) {
    if (option.value === "") {
      errors.push({
        code: "empty_option",
        message: "Options cannot be empty.",
      });
    }
    if (seen.has(option.value)) {
      errors.push({
        code: "duplicate_option",
        message: `Option ${option.value} is duplicated.`,
      });
    }
    seen.add(option.value);
  }
  return errors;
}

function validateAllowedValues(
  allowedValues: readonly string[],
): QuestionInputConfigError[] {
  const errors: QuestionInputConfigError[] = [];
  const seen = new Set<string>();
  for (const value of allowedValues) {
    if (value === "") {
      errors.push({
        code: "empty_allowed_value",
        message: "Allowed values cannot be empty.",
      });
    }
    if (seen.has(value)) {
      errors.push({
        code: "duplicate_allowed_value",
        message: `Allowed value ${value} is duplicated.`,
      });
    }
    seen.add(value);
  }
  return errors;
}

function parseQuestionInputSelectOptionItem(
  value: unknown,
  failWith: (message: string) => never,
): QuestionInputSelectOption[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) =>
      parseQuestionInputSelectOptionItem(item, failWith),
    );
  }
  if (typeof value === "string" || typeof value === "number") {
    return [{ value: String(value) }];
  }
  if (value === null) {
    failWith("select option must not be null");
  }
  if (!isPlainRecord(value)) {
    failWith("select option must be an object");
  }
  const rawValue = value.value;
  if (typeof rawValue !== "string" && typeof rawValue !== "number") {
    failWith("select option value must be a string or number");
  }
  if (value.label !== undefined && typeof value.label !== "string") {
    failWith("select option label must be a string");
  }
  return [
    {
      ...(value.label === undefined ? {} : { label: value.label }),
      value: String(rawValue),
    },
  ];
}

function referenceIdFromSource(source: unknown): string[] {
  if (!isPlainRecord(source)) {
    return [];
  }
  return source.type === "reference" && typeof source.referenceId === "string"
    ? [source.referenceId]
    : [];
}

function isEmptyQuestionInputValue(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function compileQuestionInputRegex(
  pattern: string,
): { valid: true; value: RegExp } | { valid: false } {
  try {
    return { valid: true, value: new RegExp(pattern, "u") };
  } catch {
    return { valid: false };
  }
}

function validationResult(
  errors: QuestionInputValidationError[],
): QuestionInputValidationResult {
  return errors.length === 0
    ? { errors: [], valid: true }
    : { errors, valid: false };
}

function configValidationResult(
  errors: QuestionInputConfigError[],
): QuestionInputConfigValidationResult {
  return errors.length === 0
    ? { errors: [], valid: true }
    : { errors, valid: false };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function failQuestionInputConfigValidation(message: string): never {
  throw new Error(message);
}
