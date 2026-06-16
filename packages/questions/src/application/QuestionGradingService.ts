import type { JsonValue } from "@lemma/domain";
import type {
  GradeResult,
  Question,
  QuestionAnswer,
  QuestionFieldRule,
} from "../domain/index.js";
import type { CustomQuestionGraderPort } from "./ports.js";

export class QuestionGradingService {
  constructor(
    private readonly deps: { customGraderPort?: CustomQuestionGraderPort } = {},
  ) {}

  async grade(input: {
    question: Question;
    answer: QuestionAnswer;
  }): Promise<GradeResult> {
    const custom = await this.deps.customGraderPort?.grade(input);
    if (custom) {
      return custom;
    }
    return gradeQuestionSolution(input.question, input.answer);
  }
}

function gradeQuestionSolution(
  question: Question,
  answer: QuestionAnswer,
): GradeResult {
  const solution = question.solution;
  const byField = new Map(
    answer.responses.map((response) => [response.responseFieldId, response.value]),
  );
  let needsManualReview = false;
  const details = solution.rules.map((rule) => {
    const userAnswer = byField.get(rule.responseFieldId) ?? null;
    const earnedPoints = gradeRule(rule, userAnswer);
    if (earnedPoints === null) {
      needsManualReview = true;
    }
    const detail = {
      responseFieldId: rule.responseFieldId,
      totalPoints: rule.points,
      earnedPoints: earnedPoints ?? 0,
      userAnswer,
    };
    return rule.type === "manual"
      ? detail
      : { ...detail, correctAnswer: rule.correctValue };
  });
  return {
    schemaVersion: 1,
    totalPoints: details.reduce((total, detail) => total + detail.totalPoints, 0),
    earnedPoints: details.reduce((total, detail) => total + detail.earnedPoints, 0),
    status: needsManualReview ? "needs_manual_review" : "graded",
    details,
    graderVersion: "canonical@1",
  };
}

function gradeRule(rule: QuestionFieldRule, userAnswer: JsonValue): number | null {
  if (rule.type === "manual") {
    return null;
  }
  if (userAnswer == null) {
    return 0;
  }
  if (rule.type === "case_insensitive_text") {
    return String(userAnswer).toLowerCase() ===
      String(rule.correctValue).toLowerCase()
      ? rule.points
      : 0;
  }
  if (rule.type === "number") {
    const expected = Number(rule.correctValue);
    const actual = Number(userAnswer);
    if (!Number.isFinite(expected) || !Number.isFinite(actual)) {
      return 0;
    }
    const delta = Math.abs(actual - expected);
    const allowed =
      rule.tolerance.type === "absolute"
        ? rule.tolerance.value
        : Math.abs(expected) * rule.tolerance.value;
    return delta <= allowed ? rule.points : 0;
  }
  return userAnswer === rule.correctValue ? rule.points : 0;
}
