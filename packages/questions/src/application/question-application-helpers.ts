import {
  type QuestionBlueprint,
  type QuestionSet,
  questionBlueprintId as toQuestionBlueprintId,
  questionId as toQuestionId,
  questionSetId as toQuestionSetId,
} from "../domain/index.js";
import {
  ForbiddenQuestionActionError,
  QuestionBlueprintNotFoundError,
  QuestionNotFoundError,
  QuestionSetNotFoundError,
} from "./errors.js";
import type { QuestionsRepository } from "./ports.js";

export function assertQuestionAuthorized(
  allowed: boolean,
  message: string,
): void {
  if (!allowed) {
    throw new ForbiddenQuestionActionError(message);
  }
}

export async function findQuestionSetByIdOrThrow(
  questionsRepository: QuestionsRepository,
  id: string,
) {
  const questionSet = await questionsRepository.findQuestionSetById(
    toQuestionSetId(id),
  );
  if (!questionSet) {
    throw new QuestionSetNotFoundError();
  }
  return questionSet;
}

export async function findQuestionBlueprintByIdOrThrow(
  questionsRepository: QuestionsRepository,
  id: string,
) {
  const blueprint = await questionsRepository.findQuestionBlueprintById(
    toQuestionBlueprintId(id),
  );
  if (!blueprint) {
    throw new QuestionBlueprintNotFoundError();
  }
  return blueprint;
}

export async function findQuestionByIdOrThrow(
  questionsRepository: QuestionsRepository,
  id: string,
) {
  const question = await questionsRepository.findQuestionById(toQuestionId(id));
  if (!question) {
    throw new QuestionNotFoundError();
  }
  return question;
}

export async function persistQuestionSet(
  questionsRepository: QuestionsRepository,
  questionSet: QuestionSet,
) {
  const updated = await questionsRepository.updateQuestionSet(questionSet);
  if (!updated) {
    throw new QuestionSetNotFoundError();
  }
  return updated;
}

export async function persistQuestionBlueprint(
  questionsRepository: QuestionsRepository,
  blueprint: QuestionBlueprint,
) {
  const updated =
    await questionsRepository.saveQuestionBlueprintLifecycleState(blueprint);
  if (!updated) {
    throw new QuestionBlueprintNotFoundError();
  }
  return updated;
}

export async function hydrateQuestionBlueprint(blueprint: QuestionBlueprint) {
  return blueprint;
}
