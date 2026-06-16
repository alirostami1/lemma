import type { HydratedQuestionBlueprint } from "./dto.js";
import {
  ForbiddenQuestionActionError,
  QuestionBlueprintNotFoundError,
  QuestionNotFoundError,
  QuestionSetNotFoundError,
} from "./errors.js";
import type { QuestionsRepository } from "./ports.js";
import {
  type QuestionBlueprint,
  type QuestionSet,
  questionBlueprintDocument,
  questionBlueprintId as toQuestionBlueprintId,
  questionId as toQuestionId,
  questionSetId as toQuestionSetId,
  workbookId as toWorkbookId,
} from "../domain/index.js";

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
  const questionSet =
    await questionsRepository.findQuestionSetById(toQuestionSetId(id));
  if (!questionSet) {
    throw new QuestionSetNotFoundError();
  }
  return questionSet;
}

export async function findQuestionBlueprintByIdOrThrow(
  questionsRepository: QuestionsRepository,
  id: string,
) {
  const blueprint =
    await questionsRepository.findQuestionBlueprintById(
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
  const updated = await questionsRepository.updateQuestionBlueprint(blueprint);
  if (!updated) {
    throw new QuestionBlueprintNotFoundError();
  }
  return updated;
}

export async function hydrateQuestionBlueprint(
  questionsRepository: QuestionsRepository,
  blueprint: QuestionBlueprint,
): Promise<HydratedQuestionBlueprint> {
  if (blueprint.currentVersionId === null) {
    throw new QuestionBlueprintNotFoundError(
      "question blueprint has no current version",
    );
  }
  const currentVersion =
    await questionsRepository.findQuestionBlueprintVersionById(
      blueprint.currentVersionId,
    );
  if (!currentVersion) {
    throw new QuestionBlueprintNotFoundError();
  }
  return {
    ...blueprint,
    currentVersion,
  };
}

export function normalizeCanonicalBlueprintInput(input: {
  document: unknown;
  workbookId: string | null;
}) {
  return {
    document: questionBlueprintDocument(input.document),
    workbookId:
      input.workbookId === null ? null : toWorkbookId(input.workbookId),
  };
}
