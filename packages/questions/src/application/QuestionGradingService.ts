import type { JsonValue } from "@lemma/domain";
import type {
  GradeResult,
  Question,
  QuestionAnswer,
  QuestionBody,
  QuestionFieldRule,
  QuestionInputBlock,
} from "../domain/index.js";
import { validateQuestionInputPrimitiveValue } from "../domain/index.js";
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
    answer.responses.map((response) => [
      response.responseFieldId,
      response.value,
    ]),
  );
  const inputBlocksByField = collectInputBlocksByField(question.body);
  let needsManualReview = false;
  const details = solution.rules.map((rule) => {
    const inputBlock = inputBlocksByField.get(rule.responseFieldId);
    const userAnswer = answerValueForField(
      byField,
      rule.responseFieldId,
      inputBlock,
    );
    const validation = inputBlock
      ? validateQuestionInputPrimitiveValue(inputBlock.input, userAnswer)
      : { errors: [], valid: true };
    const earnedPoints = validation.valid ? gradeRule(rule, userAnswer) : 0;
    if (earnedPoints === null) {
      needsManualReview = true;
    }
    const detail = {
      earnedPoints: earnedPoints ?? 0,
      ...(validation.valid
        ? {}
        : { feedback: validation.errors[0]?.message ?? "Invalid answer." }),
      responseFieldId: rule.responseFieldId,
      totalPoints: rule.points,
      userAnswer,
    };
    return rule.type === "manual"
      ? detail
      : { ...detail, correctAnswer: rule.correctValue };
  });
  return {
    details,
    earnedPoints: details.reduce(
      (total, detail) => total + detail.earnedPoints,
      0,
    ),
    graderVersion: "canonical@1",
    schemaVersion: 1,
    status: needsManualReview ? "needs_manual_review" : "graded",
    totalPoints: details.reduce(
      (total, detail) => total + detail.totalPoints,
      0,
    ),
  };
}

function answerValueForField(
  answersByField: ReadonlyMap<string, JsonValue>,
  responseFieldId: string,
  inputBlock: QuestionInputBlock | undefined,
): JsonValue {
  if (answersByField.has(responseFieldId)) {
    return answersByField.get(responseFieldId) ?? null;
  }
  return inputBlock?.input.defaultValue ?? null;
}

function collectInputBlocksByField(
  body: QuestionBody,
): ReadonlyMap<string, QuestionInputBlock> {
  const blocks = new Map<string, QuestionInputBlock>();
  for (const block of body.blocks) {
    collectInputBlocksFromBlock(block, blocks);
  }
  return blocks;
}

function collectInputBlocksFromBlock(
  block: QuestionBody["blocks"][number],
  blocks: Map<string, QuestionInputBlock>,
): void {
  if (block.kind === "primitive" && block.type === "input") {
    blocks.set(block.responseFieldId, block);
    return;
  }
  if (block.kind === "container") {
    for (const childBlock of block.blocks) {
      collectInputBlocksFromBlock(childBlock, blocks);
    }
    return;
  }
  if (block.kind === "complex") {
    for (const cell of block.cells) {
      for (const cellBlock of cell.blocks) {
        if (cellBlock.type === "input") {
          blocks.set(cellBlock.responseFieldId, cellBlock);
        }
      }
    }
  }
}

function gradeRule(
  rule: QuestionFieldRule,
  userAnswer: JsonValue,
): number | null {
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
