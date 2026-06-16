import type { ListIdentityUsersInput } from "./model";

export const identityKeys = {
  all: ["identity"] as const,
  currentUser: () => [...identityKeys.all, "me"] as const,
  roles: () => [...identityKeys.all, "roles"] as const,
  users: (input: ListIdentityUsersInput) =>
    [...identityKeys.all, "users", input] as const,
  userRoles: (userId: string) =>
    [...identityKeys.all, "users", userId, "roles"] as const,
};
