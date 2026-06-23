import { type Timestamped, touch } from "@lemma/domain";
import {
  InvalidQuestionFieldError,
  InvalidQuestionStateTransitionError,
} from "./errors.js";
import {
  type QuestionBlueprintId,
  type QuestionGenerationRunId,
  type QuestionId,
  questionBlueprintId,
  questionGenerationRunId,
  questionId,
  type UserId,
  userId,
} from "./ids.js";
import { type QuestionBody, questionBody } from "./question-body.js";
import { type QuestionSolution, questionSolution } from "./question-grading.js";
import {
  type QuestionProducer,
  questionProducer,
} from "./question-producer.js";
import {
  type QuestionSourceEvidence,
  type QuestionSourcePlan,
  questionSourceEvidenceFromStore,
  questionSourcePlanFromStore,
} from "./question-source.js";
import { type QuestionStatus, questionStatus } from "./question-values.js";

export type Question = Timestamped & {
  id: QuestionId;
  ownerUserId: UserId;
  createdByUserId: UserId;
  blueprintId: QuestionBlueprintId;
  generationRunId: QuestionGenerationRunId;
  body: QuestionBody;
  solution: QuestionSolution;
  sourceEvidence: QuestionSourceEvidence;
  sourcePlan: QuestionSourcePlan;
  producer: QuestionProducer;
  status: QuestionStatus;
};

export function createQuestion(
  input: {
    id: QuestionId;
    ownerUserId: UserId;
    createdByUserId: UserId;
    blueprintId: QuestionBlueprintId;
    generationRunId: QuestionGenerationRunId;
    body: QuestionBody;
    solution: QuestionSolution;
    sourceEvidence: QuestionSourceEvidence;
    sourcePlan: QuestionSourcePlan;
    producer: QuestionProducer;
  },
  at: Date,
): Question {
  return {
    ...input,
    createdAt: at,
    status: "active",
    updatedAt: at,
  };
}

export function reconstituteQuestion(input: {
  id: string;
  ownerUserId: string;
  createdByUserId: string;
  blueprintId: string;
  generationRunId: string;
  body: unknown;
  solution: unknown;
  sourceEvidence: unknown;
  sourcePlan: unknown;
  producer: unknown;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): Question {
  const body = questionBody(input.body);
  return {
    blueprintId: questionBlueprintId(input.blueprintId),
    body,
    createdAt: input.createdAt,
    createdByUserId: userId(input.createdByUserId),
    generationRunId: questionGenerationRunId(input.generationRunId),
    id: questionId(input.id),
    ownerUserId: userId(input.ownerUserId),
    producer: questionProducer(input.producer),
    solution: questionSolution(input.solution, body.responseFields),
    sourceEvidence: questionSourceEvidenceFromStore(input.sourceEvidence),
    sourcePlan: questionSourcePlanFromStore(input.sourcePlan),
    status: questionStatus(input.status),
    updatedAt: input.updatedAt,
  };
}

export function archiveQuestion(question: Question, at: Date): Question {
  assertQuestionCanChange(question);
  return { ...touch(question, at), status: "archived" };
}

export function deleteQuestion(question: Question, at: Date): Question {
  assertQuestionCanChange(question);
  return { ...touch(question, at), status: "deleted" };
}

function assertQuestionCanChange(question: Question): void {
  if (question.status === "deleted") {
    throw new InvalidQuestionStateTransitionError(
      "deleted questions cannot be changed",
    );
  }
}

export function failQuestion(message: string): never {
  throw new InvalidQuestionFieldError(message);
}
