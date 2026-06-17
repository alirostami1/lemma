import type { Brand } from "@lemma/domain";
import { InvalidQuestionFieldError } from "./errors.js";
import {
  assertMaxLength,
  assertNonEmptyString,
  assertNullableDescription,
} from "./primitives.js";

export const MAX_QUESTION_NAME_LENGTH = 160;
export const MAX_QUESTION_DESCRIPTION_LENGTH = 1000;
export const MAX_GENERATION_RUN_COUNT = 100;

export const QUESTION_STATUS_ACCEPTED_VALUES = [
  "active",
  "archived",
  "deleted",
] as const;
export const QUESTION_BLUEPRINT_STATUS_ACCEPTED_VALUES = [
  "active",
  "archived",
  "deleted",
] as const;
export const QUESTION_SET_STATUS_ACCEPTED_VALUES = [
  "active",
  "archived",
  "deleted",
] as const;
export const QUESTION_BLUEPRINT_VISIBILITY_ACCEPTED_VALUES = [
  "private",
  "shared",
  "system",
] as const;
export const QUESTION_GENERATION_RUN_STATUS_ACCEPTED_VALUES = [
  "queued",
  "waiting_for_workbook_calculation",
  "materializing",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export type QuestionName = Brand<string, "QuestionName">;
export type QuestionDescription = Brand<string, "QuestionDescription">;
export type QuestionBlueprintName = Brand<string, "QuestionBlueprintName">;
export type QuestionBlueprintDescription = Brand<
  string,
  "QuestionBlueprintDescription"
>;
export type QuestionSetName = Brand<string, "QuestionSetName">;
export type QuestionSetDescription = Brand<string, "QuestionSetDescription">;
export type QuestionStatus = (typeof QUESTION_STATUS_ACCEPTED_VALUES)[number];
export type QuestionBlueprintStatus =
  (typeof QUESTION_BLUEPRINT_STATUS_ACCEPTED_VALUES)[number];
export type QuestionSetStatus =
  (typeof QUESTION_SET_STATUS_ACCEPTED_VALUES)[number];
export type QuestionBlueprintVisibility =
  (typeof QUESTION_BLUEPRINT_VISIBILITY_ACCEPTED_VALUES)[number];
export type QuestionGenerationRunStatus =
  (typeof QUESTION_GENERATION_RUN_STATUS_ACCEPTED_VALUES)[number];

export function questionName(value: unknown): QuestionName {
  return assertMaxLength(
    assertNonEmptyString(value, "name"),
    MAX_QUESTION_NAME_LENGTH,
    "name",
  ) as QuestionName;
}

export function questionDescription(
  value: unknown,
): QuestionDescription | null {
  return assertNullableDescription(
    value,
    MAX_QUESTION_DESCRIPTION_LENGTH,
    "description",
  ) as QuestionDescription | null;
}

export function questionBlueprintName(value: unknown): QuestionBlueprintName {
  return assertMaxLength(
    assertNonEmptyString(value, "name"),
    MAX_QUESTION_NAME_LENGTH,
    "name",
  ) as QuestionBlueprintName;
}

export function questionBlueprintDescription(
  value: unknown,
): QuestionBlueprintDescription | null {
  return assertNullableDescription(
    value,
    MAX_QUESTION_DESCRIPTION_LENGTH,
    "description",
  ) as QuestionBlueprintDescription | null;
}

export function questionSetName(value: unknown): QuestionSetName {
  return assertMaxLength(
    assertNonEmptyString(value, "name"),
    MAX_QUESTION_NAME_LENGTH,
    "name",
  ) as QuestionSetName;
}

export function questionSetDescription(
  value: unknown,
): QuestionSetDescription | null {
  return assertNullableDescription(
    value,
    MAX_QUESTION_DESCRIPTION_LENGTH,
    "description",
  ) as QuestionSetDescription | null;
}

export function questionStatus(value: unknown): QuestionStatus {
  return oneOf(value, QUESTION_STATUS_ACCEPTED_VALUES, "question status");
}

export function questionBlueprintStatus(
  value: unknown,
): QuestionBlueprintStatus {
  return oneOf(
    value,
    QUESTION_BLUEPRINT_STATUS_ACCEPTED_VALUES,
    "question blueprint status",
  );
}

export function questionSetStatus(value: unknown): QuestionSetStatus {
  return oneOf(
    value,
    QUESTION_SET_STATUS_ACCEPTED_VALUES,
    "question set status",
  );
}

export function questionBlueprintVisibility(
  value: unknown,
): QuestionBlueprintVisibility {
  return oneOf(
    value,
    QUESTION_BLUEPRINT_VISIBILITY_ACCEPTED_VALUES,
    "question blueprint visibility",
  );
}

export function questionGenerationRunStatus(
  value: unknown,
): QuestionGenerationRunStatus {
  return oneOf(
    value,
    QUESTION_GENERATION_RUN_STATUS_ACCEPTED_VALUES,
    "question generation run status",
  );
}

export function requestedGenerationCount(value: unknown): number {
  if (typeof value !== "number") {
    throw new InvalidQuestionFieldError(
      `count must be > 0 and <= ${MAX_GENERATION_RUN_COUNT}.`,
    );
  }
  if (
    !Number.isInteger(value) ||
    value <= 0 ||
    value > MAX_GENERATION_RUN_COUNT
  ) {
    throw new InvalidQuestionFieldError(
      `count must be > 0 and <= ${MAX_GENERATION_RUN_COUNT}.`,
    );
  }
  return value;
}

function oneOf<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  fieldName: string,
): Values[number] {
  if (typeof value !== "string") {
    throw new InvalidQuestionFieldError(`${fieldName} must be a string.`);
  }
  if (!values.includes(value)) {
    throw new InvalidQuestionFieldError(
      `${fieldName} should be one of ${values.join(", ")}.`,
    );
  }
  return value as Values[number];
}
