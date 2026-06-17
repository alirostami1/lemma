import type { CurrentUser } from "@lemma/identity/application";
import {
  type Question,
  type QuestionBlueprint,
  type QuestionGenerationRun,
  type QuestionSet,
  userId,
} from "../domain/index.js";

export function canCreateQuestionSet(
  _currentUser: Pick<CurrentUser, "user" | "isAdmin">,
): boolean {
  return true;
}

export function canListQuestionSets(
  _currentUser: Pick<CurrentUser, "user" | "isAdmin">,
): boolean {
  return true;
}

export function canViewQuestionSet(
  currentUser: Pick<CurrentUser, "user" | "isAdmin">,
  set: QuestionSet,
): boolean {
  return currentUser.isAdmin || set.ownerUserId === currentUserId(currentUser);
}

export function canManageQuestionSet(
  currentUser: Pick<CurrentUser, "user" | "isAdmin">,
  set: QuestionSet,
): boolean {
  return canViewQuestionSet(currentUser, set);
}

export function canCreateQuestionBlueprint(
  currentUser: Pick<CurrentUser, "isAdmin">,
  visibility: string,
): boolean {
  return visibility !== "system" || currentUser.isAdmin;
}

export function canViewQuestionBlueprint(
  currentUser: Pick<CurrentUser, "user" | "isAdmin">,
  blueprint: QuestionBlueprint,
): boolean {
  return (
    currentUser.isAdmin ||
    blueprint.visibility === "system" ||
    blueprint.ownerUserId === currentUserId(currentUser)
  );
}

export function canManageQuestionBlueprint(
  currentUser: Pick<CurrentUser, "user" | "isAdmin">,
  blueprint: QuestionBlueprint,
): boolean {
  return (
    currentUser.isAdmin ||
    (blueprint.visibility !== "system" &&
      blueprint.ownerUserId === currentUserId(currentUser))
  );
}

export function canViewQuestionBlueprintAuthoring(
  currentUser: Pick<CurrentUser, "user" | "isAdmin">,
  blueprint: QuestionBlueprint,
): boolean {
  return canManageQuestionBlueprint(currentUser, blueprint);
}

export function canCreateQuestion(
  _currentUser: Pick<CurrentUser, "user" | "isAdmin">,
): boolean {
  return true;
}

export function canViewQuestion(
  currentUser: Pick<CurrentUser, "user" | "isAdmin">,
  question: Question,
): boolean {
  return (
    currentUser.isAdmin || question.ownerUserId === currentUserId(currentUser)
  );
}

export function canManageQuestion(
  currentUser: Pick<CurrentUser, "user" | "isAdmin">,
  question: Question,
): boolean {
  return canViewQuestion(currentUser, question);
}

export function canViewQuestionGenerationRun(
  currentUser: Pick<CurrentUser, "user" | "isAdmin">,
  run: QuestionGenerationRun,
): boolean {
  return currentUser.isAdmin || run.ownerUserId === currentUserId(currentUser);
}

export function canManageQuestionGenerationRun(
  currentUser: Pick<CurrentUser, "user" | "isAdmin">,
  run: QuestionGenerationRun,
): boolean {
  return canViewQuestionGenerationRun(currentUser, run);
}

function currentUserId(currentUser: Pick<CurrentUser, "user">) {
  return userId(currentUser.user.id);
}
