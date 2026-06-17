import type { CurrentUser } from "@lemma/identity/application";
import { isSupport } from "@lemma/identity/domain";
import type {
  Workbook,
  WorkbookCalculation,
  WorkbookSnapshot,
} from "../domain/index.js";

type Actor = Pick<CurrentUser, "user" | "roles" | "isAdmin">;

export function canListWorkbooks(currentUser: Actor): boolean {
  return Boolean(currentUser.user.id);
}

export function canCreateWorkbook(currentUser: Actor): boolean {
  return Boolean(currentUser.user.id);
}

export function canManageWorkbook(
  currentUser: Actor,
  workbook: Workbook,
): boolean {
  return currentUser.isAdmin || workbook.ownerUserId === currentUser.user.id;
}

export function canViewWorkbook(
  currentUser: Actor,
  workbook: Workbook,
): boolean {
  return canManageWorkbook(currentUser, workbook);
}

export function canValidateWorkbook(
  currentUser: Actor,
  workbook: Workbook,
): boolean {
  return (
    canManageWorkbook(currentUser, workbook) || isSupport(currentUser.roles)
  );
}

export function canRequestWorkbookCalculation(
  currentUser: Actor,
  workbook: Workbook,
): boolean {
  return canManageWorkbook(currentUser, workbook);
}

export function canViewWorkbookCalculation(
  currentUser: Actor,
  calculation: WorkbookCalculation,
): boolean {
  return currentUser.isAdmin || calculation.ownerUserId === currentUser.user.id;
}

export function canManageWorkbookCalculation(
  currentUser: Actor,
  calculation: WorkbookCalculation,
): boolean {
  return canViewWorkbookCalculation(currentUser, calculation);
}

export function canViewWorkbookSnapshot(
  currentUser: Actor,
  _snapshot: WorkbookSnapshot,
  calculation: WorkbookCalculation | null,
): boolean {
  return (
    currentUser.isAdmin || calculation?.ownerUserId === currentUser.user.id
  );
}
