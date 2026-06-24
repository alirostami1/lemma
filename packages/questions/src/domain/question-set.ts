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
    createdAt: at,
    createdByUserId: input.createdByUserId,
    description: input.description,
    id: input.id,
    name: input.name,
    ownerUserId: input.ownerUserId,
    status: "active",
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
    createdAt: input.createdAt,
    createdByUserId: userId(input.createdByUserId),
    description: questionSetDescription(input.description),
    id: questionSetId(input.id),
    name: questionSetName(input.name),
    ownerUserId: userId(input.ownerUserId),
    status: questionSetStatus(input.status),
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
    description:
      patch.description !== undefined
        ? questionSetDescription(patch.description)
        : set.description,
    name: patch.name !== undefined ? questionSetName(patch.name) : set.name,
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
    addedByUserId: input.addedByUserId,
    createdAt: at,
    position: input.position ?? null,
    questionId: input.questionId,
    questionSetId: input.questionSetId,
  };
}

function assertQuestionSetCanChange(set: QuestionSet): void {
  if (set.status === "deleted") {
    throw new InvalidQuestionStateTransitionError(
      "deleted question sets cannot be changed",
    );
  }
}
