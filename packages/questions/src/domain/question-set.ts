import { type Timestamped, touch } from "@lemma/domain";
import { InvalidQuestionStateTransitionError } from "./errors.js";
import {
  type QuestionId,
  type QuestionSetId,
  questionSetId,
  type UserId,
  userId,
} from "./ids.js";
import {
  type QuestionSetDescription,
  type QuestionSetName,
  type QuestionSetStatus,
  questionSetDescription,
  questionSetName,
  questionSetStatus,
} from "./question-values.js";

export type QuestionSet = Timestamped & {
  id: QuestionSetId;
  ownerUserId: UserId;
  createdByUserId: UserId;
  name: QuestionSetName;
  description: QuestionSetDescription | null;
  status: QuestionSetStatus;
};

export type QuestionSetQuestion = {
  questionSetId: QuestionSetId;
  questionId: QuestionId;
  addedByUserId: UserId;
  position: number | null;
  createdAt: Date;
};

export function createQuestionSet(
  input: {
    id: QuestionSetId;
    ownerUserId: UserId;
    createdByUserId: UserId;
    name: QuestionSetName;
    description: QuestionSetDescription | null;
  },
  at: Date,
): QuestionSet {
  return {
    id: input.id,
    ownerUserId: input.ownerUserId,
    createdByUserId: input.createdByUserId,
    name: input.name,
    description: input.description,
    status: "active",
    createdAt: at,
    updatedAt: at,
  };
}

export function reconstituteQuestionSet(input: {
  id: string;
  ownerUserId: string;
  createdByUserId: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): QuestionSet {
  return {
    id: questionSetId(input.id),
    ownerUserId: userId(input.ownerUserId),
    createdByUserId: userId(input.createdByUserId),
    name: questionSetName(input.name),
    description: questionSetDescription(input.description),
    status: questionSetStatus(input.status),
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export function renameQuestionSet(
  set: QuestionSet,
  patch: { name?: string; description?: string | null; status?: string },
  at: Date,
): QuestionSet {
  assertQuestionSetCanChange(set);
  return {
    ...touch(set, at),
    name: patch.name !== undefined ? questionSetName(patch.name) : set.name,
    description:
      patch.description !== undefined
        ? questionSetDescription(patch.description)
        : set.description,
    status:
      patch.status !== undefined ? questionSetStatus(patch.status) : set.status,
  };
}

export function archiveQuestionSet(set: QuestionSet, at: Date): QuestionSet {
  assertQuestionSetCanChange(set);
  return { ...touch(set, at), status: "archived" };
}

export function deleteQuestionSet(set: QuestionSet, at: Date): QuestionSet {
  assertQuestionSetCanChange(set);
  return { ...touch(set, at), status: "deleted" };
}

export function createQuestionSetQuestion(
  input: {
    questionSetId: QuestionSetId;
    questionId: QuestionId;
    addedByUserId: UserId;
    position?: number | null;
  },
  at: Date,
): QuestionSetQuestion {
  return {
    questionSetId: input.questionSetId,
    questionId: input.questionId,
    addedByUserId: input.addedByUserId,
    position: input.position ?? null,
    createdAt: at,
  };
}

function assertQuestionSetCanChange(set: QuestionSet): void {
  if (set.status === "deleted") {
    throw new InvalidQuestionStateTransitionError(
      "deleted question sets cannot be changed",
    );
  }
}
