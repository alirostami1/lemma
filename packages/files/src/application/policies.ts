import type { CurrentUser } from "@lemma/identity/application";
import type { File, FileUpload } from "../domain/index.js";

export function canManageFiles(
  currentUser: Pick<CurrentUser, "isAdmin">,
): boolean {
  return currentUser.isAdmin;
}

export function canListFiles(
  _currentUser: Pick<CurrentUser, "user" | "isAdmin">,
): boolean {
  return true;
}

export function canCreateFileUpload(
  _currentUser: Pick<CurrentUser, "user" | "isAdmin">,
): boolean {
  return true;
}

export function canViewFile(
  currentUser: Pick<CurrentUser, "user" | "isAdmin">,
  file: File,
): boolean {
  return currentUser.isAdmin || file.ownerUserId === currentUser.user.id;
}

export function canUpdateFile(
  currentUser: Pick<CurrentUser, "user" | "isAdmin">,
  file: File,
): boolean {
  return canViewFile(currentUser, file);
}

export function canCompleteFileUpload(
  currentUser: Pick<CurrentUser, "user" | "isAdmin">,
  upload: FileUpload,
): boolean {
  return currentUser.isAdmin || upload.createdByUserId === currentUser.user.id;
}

export function canDeleteFile(
  currentUser: Pick<CurrentUser, "user" | "isAdmin">,
  file: File,
): boolean {
  return canViewFile(currentUser, file);
}

export function canCreateFileDownloadUrl(
  currentUser: Pick<CurrentUser, "user" | "isAdmin">,
  file: File,
): boolean {
  return canViewFile(currentUser, file);
}
