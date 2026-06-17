import type { JsonValue } from "@lemma/domain";

export type PlainObject = { [key: string]: unknown };

export function isPlainRecord(value: unknown): value is PlainObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertPlainRecord(
  value: unknown,
  message: string,
  fail: (message: string) => never,
): asserts value is PlainObject {
  if (!isPlainRecord(value)) {
    fail(message);
  }
}

export function assertSchemaVersion(
  value: { schemaVersion?: unknown },
  fail: (message: string) => never,
): asserts value is { schemaVersion: 1 } & PlainObject {
  if (value.schemaVersion !== 1) {
    fail("schemaVersion must be 1");
  }
}

export function assertString(
  value: unknown,
  field: string,
  fail: (message: string) => never,
): asserts value is string {
  if (typeof value !== "string") {
    fail(`${field} must be a string`);
  }
}

export function assertNonEmptyString(
  value: unknown,
  field: string,
  fail: (message: string) => never,
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${field} must be a non-empty string`);
  }
}

export function assertBoolean(
  value: unknown,
  field: string,
  fail: (message: string) => never,
): asserts value is boolean {
  if (typeof value !== "boolean") {
    fail(`${field} must be a boolean`);
  }
}

export function assertArray(
  value: unknown,
  field: string,
  fail: (message: string) => never,
): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    fail(`${field} must be an array`);
  }
}

export function assertInteger(
  value: unknown,
  field: string,
  fail: (message: string) => never,
): asserts value is number {
  if (!Number.isInteger(value)) {
    fail(`${field} must be an integer`);
  }
}

export function assertPositiveInteger(
  value: unknown,
  field: string,
  fail: (message: string) => never,
): asserts value is number {
  assertInteger(value, field, fail);
  if (value <= 0) {
    fail(`${field} must be positive`);
  }
}

export function assertFinitePositiveNumber(
  value: unknown,
  field: string,
  fail: (message: string) => never,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    fail(`${field} must be positive`);
  }
}

export function assertFiniteNonNegativeNumber(
  value: unknown,
  field: string,
  fail: (message: string) => never,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail(`${field} must be non-negative`);
  }
}

export function assertUniqueIds(
  values: readonly unknown[],
  label: string,
  fail: (message: string) => never,
): asserts values is Array<PlainObject & { id: string }> {
  const seen = new Set<string>();
  for (const value of values) {
    assertPlainRecord(value, `${label} item must be an object`, fail);
    assertNonEmptyString(value.id, `${label}.id`, fail);
    if (seen.has(value.id)) {
      fail(`${label} ids must be unique`);
    }
    seen.add(value.id);
  }
}

export function oneOf<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  field: string,
  fail: (message: string) => never,
): Values[number] {
  assertString(value, field, fail);
  if (!values.includes(value)) {
    fail(`${field} must be one of ${values.join(", ")}`);
  }
  return value as Values[number];
}

export function assertJsonValue(
  value: unknown,
  field: string,
  fail: (message: string) => never,
): asserts value is JsonValue {
  if (value === null) {
    return;
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail(`${field} must not contain non-finite numbers`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertJsonValue(item, `${field}[${index}]`, fail);
    });
    return;
  }
  if (isPlainRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) {
        fail(`${field}.${key} must be JSON-compatible`);
      }
      assertJsonValue(item, `${field}.${key}`, fail);
    }
    return;
  }
  fail(`${field} must be JSON-compatible`);
}

export function responseFieldIds(
  responseFields: readonly { id: string }[],
): ReadonlySet<string> {
  return new Set(responseFields.map((field) => field.id));
}
