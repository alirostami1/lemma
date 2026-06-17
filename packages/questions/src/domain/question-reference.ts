import type { JsonValue } from "@lemma/domain";
import {
  assertJsonValue,
  assertNonEmptyString,
  assertPlainRecord,
  assertSchemaVersion,
} from "./canonical-validation.js";

const cellRefPattern = String.raw`\$?[A-Za-z]{1,3}\$?[1-9][0-9]*`;
const rawWorkbookRefPattern = new RegExp(
  `^${cellRefPattern}(?::${cellRefPattern})?$`,
);
const sheetQualifiedWorkbookRefPattern = new RegExp(
  `^('([^']|'')+'|[A-Za-z_][A-Za-z0-9_ ]*)!${cellRefPattern}(?::${cellRefPattern})?$`,
);
const referenceIdPattern = /^[A-Za-z][A-Za-z0-9_-]*$/u;

export type QuestionReference = {
  id: string;
  label?: string;
  source: QuestionReferenceSource;
};

export type QuestionReferenceSource =
  | { schemaVersion: 1; type: "literal"; value: JsonValue }
  | { schemaVersion: 1; type: "workbook_cell"; ref: string }
  | { schemaVersion: 1; type: "workbook_range"; ref: string };

export function assertQuestionReferenceId(
  value: unknown,
  field: string,
  fail: (message: string) => never,
): asserts value is string {
  assertNonEmptyString(value, field, fail);
  if (!referenceIdPattern.test(value)) {
    fail(
      `${field} must start with a letter and contain only letters, numbers, underscores, or hyphens`,
    );
  }
}

export function questionReferenceSource(
  input: unknown,
  failWith: (message: string) => never,
): QuestionReferenceSource {
  assertPlainRecord(
    input,
    "question reference source must be an object",
    failWith,
  );
  assertSchemaVersion(input, failWith);
  if (input.type === "literal") {
    assertJsonValue(input.value, "value", failWith);
    return { schemaVersion: 1, type: "literal", value: input.value };
  }
  if (input.type === "workbook_cell" || input.type === "workbook_range") {
    assertNonEmptyString(input.ref, "ref", failWith);
    if (
      !rawWorkbookRefPattern.test(input.ref) &&
      !sheetQualifiedWorkbookRefPattern.test(input.ref)
    ) {
      failWith(
        "workbook reference ref must be a raw or sheet-qualified cell or range reference",
      );
    }
    if (input.type === "workbook_cell" && input.ref.includes(":")) {
      failWith("workbook_cell ref must not be a range");
    }
    if (input.type === "workbook_range" && !input.ref.includes(":")) {
      failWith("workbook_range ref must be a range");
    }
    return { schemaVersion: 1, type: input.type, ref: input.ref };
  }
  failWith("question reference source type is invalid");
}
