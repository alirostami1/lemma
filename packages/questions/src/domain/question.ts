import { type Timestamped, touch } from "@lemma/domain";
import { assertPlainRecord, assertString } from "./canonical-validation.js";
import {
  InvalidQuestionFieldError,
  InvalidQuestionStateTransitionError,
} from "./errors.js";
import {
  type QuestionBlueprintId,
  type QuestionBlueprintVersionId,
  type QuestionGenerationRunId,
  type QuestionId,
  questionBlueprintId,
  questionBlueprintVersionId,
  questionGenerationRunId,
  questionId,
  type UserId,
  userId,
  type WorkbookCalculationId,
  type WorkbookId,
  type WorkbookSnapshotId,
  type WorkbookVersionId,
  workbookCalculationId,
  workbookId,
  workbookSnapshotId,
  workbookVersionId,
} from "./ids.js";
import { type QuestionBody, questionBody } from "./question-body.js";
import { type QuestionSolution, questionSolution } from "./question-grading.js";
import {
  type QuestionProducer,
  questionProducer,
} from "./question-producer.js";
import {
  type QuestionSourcePlan,
  questionSourcePlanFromStore,
} from "./question-source.js";
import { type QuestionStatus, questionStatus } from "./question-values.js";

export type WorkbookQuestionSource = {
  type: "workbook_snapshot";
  workbookId: WorkbookId;
  workbookVersionId: WorkbookVersionId | null;
  workbookCalculationId: WorkbookCalculationId | null;
  workbookSnapshotId: WorkbookSnapshotId | null;
};

export type Question = Timestamped & {
  id: QuestionId;
  ownerUserId: UserId;
  createdByUserId: UserId;
  blueprintId: QuestionBlueprintId;
  blueprintVersionId: QuestionBlueprintVersionId;
  generationRunId: QuestionGenerationRunId;
  body: QuestionBody;
  solution: QuestionSolution;
  sourcePlan: QuestionSourcePlan;
  producer: QuestionProducer;
  source: WorkbookQuestionSource | null;
  status: QuestionStatus;
};

export function createQuestion(
  input: {
    id: QuestionId;
    ownerUserId: UserId;
    createdByUserId: UserId;
    blueprintId: QuestionBlueprintId;
    blueprintVersionId: QuestionBlueprintVersionId;
    generationRunId: QuestionGenerationRunId;
    body: QuestionBody;
    solution: QuestionSolution;
    sourcePlan: QuestionSourcePlan;
    producer: QuestionProducer;
    source: WorkbookQuestionSource | null;
  },
  at: Date,
): Question {
  return {
    ...input,
    status: "active",
    createdAt: at,
    updatedAt: at,
  };
}

export function reconstituteQuestion(input: {
  id: string;
  ownerUserId: string;
  createdByUserId: string;
  blueprintId: string;
  blueprintVersionId: string;
  generationRunId: string;
  body: unknown;
  solution: unknown;
  sourcePlan: unknown;
  producer: unknown;
  source: unknown | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): Question {
  const body = questionBody(input.body);
  return {
    id: questionId(input.id),
    ownerUserId: userId(input.ownerUserId),
    createdByUserId: userId(input.createdByUserId),
    blueprintId: questionBlueprintId(input.blueprintId),
    blueprintVersionId: questionBlueprintVersionId(input.blueprintVersionId),
    generationRunId: questionGenerationRunId(input.generationRunId),
    body,
    solution: questionSolution(input.solution, body.responseFields),
    sourcePlan: questionSourcePlanFromStore(input.sourcePlan),
    producer: questionProducer(input.producer),
    source: input.source ? workbookQuestionSource(input.source) : null,
    status: questionStatus(input.status),
    createdAt: input.createdAt,
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

export type CreateWorkbookQuestionSourceInput = {
  type: "workbook_snapshot";
  workbookId: string;
};

export function workbookQuestionSource(input: unknown): WorkbookQuestionSource {
  const failSource = (message: string): never => {
    throw new InvalidQuestionFieldError(message);
  };
  assertPlainRecord(input, "question source must be an object", failSource);
  if (input.type !== "workbook_snapshot") {
    throw new InvalidQuestionFieldError("question source type is invalid");
  }
  const workbookIdValue = requiredString(
    input.workbookId,
    "workbookId",
    failSource,
  );
  const workbookVersionIdValue = optionalString(
    input.workbookVersionId,
    "workbookVersionId",
    failSource,
  );
  const workbookCalculationIdValue = optionalString(
    input.workbookCalculationId,
    "workbookCalculationId",
    failSource,
  );
  const workbookSnapshotIdValue = optionalString(
    input.workbookSnapshotId,
    "workbookSnapshotId",
    failSource,
  );
  return {
    type: "workbook_snapshot",
    workbookId: workbookId(workbookIdValue),
    workbookVersionId: workbookVersionIdValue
      ? workbookVersionId(workbookVersionIdValue)
      : null,
    workbookCalculationId: workbookCalculationIdValue
      ? workbookCalculationId(workbookCalculationIdValue)
      : null,
    workbookSnapshotId: workbookSnapshotIdValue
      ? workbookSnapshotId(workbookSnapshotIdValue)
      : null,
  };
}

function requiredString(
  value: unknown,
  field: string,
  fail: (message: string) => never,
): string {
  assertString(value, field, fail);
  return value;
}

function optionalString(
  value: unknown,
  field: string,
  fail: (message: string) => never,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  assertString(value, field, fail);
  return value;
}

function assertQuestionCanChange(question: Question): void {
  if (question.status === "deleted") {
    throw new InvalidQuestionStateTransitionError(
      "deleted questions cannot be changed",
    );
  }
}
