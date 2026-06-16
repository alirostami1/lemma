import type { ListFilesInput } from "./model";

export const filesKeys = {
  all: ["files"] as const,
  lists: () => [...filesKeys.all, "list"] as const,
  list: (input?: ListFilesInput) =>
    [...filesKeys.lists(), input ?? {}] as const,
  details: () => [...filesKeys.all, "detail"] as const,
  detail: (fileId: string) => [...filesKeys.details(), fileId] as const,
};
