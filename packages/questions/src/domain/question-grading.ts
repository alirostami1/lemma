import type { JsonValue } from "@lemma/domain";
import {
  assertArray,
  assertFiniteNonNegativeNumber,
  assertFinitePositiveNumber,
  assertJsonValue,
  assertNonEmptyString,
  assertPlainRecord,
  assertSchemaVersion,
  assertString,
  oneOf,
} from "./canonical-validation.js";
import { InvalidQuestionSolutionError } from "./errors.js";
import type { QuestionResponseField } from "./question-body.js";

export type QuestionFieldRule =
  | {
      type: "exact";
      responseFieldId: string;
      correctValue: JsonValue;
      points: number;
    }
  | {
      type: "number";
      responseFieldId: string;
      correctValue: number;
      points: number;
      tolerance: { type: "absolute" | "relative"; value: number };
    }
  | {
      type: "case_insensitive_text";
      responseFieldId: string;
      correctValue: string;
      points: number;
    }
  | {
      type: "manual";
      responseFieldId: string;
      points: number;
    };

export type QuestionSolution = {
  schemaVersion: 1;
  rules: QuestionFieldRule[];
};

export type GradeDetail = {
  responseFieldId: string;
  totalPoints: number;
  earnedPoints: number;
  correctAnswer?: JsonValue;
  userAnswer: JsonValue;
  feedback?: string;
};

export type GradeResult = {
  schemaVersion: 1;
  totalPoints: number;
  earnedPoints: number;
  status: "graded" | "needs_manual_review";
  details: GradeDetail[];
  graderVersion: string;
};

export function questionSolution(
  input: unknown,
  responseFields?: readonly QuestionResponseField[],
): QuestionSolution {
  assertPlainRecord(input, "question solution must be an object", fail);
  assertSchemaVersion(input, fail);
  assertArray(input.rules, "solution rules", fail);
  const allowed = responseFields
    ? new Set(responseFields.map((field) => field.id))
    : null;
  const rules: QuestionFieldRule[] = [];
  for (const rule of input.rules) {
    assertPlainRecord(rule, "solution rule must be an object", fail);
    assertNonEmptyString(rule.responseFieldId, "responseFieldId", fail);
    if (allowed && !allowed.has(rule.responseFieldId)) {
      fail("solution rule references unknown response field");
    }
    const ruleType = oneOf(rule.type, ["exact", "number", "case_insensitive_text", "manual"] as const, "solution rule type", fail);
    assertFinitePositiveNumber(rule.points, "solution rule points", fail);
    if (ruleType === "number") {
      if (typeof rule.correctValue !== "number" || !Number.isFinite(rule.correctValue)) {
        fail("correctValue must be a finite number");
      }
      assertPlainRecord(rule.tolerance, "number solution tolerance must be an object", fail);
      const toleranceType = oneOf(rule.tolerance.type, ["absolute", "relative"] as const, "number solution tolerance type", fail);
      assertFiniteNonNegativeNumber(rule.tolerance.value, "number solution tolerance", fail);
      rules.push({
        type: "number",
        responseFieldId: rule.responseFieldId,
        correctValue: rule.correctValue,
        points: rule.points,
        tolerance: {
          type: toleranceType,
          value: rule.tolerance.value,
        },
      });
      continue;
    }
    if (ruleType === "manual") {
      if (rule.correctValue !== undefined) {
        fail("manual solution rules must not include correctValue");
      }
      rules.push({
        type: "manual",
        responseFieldId: rule.responseFieldId,
        points: rule.points,
      });
      continue;
    }
    if (ruleType === "case_insensitive_text") {
      assertString(rule.correctValue, "correctValue", fail);
      rules.push({
        type: "case_insensitive_text",
        responseFieldId: rule.responseFieldId,
        correctValue: rule.correctValue,
        points: rule.points,
      });
      continue;
    }
    assertJsonValue(rule.correctValue, "correctValue", fail);
    rules.push({
      type: ruleType,
      responseFieldId: rule.responseFieldId,
      correctValue: rule.correctValue,
      points: rule.points,
    });
  }
  return { schemaVersion: 1, rules };
}

function fail(message: string): never {
  throw new InvalidQuestionSolutionError(message);
}
